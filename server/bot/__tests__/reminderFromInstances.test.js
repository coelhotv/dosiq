import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRemindersViaDispatcher } from '../_reminderHelpers.js';

const mockDataQueue = [];

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

vi.mock('../utils/partitionDoses.js', () => ({
  partitionDoses: vi.fn((doses) => {
    if (doses.length === 0) return [];
    const block = {
      kind: 'dose_reminder',
      planId: null,
      planName: null,
      doses,
    };
    return [block];
  }),
}));

const setMockData = (data, error = null) => {
  mockDataQueue.push({ data, error });
};

describe('checkRemindersViaDispatcher — dose_instances path', () => {
  let mockDispatcher;
  const originalEnv = process.env.REMINDER_SOURCE;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataQueue.length = 0;
    mockDispatcher = {
      dispatch: vi.fn(() => Promise.resolve({ success: true })),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalEnv === undefined) {
      delete process.env.REMINDER_SOURCE;
    } else {
      process.env.REMINDER_SOURCE = originalEnv;
    }
  });

  it('novo caminho: sem usuários elegíveis → não dispara', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    setMockData([
      { user_id: 'user1', notification_mode: 'digest', timezone: 'America/Sao_Paulo' },
      { user_id: 'user2', notification_mode: 'digest', timezone: 'America/Sao_Paulo' },
    ]);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('novo caminho: instância devida → dispatcher.dispatch chamado + notified_at atualizado', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    const userSettings = [
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ];
    setMockData(userSettings);

    const doseInstances = [
      {
        id: 'inst-1',
        user_id: 'user1',
        protocol_id: 'proto-1',
        protocol: {
          id: 'proto-1',
          name: 'Losartana',
          dosage_per_intake: 1,
          treatment_plan_id: null,
          medicine_id: 'med-1',
          medicine: { name: 'Losartana', dosage_unit: 'mg' },
          treatment_plan: null,
        },
      },
    ];
    setMockData(doseInstances);

    setMockData({ data: null, error: null });

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        kind: 'dose_reminder',
      })
    );

    expect(mockSupabase.update).toHaveBeenCalledWith({
      notified_at: expect.any(String),
    });
  });

  it('novo caminho: instância com notified_at já setado não aparece (filtro IS NULL)', async () => {
    process.env.REMINDER_SOURCE = 'instances';

    const userSettings = [
      { user_id: 'user1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' },
    ];
    setMockData(userSettings);

    setMockData([]);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('legado: REMINDER_SOURCE não definido → usa protocols (não chama dose_instances)', async () => {
    delete process.env.REMINDER_SOURCE;

    const userSettings = [];
    setMockData(userSettings);

    await checkRemindersViaDispatcher(mockDispatcher, 'corr-123');

    expect(mockSupabase.from).not.toHaveBeenCalledWith('dose_instances');
  });
});
