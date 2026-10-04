// legacyReminderRecurrence.test.ts — spec 088: o lembrete legado (REMINDER_SOURCE ≠ instances) decide
// pelo motor do core. Morto em prod (Q-1): este teste é a guarda de rollback, para que voltar a flag
// não ressuscite o motor antigo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FREQUENCIES, isProtocolActiveOnDate } from '@dosiq/core';
import { createFakeSupabase } from './_fakeSupabase.js';

const tables: Record<string, any[]> = {};
const fake = createFakeSupabase(tables);

vi.mock('../../services/supabase.js', () => ({ supabase: { from: (t: string) => fake.from(t) } }));
vi.mock('../../services/notificationDeduplicator.js', () => ({ shouldSendGroupedNotification: vi.fn(async () => true) }));
vi.mock('../../notifications/apns/dispatchLiveActivityStarts.js', () => ({ dispatchLiveActivityStarts: vi.fn() }));
vi.mock('../../notifications/apns/dispatchLiveActivityLifecycle.js', () => ({ dispatchLiveActivityLifecycle: vi.fn() }));
vi.mock('../../notifications/repositories/criticalEventsRepository.js', () => ({
  findInstancesWithAlarmEvidence: vi.fn(async () => new Set()),
  isUserAlarmCapable: vi.fn(async () => false),
}));

const { checkRemindersViaDispatcher } = await import('../reminders/doseReminders.js');

const DATES = Array.from({ length: 14 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
const atSpNoon = (d: string) => new Date(`${d}T15:00:00Z`);
const SP_2330_MAY10 = new Date('2026-05-11T02:30:00Z');

function protocol(over: Record<string, any> = {}) {
  return {
    id: 'p1', user_id: 'user-1', name: 'Losartana', active: true, medicine_id: 'm1',
    start_date: '2026-05-01', end_date: null, time_schedule: ['12:00'], dosage_per_intake: 1,
    weekdays: ['segunda', 'quarta'], interval_days: null, frequency: 'diário',
    treatment_plan_id: null, medicine: { name: 'Losartana', dosage_unit: 'mg' },
    ...over,
  };
}

async function dispatched() {
  const dispatcher = { dispatch: vi.fn(async (_a: any) => ({ success: true })) };
  await checkRemindersViaDispatcher(dispatcher, 'corr');
  return dispatcher.dispatch.mock.calls.length;
}

let prevSource: string | undefined;
beforeEach(() => {
  prevSource = process.env.REMINDER_SOURCE;
  delete process.env.REMINDER_SOURCE;
  vi.useFakeTimers({ toFake: ['Date'] });
  tables.protocols = [];
  tables.user_settings = [{ user_id: 'user-1', timezone: 'America/Sao_Paulo', notification_mode: 'realtime' }];
});

afterEach(() => {
  if (prevSource === undefined) delete process.env.REMINDER_SOURCE;
  else process.env.REMINDER_SOURCE = prevSource;
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.clearAllTimers();
});

const cases = [
  ...[...FREQUENCIES].filter((f) => f !== 'intervalo_dias').map((frequency) => ({ frequency, interval_days: null })),
  { frequency: 'intervalo_dias', interval_days: 3 },
  { frequency: 'intervalo_dias', interval_days: 30 },
];

describe('lembrete legado × motor do core — tz SP, 14 dias (PO-5, PO-2)', () => {
  it.each(cases)('$frequency (N=$interval_days)', async ({ frequency, interval_days }) => {
    const p = protocol({ frequency, interval_days });
    tables.protocols = [p];
    for (const d of DATES) {
      vi.setSystemTime(atSpNoon(d));
      expect([d, await dispatched()]).toEqual([d, isProtocolActiveOnDate(p, d) ? 1 : 0]);
    }
  });
});

describe('lembrete legado no fuso da usuária — Asia/Tokyo às 23:30 de SP', () => {
  beforeEach(() => {
    vi.setSystemTime(SP_2330_MAY10);
    tables.user_settings = [{ user_id: 'user-1', timezone: 'Asia/Tokyo', notification_mode: 'realtime' }];
  });

  it('PO-4: alternado decide pelo dia de Tóquio nos dois eixos (11/05 é dia de dose)', async () => {
    // A hora do lembrete legado segue SP (Non-Goal): o horário agendado é o 23:30 de SP.
    tables.protocols = [protocol({ frequency: 'dias_alternados', time_schedule: ['23:30'] })];
    expect(await dispatched()).toBe(1);
  });

  it('tratamento encerrado ontem em Tóquio (= hoje em SP) não dispara', async () => {
    tables.protocols = [protocol({ end_date: '2026-05-10', time_schedule: ['23:30'] })];
    expect(await dispatched()).toBe(0);
  });
});
