// Testes para expoPushChannel
// Cobre múltiplos devices, erros permanentes e desativação de token
//
// IMPORTANTE: expoClient expõe `sendPushNotificationsAsync` (não `send`).
// Consultar expoPushChannel.js para a API exata usada (Gate 6 — R-275).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendExpoPushNotification } from './expoPushChannel.js'

const makePayload = () => ({
  title: 'Estoque baixo',
  body: '*Losartana* está acabando',       // MarkdownV2 (body L2)
  pushBody: 'Losartana está acabando',     // Texto puro para Push (R-205)
  deeplink: 'dosiq://stock',
  metadata: { kind: 'stock_alert', builtAt: '2026-01-01T00:00:00Z' },
  actions: [],
})

const makeContext = () => ({ correlationId: 'expo-test-001' })

const mockExpoClient = { sendPushNotificationsAsync: vi.fn() }
const mockRepositories = {
  devices: {
    listActiveByUser: vi.fn(),
    deactivateByToken: vi.fn(),
  },
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('expoPushChannel', () => {
  // Caso 1: 2 devices ativos → 2 mensagens enviadas com pushBody (não body)
  it('caso 1: 2 devices ativos → 2 mensagens enviadas, 2 entregues', async () => {
    const devices = [
      { push_token: 'ExponentPushToken[aaa]' },
      { push_token: 'ExponentPushToken[bbb]' },
    ]
    mockRepositories.devices.listActiveByUser.mockResolvedValue(devices)
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }])

    const result = await sendExpoPushNotification({
      userId: 'user-1',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.channel).toBe('mobile_push')
    expect(result.attempted).toBe(2)
    expect(result.delivered).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.deactivatedTokens).toHaveLength(0)

    // Verifica que usa pushBody (texto puro) para o campo body do push
    expect(mockExpoClient.sendPushNotificationsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExponentPushToken[aaa]',
          body: 'Losartana está acabando', // pushBody, não body Markdown
        }),
        expect.objectContaining({ to: 'ExponentPushToken[bbb]' }),
      ])
    )
  })

  // Caso 2: 1 device com DeviceNotRegistered → desativado, outro entregue
  it('caso 2: 1 DeviceNotRegistered desativado, 1 entregue', async () => {
    const devices = [
      { push_token: 'ExponentPushToken[bad]' },
      { push_token: 'ExponentPushToken[good]' },
    ]
    mockRepositories.devices.listActiveByUser.mockResolvedValue(devices)
    mockRepositories.devices.deactivateByToken.mockResolvedValue()
    mockExpoClient.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok' },
    ])

    const result = await sendExpoPushNotification({
      userId: 'user-2',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.attempted).toBe(2)
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.deactivatedTokens).toContain('ExponentPushToken[bad]')
    expect(mockRepositories.devices.deactivateByToken).toHaveBeenCalledWith('ExponentPushToken[bad]')
    expect(mockRepositories.devices.deactivateByToken).not.toHaveBeenCalledWith('ExponentPushToken[good]')
  })

  // Caso 3: sem devices ativos → retorna success=true com attempted=0
  it('caso 3: sem devices ativos → noop', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await sendExpoPushNotification({
      userId: 'user-3',
      payload: makePayload(),
      context: makeContext(),
      repositories: mockRepositories,
      expoClient: mockExpoClient,
    })

    expect(result.success).toBe(true)
    expect(result.attempted).toBe(0)
    expect(result.delivered).toBe(0)
    expect(mockExpoClient.sendPushNotificationsAsync).not.toHaveBeenCalled()
  })
})
