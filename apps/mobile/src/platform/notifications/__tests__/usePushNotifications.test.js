// Testes para usePushNotifications.js — deeplink real (N1.4)
// Cobre: foreground tap, cold start, fallback sem screen, navigationRef não pronto
//
// NOTA: jest.mock é hoisted para o topo do arquivo pelo Babel — as factories não
// podem referenciar variáveis declaradas no escopo do módulo. As funções mock
// são definidas inline e acessadas via require() após o mock.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { renderHook, act } from '@testing-library/react-native'
import { ROUTES } from '../../../navigation/routes'

// --- Mocks de módulo (factories inline — evitar referência a vars externas) ---

jest.mock('../../../navigation/Navigation', () => ({
  navigationRef: {
    current: {
      isReady: jest.fn(() => true),
      navigate: jest.fn(),
      addListener: jest.fn(),
    },
  },
}))

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
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

// --- Acesso às funções mock via require (após as declarações de mock) ---
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { navigationRef } = require('../../../navigation/Navigation')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = require('expo-notifications')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usePushNotifications } = require('../usePushNotifications')

// --- Helpers ---

const makeSession = () => ({ user: { id: 'user-abc' } })

function makeResponse(screen, params = { at: '08:00' }) {
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
    // Restaurar estado padrão do navigationRef
    navigationRef.current.isReady.mockReturnValue(true)
    navigationRef.current.navigate.mockReset()
    navigationRef.current.addListener.mockReset()
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(null)
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() })
  })

  afterEach(() => {
    jest.clearAllMocks()
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

    expect(navigationRef.current.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { planId: 'plan-1', at: '08:00' })
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

    expect(navigationRef.current.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { misc: 1, at: '14:00' })
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

    expect(navigationRef.current.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { protocolId: 'proto-1' })
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

    act(() => {
      capturedHandler.fn({
        notification: { request: { content: { data: {} } } },
      })
    })

    expect(navigationRef.current.navigate).toHaveBeenCalledWith(ROUTES.TODAY, {})
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
    expect(navigationRef.current.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { planId: 'plan-cold' })
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
    // navigate pode ser chamado apenas pelo listener de tap — não pelo cold start
    // O mock de addNotificationResponseReceivedListener não dispara automaticamente
    expect(navigationRef.current.navigate).not.toHaveBeenCalled()
    unmount()
  })

  // Cenário 7: navigationRef não pronto → usa addListener('state', ...)
  it('navigationRef não pronto usa addListener state como fallback', async () => {
    navigationRef.current.isReady.mockReturnValue(false)

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
      capturedHandler.fn(makeResponse('bulk-plan', { planId: 'plan-x' }))
    })

    expect(navigationRef.current.navigate).not.toHaveBeenCalled()
    expect(navigationRef.current.addListener).toHaveBeenCalledWith('state', expect.any(Function))
    unmount()
  })
})
