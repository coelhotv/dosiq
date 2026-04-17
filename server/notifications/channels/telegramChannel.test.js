// Testes para telegramChannel
// Cobre entrega com sucesso e ausência de telegram_chat_id

import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendTelegramNotification } from './telegramChannel.js'

const makePayload = () => ({
  title: 'Hora do remédio',
  body: 'Tome Losartana agora',
  deeplink: 'meusremedios://today',
  metadata: {},
})

const makeContext = () => ({ correlationId: 'tg-test-001' })
const mockBot = { sendMessage: vi.fn() }

afterEach(() => {
  vi.clearAllMocks()
})

// Mock do supabase para controlar telegram_chat_id
const mockSingle = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  }),
}))

describe('telegramChannel', () => {
  // Caso 1: entrega com sucesso → shape correto retornado
  it('caso 1: entrega com sucesso retorna shape correto', async () => {
    mockSingle.mockResolvedValue({ data: { telegram_chat_id: 'chat-123' }, error: null })
    mockBot.sendMessage.mockResolvedValue({ message_id: 42 })

    const result = await sendTelegramNotification({
      userId: 'user-1',
      payload: makePayload(),
      context: makeContext(),
      bot: mockBot,
    })

    expect(result.channel).toBe('telegram')
    expect(result.success).toBe(true)
    expect(result.attempted).toBe(1)
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.deactivatedTokens).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
    expect(mockBot.sendMessage).toHaveBeenCalledWith('chat-123', expect.any(String), { parse_mode: 'MarkdownV2' })
  })

  // Caso 2: sem telegram_chat_id → attempted 0
  it('caso 2: sem telegram_chat_id retorna attempted 0', async () => {
    mockSingle.mockResolvedValue({ data: { telegram_chat_id: null }, error: null })

    const result = await sendTelegramNotification({
      userId: 'user-2',
      payload: makePayload(),
      context: makeContext(),
      bot: mockBot,
    })

    expect(result.channel).toBe('telegram')
    expect(result.success).toBe(true)
    expect(result.attempted).toBe(0)
    expect(result.delivered).toBe(0)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
  })
})
