import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCallbacks } from '../doseActions.js'
import { supabase } from '../../../services/supabase.js'
import { getUserIdByChatId } from '../../../services/userService.js'
import { medicineLogService } from '../../../services/medicineLogService.js'

vi.mock('../../../services/supabase.js', () => {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve({ data: [], error: null }))
  }
  return { supabase: mock }
})

vi.mock('../../../services/userService.js', () => ({
  getUserIdByChatId: vi.fn()
}))

vi.mock('../../../services/medicineLogService.js', () => ({
  medicineLogService: {
    createMany: vi.fn()
  }
}))

describe('handleTakePlan', () => {
  let mockBot;

  beforeEach(() => {
    vi.clearAllMocks()
    mockBot = {
      on: vi.fn(),
      editMessageText: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true)
    }
  })

  it('deve registrar todas as doses de um plano para o horário correto', async () => {
    const chatId = 123
    const userId = 'user-uuid'
    const planId = 'plan-123-abc-def'
    const planIdShort = planId.slice(0, 8)
    const hhmm = '08:00'
    
    vi.mocked(getUserIdByChatId).mockResolvedValue(userId)
    
    const mockProtocols = [
      { 
        id: 'p1', 
        medicine_id: 'm1', 
        dosage_per_intake: 1, 
        treatment_plan_id: planId, 
        time_schedule: ['08:00'],
        treatment_plan: { id: planId, name: 'Plano A' }
      }
    ]

    vi.mocked(supabase.then).mockImplementation((resolve) => resolve({ data: mockProtocols, error: null }))
    
    const spy = vi.spyOn(medicineLogService, 'createMany').mockResolvedValue({ success: true, count: 1 })

    await handleCallbacks(mockBot)
    const callbackHandler = mockBot.on.mock.calls.find(c => c[0] === 'callback_query')[1]
    
    await callbackHandler({
      data: `takeplan:${planIdShort}:${hhmm}`,
      message: { chat: { id: chatId }, message_id: 456 },
      id: 'query-id'
    })

    expect(spy).toHaveBeenCalled()
    expect(mockBot.editMessageText).toHaveBeenCalled()
    const [msg, opts] = mockBot.editMessageText.mock.calls[0]
    expect(msg).toContain('doses')
    expect(msg).toContain('plano')
    expect(opts.chat_id).toBe(chatId)
  })
})
