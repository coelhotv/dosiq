// Testes para usePushNotifications.js — deeplink real (N1.4)
// Cobre: foreground tap, cold start, fallback sem screen, cold start uma vez só (fix review Gemini)
//
// Após review do Gemini (#499): navigationRef usa createNavigationContainerRef —
// navigate() é chamado diretamente no ref (sem .current), e o React Navigation
// enfileira automaticamente se o navigator não estiver pronto (sem listener fallback).
//
// NOTA: jest.mock é hoisted pelo Babel — factories não podem referenciar vars externas.
// Usar require() após jest.mock para acessar as funções mock.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { renderHook, act } from '@testing-library/react-native'
import { ROUTES } from '../../../navigation/routes'

// --- Mocks de módulo ---

jest.mock('../../../navigation/navigationRef', () => ({
  navigationRef: {
    navigate: jest.fn(),
    isReady: jest.fn(() => true),
  },
}))

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
  // Register-only: hook lê status (puro), não pede permissão. 'denied' mantém os
  // testes focados em deeplink sem acionar registro de token.
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied', canAskAgain: false })),
}))

jest.mock('../requestPushPermission', () => ({
  requestPushPermission: jest.fn(() => Promise.resolve({ granted: true })),
}))

jest.mock('../getExpoPushToken', () => ({
  getExpoPushToken: jest.fn(() => Promise.resolve('ExponentPushToken[test]')),
}))

jest.mock('../syncNotificationDevice', () => ({
  syncNotificationDevice: jest.fn(() => Promise.resolve()),
}))

jest.mock('../unregisterNotificationDevice', () => ({
  unregisterNotificationDevice: jest.fn(() => Promise.resolve()),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}))

// Acesso às funções mock via require (após as declarações de mock)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { navigationRef } = require('../../../navigation/navigationRef')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = require('expo-notifications')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usePushNotifications } = require('../usePushNotifications')

// --- Helpers ---

const makeSession = () => ({ user: { id: 'user-abc' } })

function makeResponse(screen: string, params: Record<string, unknown> = { at: '08:00' }) {
  return {
    notification: {
      request: {
        content: {
          data: {
            navigation: { screen, params },
          },
        },
      },
    },
  }
}

// --- Testes ---

describe('usePushNotifications — deeplink (N1.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    navigationRef.navigate.mockReset()
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(null)
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Regressão do smoke do 029 F5: listener DUPLICADO.
  //
  // O registro morava dentro de `setupPush()` (async), depois de vários `await`. Quando o efeito
  // re-rodava — a identidade de `session` muda a cada refresh de token — o cleanup executava com
  // a variável ainda `undefined`, `remove()` virava no-op, e a execução antiga seguia até
  // registrar um listener órfão. Cada ciclo somava mais um, e um único toque em [Iniciar etapa]
  // chamava a RPC N vezes (log real: `already_confirmed` + `confirmed` no mesmo toque).
  //
  // O que se trava aqui: TODO listener registrado tem que ser removido no cleanup. Se o registro
  // voltar para dentro do async, o `remove` do 1º ciclo deixa de ser chamado e este teste quebra.
  // Regressão do smoke do 029 F5 (listener DUPLICADO a cada refresh de token) e spec 091: o efeito
  // agora depende do ID da pessoa. Nova IDENTIDADE de sessão com o mesmo usuário (refresh de token,
  // re-login da conferência de senha) NÃO re-roda o setup — nem re-registra o aparelho. Troca de
  // PESSOA re-roda e remove o listener anterior. Em qualquer caso, nenhum listener sobra vivo.
  it('refresh de token (mesmo usuário) não re-registra; troca de pessoa remove o listener anterior', async () => {
    const removes = []
    Notifications.addNotificationResponseReceivedListener.mockImplementation(() => {
      const remove = jest.fn()
      removes.push(remove)
      return { remove }
    })

    // Client estável, como no app (constante de módulo) — `{}` novo a cada render mudaria a dep.
    const client = {}
    const { rerender, unmount } = renderHook(
      ({ session }) => usePushNotifications({ supabase: client, session }),
      { initialProps: { session: makeSession() } }
    )

    rerender({ session: makeSession() })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(removes).toHaveLength(1)

    rerender({ session: { user: { id: 'user-outra' } } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(removes).toHaveLength(2)
    expect(removes[0]).toHaveBeenCalled()

    unmount()
    removes.forEach((r) => expect(r).toHaveBeenCalled())
  })

  // Cenário 1: tap foreground com bulk-plan
  it('tap com bulk-plan navega para TODAY com params', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(capturedHandler.fn).not.toBeNull()

    act(() => {
      capturedHandler.fn(makeResponse('bulk-plan', { planId: 'plan-1', at: '08:00' }))
    })

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { screen: 'bulk-plan', planId: 'plan-1', at: '08:00' })
    unmount()
  })

  // Cenário 2: tap foreground com bulk-misc
  it('tap com bulk-misc navega para TODAY com params', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      capturedHandler.fn(makeResponse('bulk-misc', { misc: 1, at: '14:00' }))
    })

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { screen: 'bulk-misc', misc: 1, at: '14:00' })
    unmount()
  })

  // Cenário 3: tap com dose-individual
  it('tap com dose-individual navega para TODAY com params', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      capturedHandler.fn(makeResponse('dose-individual', { protocolId: 'proto-1' }))
    })

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { screen: 'dose-individual', protocolId: 'proto-1' })
    unmount()
  })

  // Cenário 4: tap sem navigation.screen → fallback TODAY com params vazios
  it('tap sem navigation.screen aciona fallback para TODAY', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // Push do SERVIDOR sem screen (kind presente, navigation sem screen) → fallback TODAY.
    act(() => {
      capturedHandler.fn({
        notification: { request: { content: { data: { kind: 'daily_digest', navigation: {} } } } },
      })
    })

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, {})
    unmount()
  })

  // 065 C1 — provado no emulador Android (logcat 13:42/13:52, 26/09): o toque em "Registrar" da
  // notificação de dose ativa do Notifee chega ao listener do expo com `data` SEM `doseInstanceId`
  // e sem `navigation`/`kind`. Não é push do servidor: não navega (a modal é do handler do Notifee).
  it('toque vindo do Notifee (data sem navigation nem kind) não navega nem mede', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })
    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    act(() => {
      capturedHandler.fn({ notification: { request: { content: { data: {} } } } })
    })
    expect(navigationRef.navigate).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalledWith('push_notification_tapped', expect.anything())
    unmount()
  })

  // Cenário 4b: press do alarme nativo (Notifee) tem doseInstanceId e NÃO navega
  // (evita 'Hoje' not handled — tratado pelo AlarmSchedulerBridge).
  it('press do alarme nativo (doseInstanceId) não navega', async () => {
    const capturedHandler = { fn: null }
    Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      capturedHandler.fn = fn
      return { remove: jest.fn() }
    })

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      capturedHandler.fn({
        notification: { request: { content: { data: { doseInstanceId: 'inst-9' } } } },
      })
    })

    expect(navigationRef.navigate).not.toHaveBeenCalled()
    unmount()
  })

  // Cenário 5: cold start com resposta pendente
  it('cold start com resposta pendente navega para TODAY', async () => {
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(
      makeResponse('bulk-plan', { planId: 'plan-cold' })
    )

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled()
    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { screen: 'bulk-plan', planId: 'plan-cold' })
    unmount()
  })

  // Cenário 6: cold start sem resposta pendente → sem navegação
  it('cold start sem resposta pendente não navega', async () => {
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(null)

    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession() })
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled()
    expect(navigationRef.navigate).not.toHaveBeenCalled()
    unmount()
  })

  // Cenário 7: cold start processa apenas uma vez — re-execução do useEffect (logout+login) não re-navega
  it('cold start processa apenas uma vez mesmo com re-execução do useEffect', async () => {
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(
      makeResponse('bulk-plan', { planId: 'plan-cold' })
    )

    // Primeira sessão
    const { unmount, rerender } = renderHook(
      ({ session }) => usePushNotifications({ supabase: {}, session }),
      { initialProps: { session: makeSession() } }
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(navigationRef.navigate).toHaveBeenCalledTimes(1)
    navigationRef.navigate.mockClear()

    // Simular logout + novo login (re-executa o useEffect)
    rerender({ session: null })
    await act(async () => { await new Promise((r) => setTimeout(r, 5)) })

    rerender({ session: makeSession() })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Cold start NÃO deve navegar novamente
    expect(navigationRef.navigate).not.toHaveBeenCalled()
    unmount()
  })
})

// 065 PR C1 (US5): toque no corpo do push → push_notification_tapped{kind do servidor}.
describe('usePushNotifications — push_notification_tapped (065)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  const tapped = () => mockLogEvent.mock.calls.filter(([n]) => n === 'push_notification_tapped').map(([, p]) => p)

  it('cold start com kind → 1 evento com kind verbatim e surface push', async () => {
    const res = makeResponse('history')
    ;(res.notification.request.content.data as any).kind = 'weekly_adherence'
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(res)
    renderHook(() => usePushNotifications({ supabase: {}, session: makeSession() }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(tapped()).toEqual([{ surface: 'push', kind: 'weekly_adherence' }])
  })

  it('sem kind no payload → evento sem a chave', async () => {
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(makeResponse('history'))
    renderHook(() => usePushNotifications({ supabase: {}, session: makeSession() }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(tapped()).toEqual([{ surface: 'push' }])
  })

  // 065 AD-8: push de LEMBRETE de dose também é "o lembrete abriu o app".
  const opened = () => mockLogEvent.mock.calls.filter(([n]) => n === 'reminder_opened').map(([, p]) => p)

  it('push de lembrete de dose → reminder_opened{server_push} além do tapped', async () => {
    require('@platform/analytics/reminderEvents').__resetReminderDedupe()
    const res = makeResponse('history')
    ;(res.notification.request.content.data as any).kind = 'dose_reminder_by_plan'
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(res)
    renderHook(() => usePushNotifications({ supabase: {}, session: makeSession() }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(opened()).toEqual([{ source: 'server_push', surface: 'push' }])
  })

  it('push que NÃO é lembrete (stock_alert) → tapped sim, reminder_opened não', async () => {
    const res = makeResponse('history')
    ;(res.notification.request.content.data as any).kind = 'stock_alert'
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(res)
    renderHook(() => usePushNotifications({ supabase: {}, session: makeSession() }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(tapped()).toEqual([{ surface: 'push', kind: 'stock_alert' }])
    expect(opened()).toEqual([])
  })

  it('alarme nativo (doseInstanceId) → nenhum evento', async () => {
    const res = makeResponse('history')
    ;(res.notification.request.content.data as any).doseInstanceId = 'di-1'
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(res)
    renderHook(() => usePushNotifications({ supabase: {}, session: makeSession() }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(tapped()).toEqual([])
  })
})

// Spec 091 — PO-4 / INV-3: registrar o aparelho é escrita em nome da pessoa. Com o token de uma
// conta excluída em outro aparelho, o registro batia na FK de notification_devices. Só registra
// depois de o servidor confirmar a conta (`canRegister`).
describe('usePushNotifications — registro só com conta confirmada (spec 091)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { syncNotificationDevice } = require('../syncNotificationDevice')

  beforeEach(() => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true })
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  async function settle() {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }

  it('conta não confirmada ⇒ não registra', async () => {
    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession(), canRegister: false }),
    )
    await settle()
    expect(syncNotificationDevice).not.toHaveBeenCalled()
    unmount()
  })

  it('conta confirmada ⇒ registra (comportamento preservado)', async () => {
    const { unmount } = renderHook(() =>
      usePushNotifications({ supabase: {}, session: makeSession(), canRegister: true }),
    )
    await settle()
    expect(syncNotificationDevice).toHaveBeenCalled()
    unmount()
  })
})
