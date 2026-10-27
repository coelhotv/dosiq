// Spec 109 Slice A (T009 · PO-2) — `gate` do tick dentro do ramo instances: cada parte só roda se o
// minuto tem trabalho dela; sem gate, tudo roda como antes. Queries e envio intocados (INV-4).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRemindersViaDispatcher } from '../reminders/doseReminders.js';

const { mockSupabase, la } = vi.hoisted(() => {
  const m: any = {
    from: vi.fn(() => m),
    select: vi.fn(() => m),
    eq: vi.fn(() => m), in: vi.fn(() => m), gte: vi.fn(() => m), lt: vi.fn(() => m),
    is: vi.fn(() => m), not: vi.fn(() => m),
    then: vi.fn((ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)),
  };
  return {
    mockSupabase: m,
    la: {
      starts: vi.fn(async () => ({ processed: 0, sent: 0, skipped: 0, failed: 0 })),
      lifecycle: vi.fn(async () => ({ processed: 0, updated: 0, ended: 0, skipped: 0, failed: 0 })),
    },
  };
});

vi.mock('../../services/supabase.js', () => ({ supabase: mockSupabase }));
vi.mock('../../notifications/apns/dispatchLiveActivityStarts.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  dispatchLiveActivityStarts: la.starts,
}));
vi.mock('../../notifications/apns/dispatchLiveActivityLifecycle.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  dispatchLiveActivityLifecycle: la.lifecycle,
}));
vi.mock('../../bot/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const dispatcher = { dispatch: vi.fn() };
const tables = () => mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
const original = process.env.REMINDER_SOURCE;

beforeEach(() => {
  process.env.REMINDER_SOURCE = 'instances';
});

afterEach(() => {
  if (original === undefined) delete process.env.REMINDER_SOURCE;
  else process.env.REMINDER_SOURCE = original;
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('checkRemindersViaDispatcher — gate do tick', () => {
  it('sem gate: lê usuários e roda as duas partes de LA (comportamento de antes)', async () => {
    await checkRemindersViaDispatcher(dispatcher, 'c1');
    expect(tables()).toContain('user_settings');
    expect(la.starts).toHaveBeenCalledTimes(1);
    expect(la.lifecycle).toHaveBeenCalledTimes(1);
  });

  it('só LA start: nenhuma leitura de usuários/doses, lifecycle pulado', async () => {
    await checkRemindersViaDispatcher(dispatcher, 'c2', { reminders: false, laStart: true, laLifecycle: false });
    expect(tables()).toEqual([]);
    expect(la.starts).toHaveBeenCalledTimes(1);
    expect(la.lifecycle).not.toHaveBeenCalled();
  });

  it('só LA lifecycle: start pulado', async () => {
    await checkRemindersViaDispatcher(dispatcher, 'c3', { reminders: false, laStart: false, laLifecycle: true });
    expect(la.starts).not.toHaveBeenCalled();
    expect(la.lifecycle).toHaveBeenCalledTimes(1);
  });

  it('só lembrete: lê usuários e doses, LA pulada', async () => {
    mockSupabase.then.mockImplementationOnce((ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ user_id: 'u1', notification_mode: 'realtime', timezone: 'America/Sao_Paulo' }], error: null }).then(ok));
    await checkRemindersViaDispatcher(dispatcher, 'c4', { reminders: true, laStart: false, laLifecycle: false });
    expect(tables()).toEqual(expect.arrayContaining(['user_settings', 'dose_instances']));
    expect(la.starts).not.toHaveBeenCalled();
    expect(la.lifecycle).not.toHaveBeenCalled();
  });
});
