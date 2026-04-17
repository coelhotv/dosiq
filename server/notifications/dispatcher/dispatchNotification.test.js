// Testes para dispatchNotification
// Cobre coexistência de canais, isolamento de falhas e casos-limite

import { describe, it, expect, vi, afterEach } from 'vitest'
import { dispatchNotification } from './dispatchNotification.js'

const makePayload = () => ({
  title: 'Hora do seu remédio',
  body: 'Tome Losartana agora',
  deeplink: 'meusremedios://today',
  metadata: {},
})

const makeContext = () => ({ correlationId: 'test-corr-123' })

const mockBot = { sendMessage: vi.fn() }
const mockExpoClient = { send: vi.fn() }
const mockRepositories = {
  preferences: { getByUserId: vi.fn(), hasTelegramChat: vi.fn() },
  devices: { listActiveByUser: vi.fn(), deactivateByToken: vi.fn() },
}

// Supabase centralizado importado em telegramChannel — mockamos o módulo centralizado
vi.mock('../../services/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: { telegram_chat_id: 'chat-999' }, error: null }),
        }),
      }),
    }),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('dispatchNotification', () => {
  // Caso 1: both com Telegram OK + push OK → ambos entregues
  it('caso 1: both — Telegram e push entregues', async () => {
    mockBot.sendMessage.mockResolvedValue({ message_id: 1 })
    mockExpoClient.send.mockResolvedValue([{ status: 'ok' }])
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[abc]' }])

    const result = await dispatchNotification({
      userId: 'user-1',
      kind: 'dose_reminder',
      payload: makePayload(),
      channels: ['telegram', 'mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.totalDelivered).toBe(2)
    expect(result.totalFailed).toBe(0)
    expect(result.channels).toHaveLength(2)
  })

  // Caso 2: both com push falhando → Telegram entrega, push falha sem cancelar Telegram
  it('caso 2: both — Telegram entregue, push falha isoladamente', async () => {
    mockBot.sendMessage.mockResolvedValue({ message_id: 2 })
    mockExpoClient.send.mockRejectedValue(new Error('Expo service unavailable'))
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[def]' }])

    const result = await dispatchNotification({
      userId: 'user-2',
      kind: 'dose_reminder',
      payload: makePayload(),
      channels: ['telegram', 'mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    const telegramResult = result.channels.find((c) => c.channel === 'telegram')
    const pushResult = result.channels.find((c) => c.channel === 'mobile_push')

    expect(telegramResult.delivered).toBe(1)
    expect(pushResult.success).toBe(false)
    expect(result.totalDelivered).toBe(1)
  })

  // Caso 3: mobile_push com DeviceNotRegistered → token desativado
  it('caso 3: DeviceNotRegistered desativa o token', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([{ push_token: 'ExponentPushToken[bad]' }])
    mockRepositories.devices.deactivateByToken.mockResolvedValue()
    mockExpoClient.send.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
    ])

    const result = await dispatchNotification({
      userId: 'user-3',
      kind: 'dose_reminder',
      payload: makePayload(),
      channels: ['mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(mockRepositories.devices.deactivateByToken).toHaveBeenCalledWith('ExponentPushToken[bad]')
    expect(result.channels[0].deactivatedTokens).toContain('ExponentPushToken[bad]')
  })

  // Caso 4: none (channels=[]) → zero tentativas
  it('caso 4: channels vazio → nenhuma tentativa', async () => {
    const result = await dispatchNotification({
      userId: 'user-4',
      kind: 'dose_reminder',
      payload: makePayload(),
      channels: [],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.channels).toHaveLength(0)
    expect(result.totalDelivered).toBe(0)
    expect(result.totalFailed).toBe(0)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
    expect(mockExpoClient.send).not.toHaveBeenCalled()
  })

  // Caso 5: usuário sem devices push → attempted 0
  it('caso 5: mobile_push sem devices → attempted 0', async () => {
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await dispatchNotification({
      userId: 'user-5',
      kind: 'dose_reminder',
      payload: makePayload(),
      channels: ['mobile_push'],
      context: makeContext(),
      repositories: mockRepositories,
      bot: mockBot,
      expoClient: mockExpoClient,
    })

    expect(result.channels[0].attempted).toBe(0)
    expect(result.totalDelivered).toBe(0)
    expect(mockExpoClient.send).not.toHaveBeenCalled()
  })
})
