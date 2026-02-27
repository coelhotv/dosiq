import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create a mutable reference that the mock factory will close over
const mockState = {
  calculateDaysRemaining: vi.fn(),
  shouldSendNotification: vi.fn()
}

// Mock all dependencies at module level - use mutable reference
vi.mock('../../../../server/services/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
}))

vi.mock('../../../../server/bot/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('../../../../server/services/protocolCache.js', () => ({
  getAllUsersWithTelegram: vi.fn(),
  getUserSettings: vi.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }),
  getActiveProtocols: vi.fn().mockResolvedValue([])
}))

vi.mock('../../../../server/utils/formatters.js', () => ({
  // Use the mutable reference
  calculateDaysRemaining: (...args) => mockState.calculateDaysRemaining(...args),
  escapeMarkdownV2: vi.fn((text) => text?.toString().replace?.(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1') || String(text))
}))

vi.mock('../../../../server/services/notificationDeduplicator.js', () => ({
  // Use the mutable reference
  shouldSendNotification: (...args) => mockState.shouldSendNotification(...args),
  logSuccessfulNotification: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../../../server/bot/correlationLogger.js', () => ({
  getCurrentCorrelationId: vi.fn(() => 'test-correlation-id'),
  getOrGenerateCorrelationId: vi.fn(() => 'test-correlation-id')
}))

describe('Proactive Stock Alerts (F5.5-T1)', () => {
  let checkStockAlerts
  let supabase
  let getAllUsersWithTelegram

  beforeEach(async () => {
    // Reset the mock functions in the mutable state
    mockState.calculateDaysRemaining = vi.fn()
    mockState.shouldSendNotification = vi.fn()
    vi.clearAllMocks()

    // Import the mocked modules
    const { getAllUsersWithTelegram: mockGetUsers } = await import('../../../../server/services/protocolCache.js')
    getAllUsersWithTelegram = mockGetUsers
    getAllUsersWithTelegram.mockResolvedValue([
      { user_id: 'user-test-1', telegram_chat_id: 'chat-test-1' }
    ])

    const { supabase: mockSupabase } = await import('../../../../server/services/supabase.js')
    supabase = mockSupabase

    // Import the function under test
    const tasks = await import('../../../../server/bot/tasks.js')
    checkStockAlerts = tasks.checkStockAlerts
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const createMockMedicine = (name, stockQuantity = 100, protocols = null) => ({
    name,
    stock: [{ quantity: stockQuantity }],
    protocols: protocols !== null ? protocols : [{ active: true, time_schedule: ['08:00'], dosage_per_intake: 1 }]
  })

  const setupSupabaseMock = (firstName, medicines) => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { first_name: firstName },
            error: null
          })
        }
      }
      if (table === 'medicines') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: medicines,
            error: null
          })
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      }
    })
  }

  describe('Cenário 1: 14 dias dispara alerta proativo', () => {
    it('deve enviar alerta proativo quando medicamento tem 14 dias restantes', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(14)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('João', [createMockMedicine('Paracetamol', 140)])

      await checkStockAlerts(mockBot, { correlationId: 'test-123' })

      expect(mockBot.sendMessage).toHaveBeenCalled()
      const call = mockBot.sendMessage.mock.calls[0]
      expect(call[1]).toContain('Lembrete')
    })

    it('deve enviar alerta proativo quando medicamento tem 8 dias restantes (limite inferior)', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(8)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Maria', [createMockMedicine('Ibuprofeno', 80)])

      await checkStockAlerts(mockBot, { correlationId: 'test-456' })

      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe('Cenário 2: 7 dias dispara alerta crítico (não proativo)', () => {
    it('deve enviar alerta crítico quando medicamento tem 7 dias restantes', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(7)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Pedro', [createMockMedicine('Amoxicilina', 70)])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).toHaveBeenCalled()
      const call = mockBot.sendMessage.mock.calls[0]
      expect(call[1]).toContain('Estoque')
      expect(call[1]).not.toContain('Lembrete de Reposição')
    })
  })

  describe('Cenário 3: 0 dias dispara crítico', () => {
    it('deve enviar alerta crítico quando medicamento tem 0 dias restantes (estoque zerado)', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(0)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Ana', [createMockMedicine('Omeprazol', 0)])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).toHaveBeenCalled()
      const call = mockBot.sendMessage.mock.calls[0]
      expect(call[1]).toContain('ESTOQUE')
    })

    it('deve enviar alerta crítico quando medicamento tem dias negativos', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(-2)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Carlos', [createMockMedicine('Dipirona', -2)])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe('Cenário 4: Deduplicação funciona separadamente para proativo vs crítico', () => {
    it('deve verificar deduplicação com tipo "proactive_stock_alert" para alertas proativos', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(14)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Lucas', [createMockMedicine('Vitamina D', 140)])

      await checkStockAlerts(mockBot)

      const proactiveCall = mockState.shouldSendNotification.mock.calls.find(
        call => call[2] === 'proactive_stock_alert'
      )
      expect(proactiveCall).toBeDefined()
      expect(proactiveCall[2]).toBe('proactive_stock_alert')
    })

    it('deve verificar deduplicação com tipo "stock_alert" para alertas críticos', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(5)
      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Fernanda', [createMockMedicine('Losartana', 50)])

      await checkStockAlerts(mockBot)

      const criticalCall = mockState.shouldSendNotification.mock.calls.find(
        call => call[2] === 'stock_alert'
      )
      expect(criticalCall).toBeDefined()
      expect(criticalCall[2]).toBe('stock_alert')
    })

    it('deve permitir ambos os tipos de alerta para usuários diferentes', async () => {
      getAllUsersWithTelegram.mockResolvedValue([
        { user_id: 'user-1', telegram_chat_id: 'chat-1' },
        { user_id: 'user-2', telegram_chat_id: 'chat-2' }
      ])

      let userCallCount = 0
      mockState.calculateDaysRemaining.mockImplementation(() => {
        userCallCount++
        return userCallCount <= 1 ? 14 : 5
      })

      mockState.shouldSendNotification.mockResolvedValue(true)

      let profileCallCount = 0
      supabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          profileCallCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { first_name: profileCallCount === 1 ? 'Usuário1' : 'Usuário2' },
              error: null
            })
          }
        }
        if (table === 'medicines') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [createMockMedicine('Med1', 100)],
              error: null
            })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })

      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2)

      const proactiveCalls = mockState.shouldSendNotification.mock.calls.filter(
        call => call[2] === 'proactive_stock_alert'
      )
      const criticalCalls = mockState.shouldSendNotification.mock.calls.filter(
        call => call[2] === 'stock_alert'
      )

      expect(proactiveCalls.length).toBeGreaterThanOrEqual(1)
      expect(criticalCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('não deve enviar alerta proativo quando deduplicação retorna false', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(14)
      mockState.shouldSendNotification.mockResolvedValue(false)
      setupSupabaseMock('Bloqueado', [createMockMedicine('Aspirina', 140)])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    it('não deve enviar alerta crítico quando deduplicação retorna false', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      mockState.calculateDaysRemaining.mockReturnValue(3)
      mockState.shouldSendNotification.mockResolvedValue(false)
      setupSupabaseMock('Bloqueado', [createMockMedicine('Novalgina', 30)])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('Regra de prioridade: Crítico bloqueia proativo', () => {
    it('deve enviar apenas alerta crítico quando ambos os níveis estão presentes', async () => {
      const mockBot = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: '123' }) }
      let medCallCount = 0
      mockState.calculateDaysRemaining.mockImplementation(() => {
        medCallCount++
        if (medCallCount === 1) return 3
        if (medCallCount === 2) return 12
        return 15
      })

      mockState.shouldSendNotification.mockResolvedValue(true)
      setupSupabaseMock('Misto', [
        createMockMedicine('MedCritico', 30),
        createMockMedicine('MedProativo', 120),
        createMockMedicine('MedNormal', 150)
      ])

      await checkStockAlerts(mockBot)

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1)
      const call = mockBot.sendMessage.mock.calls[0]
      expect(call[1]).toContain('Estoque')
      expect(call[1]).not.toContain('Lembrete de Reposição')
    })
  })
})
