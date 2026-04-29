/**
 * Proactive Stock Alerts — atualizado para ADR-030 (NotificationDispatcher)
 *
 * Mudanças arquiteturais vs versão anterior:
 * - checkStockAlerts agora delega para checkStockAlertsViaDispatcher
 * - Requer options.notificationDispatcher em vez de chamar bot.sendMessage
 * - Cálculo de dias feito inline (qty / dailyConsumption); sem calculateDaysRemaining
 * - Threshold único: daysRemaining < 7 → dispara alerta (sem separação proativo/crítico)
 * - Queries bulk: user_settings → protocols → stock (sem N+1)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Mocks de módulos ---

vi.mock('../../../../../../server/services/supabase.js', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../../../../../server/bot/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('../../../../../../server/services/protocolCache.js', () => ({
  getActiveProtocols: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../../../../server/services/notificationDeduplicator.js', () => ({
  shouldSendNotification: vi.fn().mockResolvedValue(true),
  logSuccessfulNotification: vi.fn().mockResolvedValue(true),
  shouldSendGroupedNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../../../../server/bot/correlationLogger.js', () => ({
  getCurrentCorrelationId: vi.fn(() => 'test-correlation-id'),
}))

vi.mock('../../../../../../server/services/deadLetterQueue.js', () => ({
  ErrorCategories: { TELEGRAM: 'telegram', DATABASE: 'database' },
}))

vi.mock('../../../../../../server/utils/formatters.js', () => ({
  escapeMarkdownV2: vi.fn((t) => String(t ?? '')),
  calculateDaysRemaining: vi.fn(),
}))

vi.mock('../../../../../../server/utils/timezone.js', () => ({
  getCurrentTimeInTimezone: vi.fn(() => '09:00'),
  getCurrentDateInTimezone: vi.fn(() => '2025-01-01'),
}))

// --- Helpers ---

const BASE_USER = { user_id: 'user-1', timezone: 'America/Sao_Paulo' }

/** Cria o mock do dispatcher (substitui bot.sendMessage na nova arquitetura) */
function createMockDispatcher() {
  return { dispatch: vi.fn().mockResolvedValue({ success: true }) }
}

/**
 * Configura supabase para retornar:
 * - user_settings → [users]
 * - protocols    → [protocols]  (usados para calcular dailyConsumption)
 * - stock        → [stockItems]
 *
 * Todos os outros fallback retornam vazio.
 */
function setupSupabaseMock(supabase, { users = [BASE_USER], protocols = [], stockItems = [] } = {}) {
  supabase.from.mockImplementation((table) => {
    if (table === 'user_settings') {
      return {
        select: vi.fn().mockResolvedValue({ data: users, error: null }),
      }
    }
    if (table === 'protocols') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: protocols, error: null }),
      }
    }
    if (table === 'stock') {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: stockItems, error: null }),
      }
    }
    // Fallback genérico
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })
}

/** Cria um item de estoque com consumo calculável */
function makeStockItem(userId, medicineId, quantity, medicineName = 'Medicamento') {
  return { user_id: userId, medicine_id: medicineId, quantity, medicine: { name: medicineName } }
}

/** Cria um protocolo com consumo diário controlado */
function makeProtocol(userId, medicineId, { intakesPerDay = 1, dosagePerIntake = 10 } = {}) {
  return {
    user_id: userId,
    medicine_id: medicineId,
    active: true,
    time_schedule: Array(intakesPerDay).fill('08:00'),
    dosage_per_intake: dosagePerIntake,
  }
}

// --- Suite ---

describe('Stock Alerts via Dispatcher (ADR-030)', () => {
  let checkStockAlerts
  let supabase

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../../../../server/services/supabase.js')
    supabase = mod.supabase
    const tasks = await import('../../../../../../server/bot/tasks.js')
    checkStockAlerts = tasks.checkStockAlerts
  })

  afterEach(() => vi.clearAllMocks())

  // ---- Cenário 1: alerta disparado (daysRemaining < 7) ----

  describe('Alerta disparado quando estoque < 7 dias', () => {
    it('deve disparar via dispatcher quando restam 6 dias', async () => {
      const dispatcher = createMockDispatcher()
      // qty=60, dailyConsumption=10 → 6 dias → < 7 → alerta
      setupSupabaseMock(supabase, {
        stockItems: [makeStockItem('user-1', 'med-1', 60, 'Paracetamol')],
        protocols: [makeProtocol('user-1', 'med-1', { intakesPerDay: 1, dosagePerIntake: 10 })],
      })

      await checkStockAlerts({}, { correlationId: 'test-1', notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).toHaveBeenCalledOnce()
      const call = dispatcher.dispatch.mock.calls[0][0]
      expect(call.userId).toBe('user-1')
      expect(call.kind).toBe('stock_alert')
      expect(call.data.daysRemaining).toBe(6)
    })

    it('deve disparar quando restam 0 dias (estoque zerado)', async () => {
      const dispatcher = createMockDispatcher()
      setupSupabaseMock(supabase, {
        stockItems: [makeStockItem('user-1', 'med-1', 0, 'Omeprazol')],
        protocols: [makeProtocol('user-1', 'med-1', { intakesPerDay: 1, dosagePerIntake: 10 })],
      })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).toHaveBeenCalled()
    })
  })

  // ---- Cenário 2: sem alerta quando estoque suficiente ----

  describe('Sem alerta quando estoque >= 7 dias', () => {
    it('não deve disparar quando restam exatamente 7 dias', async () => {
      const dispatcher = createMockDispatcher()
      // qty=70, dailyConsumption=10 → 7 dias → não alerta (threshold: < 7)
      setupSupabaseMock(supabase, {
        stockItems: [makeStockItem('user-1', 'med-1', 70, 'Ibuprofeno')],
        protocols: [makeProtocol('user-1', 'med-1', { intakesPerDay: 1, dosagePerIntake: 10 })],
      })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).not.toHaveBeenCalled()
    })

    it('não deve disparar quando restam 14 dias', async () => {
      const dispatcher = createMockDispatcher()
      setupSupabaseMock(supabase, {
        stockItems: [makeStockItem('user-1', 'med-1', 140, 'Vitamina D')],
        protocols: [makeProtocol('user-1', 'med-1', { intakesPerDay: 1, dosagePerIntake: 10 })],
      })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).not.toHaveBeenCalled()
    })
  })

  // ---- Cenário 3: edge cases ----

  describe('Edge cases', () => {
    it('não deve disparar se não houver protocolos ativos (consumo = 0)', async () => {
      const dispatcher = createMockDispatcher()
      setupSupabaseMock(supabase, {
        stockItems: [makeStockItem('user-1', 'med-1', 10, 'Amoxicilina')],
        protocols: [], // sem protocolo → dailyConsumption = 0 → skip
      })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).not.toHaveBeenCalled()
    })

    it('não deve lançar erro quando notificationDispatcher não é fornecido (early return seguro)', async () => {
      setupSupabaseMock(supabase, { users: [BASE_USER], stockItems: [], protocols: [] })

      await expect(
        checkStockAlerts({}, { correlationId: 'no-dispatcher' })
      ).resolves.not.toThrow()
    })

    it('não deve disparar quando não há usuários em user_settings', async () => {
      const dispatcher = createMockDispatcher()
      setupSupabaseMock(supabase, { users: [], stockItems: [], protocols: [] })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch).not.toHaveBeenCalled()
    })

    it('deve disparar uma vez por medicamento com estoque crítico (múltiplos medicamentos)', async () => {
      const dispatcher = createMockDispatcher()
      setupSupabaseMock(supabase, {
        stockItems: [
          makeStockItem('user-1', 'med-1', 50, 'MedCritico'),  // 5 dias → alerta
          makeStockItem('user-1', 'med-2', 200, 'MedNormal'),  // 20 dias → ok
        ],
        protocols: [
          makeProtocol('user-1', 'med-1', { intakesPerDay: 1, dosagePerIntake: 10 }),
          makeProtocol('user-1', 'med-2', { intakesPerDay: 1, dosagePerIntake: 10 }),
        ],
      })

      await checkStockAlerts({}, { notificationDispatcher: dispatcher })

      expect(dispatcher.dispatch.mock.calls[0][0].data.medicineName).toBe('MedCritico')
    })
  })
})
