import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCallbacks } from '../doseActions.js'
import { supabase } from '../../../services/supabase.js'
import { getUserIdByChatId } from '../../../services/userService.js'
import { medicineLogService } from '../../../services/medicineLogService.js'
import { partitionDoses } from '../../utils/partitionDoses.js'

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

vi.mock('../../utils/partitionDoses.js', () => ({
  partitionDoses: vi.fn()
}))

describe('handleTakeList', () => {
  let mockBot;

  beforeEach(() => {
    vi.clearAllMocks()
    mockBot = {
      on: vi.fn(),
      editMessageText: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true)
    }
  })

  it('deve registrar todas as doses da lista misc para o horário correto', async () => {
    const chatId = 123
    const userId = 'user-uuid'
    const hhmm = '14:00'
    
    vi.mocked(getUserIdByChatId).mockResolvedValue(userId)
    
    vi.mocked(supabase.then).mockImplementation((resolve) => resolve({ data: [], error: null }))

    partitionDoses.mockReturnValue([
      { kind: 'misc', doses: [
        { protocolId: 'p1', medicineId: 'm1', dosagePerIntake: 1 },
        { protocolId: 'p2', medicineId: 'm2', dosagePerIntake: 1 }
      ]}
    ])

    medicineLogService.createMany.mockResolvedValue({ success: true, count: 2 })

    await handleCallbacks(mockBot)
    const callbackHandler = mockBot.on.mock.calls.find(c => c[0] === 'callback_query')[1]
    
    await callbackHandler({
      data: `takelist:misc:${hhmm}`,
      message: { chat: { id: chatId }, message_id: 456 },
      id: 'query-id'
    })

    expect(medicineLogService.createMany).toHaveBeenCalled()
    expect(mockBot.editMessageText).toHaveBeenCalled()
    const [msg, opts] = mockBot.editMessageText.mock.calls[0]
    expect(msg).toContain('doses')
    expect(msg).toContain('avulsas')
    expect(opts.chat_id).toBe(chatId)
  })
})
