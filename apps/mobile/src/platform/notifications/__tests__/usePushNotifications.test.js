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

// createNavigationContainerRef retorna um objeto com navigate() diretamente (sem .current)
jest.mock('../../../navigation/Navigation', () => ({
  navigationRef: {
    navigate: jest.fn(),
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

// Acesso às funções mock via require (após as declarações de mock)
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
    navigationRef.navigate.mockReset()
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

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { planId: 'plan-1', at: '08:00' })
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

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { misc: 1, at: '14:00' })
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

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { protocolId: 'proto-1' })
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

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, {})
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
    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.TODAY, { planId: 'plan-cold' })
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
