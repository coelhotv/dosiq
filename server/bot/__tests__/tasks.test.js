import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  runDailyDigest, 
  runDailyAdherenceReport, 
  checkStockAlerts 
} from '../tasks.js';

// Setup de variáveis de controle de tempo mockado global para simplificar dateUtils
globalThis.__mockTime = '09:00';
globalThis.__mockWeekday = 0;
globalThis.__mockDayOfMonth = 1;

vi.mock('../../utils/dateUtils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCurrentTimeInTimezone: vi.fn(() => {
      return globalThis.__mockTime;
    }),
    getCurrentDatePartsInTimezone: vi.fn(() => {
      return {
        hhmm: globalThis.__mockTime,
        weekday: globalThis.__mockWeekday,
        dayOfMonth: globalThis.__mockDayOfMonth
      };
    })
  };
});

const mockDataQueue = [];

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    // Supabase queries are thenables
    then: vi.fn((onFulfilled) => {
      const result = mockDataQueue.shift() || { data: [], error: null };
      return Promise.resolve(result).then(onFulfilled);
    }),
  };
  return { mockSupabase: m };
});

vi.mock('../../services/supabase.js', () => ({
  supabase: mockSupabase
}));

vi.mock('../doseInstanceScheduler.js', () => ({
  sweepMissedInstances: vi.fn(() => Promise.resolve(0)),
  generateDoseInstances: vi.fn(() => Promise.resolve({ processed: 0, generated: 0 })),
  cleanupPausedProtocols: vi.fn(() => Promise.resolve({ cleaned: 0 }))
}));

// Helper to set mock results in order
const setMockData = (data, error = null) => {
  mockDataQueue.push({ data, error });
};

// Helper to set count results in order (for doseInstanceRepo.countByStatus)
const setMockCount = (count) => {
  mockDataQueue.push({ count, error: null });
};

vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(console.log),
    error: vi.fn((msg, err, ctx) => console.error(msg, err, ctx)),
    warn: vi.fn(console.warn),
    debug: vi.fn(console.log),
  }),
}));

vi.mock('../../services/notificationDeduplicator.js', () => ({
  shouldSendNotification: vi.fn(() => Promise.resolve(true)),
  shouldSendGroupedNotification: vi.fn(() => Promise.resolve(true)),
}));

describe('Tasks Service - Wave 11 Refactor & Phase 3', () => {
  let mockDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataQueue.length = 0;
    mockDispatcher = {
      dispatch: vi.fn(() => Promise.resolve({ success: true })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('runDailyDigest', () => {
    it('should correctly build the Morning Planner message', async () => {
      globalThis.__mockTime = '08:00';
      globalThis.__mockWeekday = 1; // Segunda-feira

      // 1. Mock user settings (notification_mode = digest_morning)
      setMockData([{ user_id: 'user1', display_name: 'Test User', digest_time: '08:00', timezone: 'America/Sao_Paulo', notification_mode: 'digest_morning' }]);

      // 2. Mock active protocols for the user
      setMockData([
        { 
          user_id: 'user1', 
          name: 'Med 1', 
          time_schedule: ['08:00', '20:00'], 
          medicine: { name: 'Aspirina', dosage_unit: 'pill' },
          dosage_per_intake: 1,
          frequency: 'diário',
          active: true
        }
      ]);

      await runDailyDigest({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'user1',
        kind: 'daily_digest',
        data: expect.objectContaining({
          firstName: 'Test User',
          hour: 8,
          pendingCount: 2,
          medicines: expect.arrayContaining([
            expect.objectContaining({ name: 'Aspirina', time: '08:00' }),
            expect.objectContaining({ name: 'Aspirina', time: '20:00' })
          ])
        }),
        context: expect.objectContaining({
          correlationId: 'test-corr'
        })
      });
    });
  });

  describe('runDailyAdherenceReport', () => {
    it('should generate storytelling based on yesterday vs anteontem performance', async () => {
      globalThis.__mockTime = '09:00';
      globalThis.__mockWeekday = 3; // Quarta — dia comum (sem overlap semanal/mensal)
      globalThis.__mockDayOfMonth = 15;

      // 1. Mock user settings (retrieved in runDailyAdherenceReportViaDispatcher)
      setMockData([{ user_id: 'user1', display_name: 'Test User', timezone: 'America/Sao_Paulo', notification_mode: 'active' }]);

      // 2. Mock protocols active query (Filtro 1)
      setMockData([{ id: 'p1' }]);

      // 3. Mock yesterdayCounts (taken=2, missed=0, pending=0, skipped_paused=0, skipped_user=0)
      setMockCount(2); // taken
      setMockCount(0); // missed
      setMockCount(0); // pending
      setMockCount(0); // skipped_paused
      setMockCount(0); // skipped_user

      // 4. Mock beforeYesterdayCounts (taken=1, missed=1, pending=0, skipped_paused=0, skipped_user=0)
      setMockCount(1); // taken
      setMockCount(1); // missed
      setMockCount(0); // pending
      setMockCount(0); // skipped_paused
      setMockCount(0); // skipped_user

      await runDailyAdherenceReport({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'user1',
        kind: 'adherence_report',
        data: expect.objectContaining({
          firstName: 'Test User',
          period: 'ontem',
          percentage: 100,
          taken: 2,
          total: 2,
          comparison: expect.objectContaining({
            previousPercentage: 50,
            deltaPercent: 50,
            trend: 'up'
          })
        }),
        context: expect.objectContaining({
          correlationId: 'test-corr',
          jobType: 'adherence_report'
        })
      });
    });

    // Supressão hierárquica de overlap (decisão PO 2026-06-15): mensal > semanal > diário.
    it('suprime o relatório diário no domingo (cede ao semanal)', async () => {
      globalThis.__mockTime = '09:00';
      globalThis.__mockWeekday = 0; // Domingo
      globalThis.__mockDayOfMonth = 15;

      setMockData([{ user_id: 'user1', display_name: 'Test User', timezone: 'America/Sao_Paulo', notification_mode: 'active' }]);

      await runDailyAdherenceReport({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('suprime o relatório diário no dia 1 (cede ao mensal)', async () => {
      globalThis.__mockTime = '09:00';
      globalThis.__mockWeekday = 3; // Quarta
      globalThis.__mockDayOfMonth = 1;

      setMockData([{ user_id: 'user1', display_name: 'Test User', timezone: 'America/Sao_Paulo', notification_mode: 'active' }]);

      await runDailyAdherenceReport({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('checkStockAlerts', () => {
    it('should provide predictive stock alerts (days remaining)', async () => {
      // 1. Mock user settings
      setMockData([{ user_id: 'user1', timezone: 'America/Sao_Paulo' }]);

      // 2. Mock active protocols
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', time_schedule: ['08:00', '20:00'], dosage_per_intake: 1, frequency: 'diário', active: true }
      ]);

      // 3. Mock stock
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', quantity: 10, medicine: { name: 'Aspirina' } }
      ]);

      await checkStockAlerts({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      // Daily consumption = 2. Stock = 10. Days remaining = 5.
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'user1',
        kind: 'stock_alert',
        data: expect.objectContaining({
          medicineName: 'Aspirina',
          remaining: 10,
          daysRemaining: 5
        }),
        context: expect.objectContaining({
          correlationId: 'test-corr',
          jobType: 'stock_alert_dispatcher'
        })
      });
    });

    // 012 B4 / FR-013c (ADR-067): líquido em UI não pode contar ml÷UI cru.
    it('não dispara alerta para insulina líquida com runway real alto (FR-013c)', async () => {
      setMockData([{ user_id: 'user1', timezone: 'America/Sao_Paulo' }]);
      // Lantus U-100: 10 UI/dia, 1x/dia, diário.
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', time_schedule: ['22:00'], dosage_per_intake: 10, intake_unit: 'UI', frequency: 'diário', active: true }
      ]);
      // Saldo 5,3 ml; densidade U-100 (units_per_ml=100) → 10 UI = 0,10 ml/dia → 53 dias.
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', quantity: 5.3, medicine: { name: 'Lantus', dosage_unit: 'ui/ml', units_per_ml: 100, dosage_per_pill: null } }
      ]);

      await checkStockAlerts({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      // Antes: floor(5,3 ÷ 10 UI) = 0 dias → alerta crítico falso. Agora: 53 dias → silêncio.
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('dispara para líquido realmente baixo exibindo DOSES (não ml cru)', async () => {
      setMockData([{ user_id: 'user1', timezone: 'America/Sao_Paulo' }]);
      // 25 UI/dia, density U-100 → 0,25 ml/dia (exato em binário; sem armadilha de float).
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', time_schedule: ['22:00'], dosage_per_intake: 25, intake_unit: 'UI', frequency: 'diário', active: true }
      ]);
      // Saldo 1,25 ml → 0,25 ml/dia → 5 dias; doses restantes = floor(1,25 ÷ 0,25) = 5.
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', quantity: 1.25, medicine: { name: 'Lantus', dosage_unit: 'ui/ml', units_per_ml: 100, dosage_per_pill: null } }
      ]);

      await checkStockAlerts({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'user1',
        kind: 'stock_alert',
        data: expect.objectContaining({
          medicineName: 'Lantus',
          remaining: 5,          // 5 doses, NÃO 1,25 ml rotulado "doses"
          daysRemaining: 5
        }),
        context: expect.objectContaining({ jobType: 'stock_alert_dispatcher' })
      });
    });
  });
});
