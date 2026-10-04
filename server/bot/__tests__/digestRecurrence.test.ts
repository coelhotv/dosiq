// digestRecurrence.test.ts — spec 088: o digest decide "tem dose hoje" pelo motor do core, pelas DUAS
// entradas (builder da outbox e cron via dispatcher — RC3 E-5), com o dia no fuso da usuária.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FREQUENCIES, isProtocolActiveOnDate } from '@dosiq/core';
import { createFakeSupabase } from './_fakeSupabase.js';

const tables: Record<string, any[]> = {};
const fake = createFakeSupabase(tables);

vi.mock('../../services/supabase.js', () => ({ supabase: { from: (t: string) => fake.from(t) } }));
vi.mock('../../services/notificationDeduplicator.js', () => ({ shouldSendNotification: vi.fn(async () => true) }));

const { buildDailyDigestData, runDailyDigestViaDispatcher } = await import('../reminders/dailyDigest.js');

const DATES = Array.from({ length: 14 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
// 15:00Z = 12:00 em SP.
const atSpNoon = (d: string) => new Date(`${d}T15:00:00Z`);
// 23:30 em SP de 10/05 = 11:30 de 11/05 em Tóquio.
const SP_2330_MAY10 = new Date('2026-05-11T02:30:00Z');

function protocol(over: Record<string, any> = {}) {
  return {
    id: 'p1', user_id: 'user-1', name: 'Losartana', active: true,
    start_date: '2026-05-01', end_date: null, time_schedule: ['08:00'], dosage_per_intake: 1,
    weekdays: ['segunda', 'quarta'], interval_days: null, frequency: 'diário',
    medicine: { name: 'Losartana', dosage_unit: 'mg' },
    ...over,
  };
}

function settings(over: Record<string, any> = {}) {
  return {
    user_id: 'user-1', notification_mode: 'digest_morning', digest_time: '12:00',
    timezone: 'America/Sao_Paulo', display_name: 'Ana', ...over,
  };
}

async function viaOutbox() {
  const data = await buildDailyDigestData('user-1');
  return data?.medicines.length ?? 0;
}

async function viaCron() {
  const dispatcher = { dispatch: vi.fn(async (_a: any) => ({ success: true })) };
  await runDailyDigestViaDispatcher(dispatcher, 'corr');
  return dispatcher.dispatch.mock.calls.map((c) => c[0].data.medicines.length);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  tables.protocols = [];
  tables.user_settings = [settings()];
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.clearAllTimers();
});

const cases = [
  ...[...FREQUENCIES].filter((f) => f !== 'intervalo_dias').map((frequency) => ({ frequency, interval_days: null })),
  { frequency: 'intervalo_dias', interval_days: 3 },
  { frequency: 'intervalo_dias', interval_days: 30 },
];

describe('digest × motor do core — tz SP, 14 dias (PO-5, PO-2)', () => {
  it.each(cases)('$frequency (N=$interval_days) pelas duas entradas', async ({ frequency, interval_days }) => {
    const p = protocol({ frequency, interval_days });
    tables.protocols = [p];
    for (const d of DATES) {
      vi.setSystemTime(atSpNoon(d));
      const expected = isProtocolActiveOnDate(p, d) ? 1 : 0;
      expect([d, await viaOutbox()]).toEqual([d, expected]);
      expect([d, await viaCron()]).toEqual([d, [expected]]);
    }
  });

  it('não inclui tratamento encerrado ontem', async () => {
    vi.setSystemTime(atSpNoon('2026-05-10'));
    tables.protocols = [protocol({ end_date: '2026-05-09' })];
    expect(await viaOutbox()).toBe(0);
    expect(await viaCron()).toEqual([0]);
  });
});

describe('digest no fuso da usuária — Asia/Tokyo às 23:30 de SP', () => {
  beforeEach(() => {
    vi.setSystemTime(SP_2330_MAY10);
    tables.user_settings = [settings({ timezone: 'Asia/Tokyo', digest_time: '11:30' })];
  });

  it('PO-4: dia da semana e data vêm do dia de Tóquio (alternado: 11/05 é dia de dose, 10/05 não)', async () => {
    tables.protocols = [protocol({ frequency: 'dias_alternados' })];
    expect(await viaOutbox()).toBe(1);
    expect(await viaCron()).toEqual([1]);
  });

  it('PO-4: semanal de segunda casa na segunda de Tóquio (11/05)', async () => {
    tables.protocols = [protocol({ frequency: 'semanal', weekdays: ['segunda'] })];
    expect(await viaOutbox()).toBe(1);
    expect(await viaCron()).toEqual([1]);
  });

  it('PO-7: tratamento que começa hoje em Tóquio entra, com SP ainda no dia anterior', async () => {
    tables.protocols = [protocol({ start_date: '2026-05-11' })];
    expect(await viaOutbox()).toBe(1);
    expect(await viaCron()).toEqual([1]);
  });

  it('tratamento encerrado ontem em Tóquio (= hoje em SP) não entra', async () => {
    tables.protocols = [protocol({ end_date: '2026-05-10' })];
    expect(await viaOutbox()).toBe(0);
    expect(await viaCron()).toEqual([0]);
  });
});
