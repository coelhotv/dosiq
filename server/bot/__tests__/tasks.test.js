import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  runDailyDigest, 
  runDailyAdherenceReport, 
  checkStockAlerts 
} from '../tasks.js';
// import { supabase } from '../../services/supabase.js';

const mockDataQueue = [];

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
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

// Helper to set mock results in order
const setMockData = (data, error = null) => {
  mockDataQueue.push({ data, error });
};



vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../services/notificationDeduplicator.js', () => ({
  shouldSendNotification: vi.fn(() => Promise.resolve(true)),
  shouldSendGroupedNotification: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../utils/timezone.js', () => ({
  getCurrentTimeInTimezone: vi.fn(() => '08:00'),
  getCurrentDateInTimezone: vi.fn(() => '2026-04-29'),
}));

describe('Tasks Service - Wave 11 Refactor', () => {
  let mockDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataQueue.length = 0;
    mockDispatcher = {
      dispatch: vi.fn(() => Promise.resolve({ success: true })),
    };
  });


  describe('runDailyDigest', () => {
    it('should correctly build the Morning Planner message', async () => {
      // Mock user settings
      setMockData([{ user_id: 'user1', display_name: 'Test User', digest_time: '08:00', timezone: 'America/Sao_Paulo' }]);

      // Mock protocols
      setMockData([
        { 
          user_id: 'user1', 
          name: 'Med 1', 
          time_schedule: ['08:00', '20:00'], 
          medicine: { name: 'Aspirina', dosage_unit: 'pill' },
          dosage_per_intake: 1
        }
      ]);

      // Mock logs (yesterday)
      setMockData([{ id: 'log1' }]); // 1 dose taken yesterday

      await runDailyDigest({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'daily_digest',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            greeting: 'Bom dia',
            yesterdayPercentage: 50, // 1 taken / 2 scheduled
            scheduleCount: 2,
          }),
        }),
      }));
    });
  });

  describe('runDailyAdherenceReport', () => {
    it('should generate storytelling based on performance improvement', async () => {
      // Mock user settings (23:00)
      setMockData([{ user_id: 'user1', display_name: 'Test User', digest_time: '23:00', timezone: 'America/Sao_Paulo' }]);

      // Mock current time
      const { getCurrentTimeInTimezone } = await import('../../utils/timezone.js');
      getCurrentTimeInTimezone.mockReturnValue('23:00');

      // Mock protocols
      setMockData([
        { 
          user_id: 'user1', 
          name: 'Med 1', 
          time_schedule: ['08:00', '20:00'], 
          medicine: { name: 'Aspirina' }
        }
      ]);

      // Mock logs (today and yesterday)
      setMockData([
        { taken_at: '2026-04-29T08:05:00Z', protocol_id: 'p1' }, // today
        { taken_at: '2026-04-29T20:10:00Z', protocol_id: 'p1' }, // today (100%)
        { taken_at: '2026-04-28T08:10:00Z', protocol_id: 'p1' }, // yesterday (50%)
      ]);

      await runDailyAdherenceReport({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'adherence_report',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            percentage: 100,
            storytelling: expect.stringContaining('📈 Melhora'),
          }),
        }),
      }));
    });
  });

  describe('checkStockAlerts', () => {
    it('should provide predictive stock alerts (days remaining)', async () => {
      // Mock users
      setMockData([{ user_id: 'user1', timezone: 'America/Sao_Paulo' }]);

      // Mock protocols (consumption calculation)
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', time_schedule: ['08:00', '20:00'], dosage_per_intake: 1 }
      ]);

      // Mock stock
      setMockData([
        { user_id: 'user1', medicine_id: 'med1', quantity: 10, medicine: { name: 'Aspirina' } }
      ]);

      await checkStockAlerts({}, { correlationId: 'test-corr', notificationDispatcher: mockDispatcher });

      // Daily consumption = 2. Stock = 10. Days remaining = 5.
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'stock_alert',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            daysRemaining: 5,
            stockQuantity: 10,
          }),
        }),
      }));
    });
  });

});
