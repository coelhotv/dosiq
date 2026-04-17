// Testes para expoPushChannel
// Cobre múltiplos devices, erros permanentes e desativação de token

import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendExpoPushNotification } from './expoPushChannel.js'

const makePayload = () => ({
  title: 'Estoque baixo',
  body: 'Losartana está acabando',
  deeplink: 'meusremedios://stock',
  metadata: { medicineId: 'med-1' },
})

const makeContext = () => ({ correlationId: 'expo-test-001' })

const mockExpoClient = { send: vi.fn() }
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
  // Caso 1: 2 devices ativos → 2 mensagens enviadas
  it('caso 1: 2 devices ativos → 2 mensagens enviadas, 2 entregues', async () => {
    const devices = [
      { push_token: 'ExponentPushToken[aaa]' },
      { push_token: 'ExponentPushToken[bbb]' },
    ]
    mockRepositories.devices.listActiveByUser.mockResolvedValue(devices)
    mockExpoClient.send.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }])

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
    expect(mockExpoClient.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: 'ExponentPushToken[aaa]' }),
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
    mockExpoClient.send.mockResolvedValue([
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
})
