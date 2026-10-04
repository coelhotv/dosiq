// hojeRecurrence.test.ts — spec 088 (PO-5, PO-2): o /hoje decide "tem dose hoje" pelo mesmo motor do
// core, para cada valor do enum de frequência, em 14 dias com relógio de São Paulo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FREQUENCIES, isProtocolActiveOnDate } from '@dosiq/core';
import { createFakeSupabase } from './_fakeSupabase.js';

const tables: Record<string, any[]> = {};
const fake = createFakeSupabase(tables);

vi.mock('../../services/supabase.js', () => ({ supabase: { from: (t: string) => fake.from(t) } }));
vi.mock('../../services/userService.js', () => ({ getUserIdByChatId: vi.fn(async () => 'user-1') }));

const { handleHoje } = await import('../commands/hoje.js');

const msg = { chat: { id: 1 } };
// 2026-05-01 é sexta; 15:00Z = 12:00 em SP.
const DATES = Array.from({ length: 14 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
const atSpNoon = (d: string) => new Date(`${d}T15:00:00Z`);

function protocol(over: Record<string, any> = {}) {
  return {
    id: 'p1', user_id: 'user-1', name: 'Losartana', active: true,
    start_date: '2026-05-01', end_date: null, time_schedule: ['08:00'], dosage_per_intake: 1,
    weekdays: ['segunda', 'quarta'], interval_days: null, frequency: 'diário',
    medicine: { name: 'Losartana', dosage_unit: 'mg' },
    ...over,
  };
}

async function runHoje() {
  const bot = { sendMessage: vi.fn(async (_c: number, _t: string, _o?: unknown) => ({})) };
  await handleHoje(bot, msg);
  return String(bot.sendMessage.mock.calls[0][1]);
}

const listed = (text: string) => /Losartana/.test(text);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  tables.protocols = [];
  tables.medicine_logs = [];
  tables.user_settings = [{ user_id: 'user-1', timezone: 'America/Sao_Paulo' }];
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('/hoje × motor do core — tz SP, 14 dias (PO-5)', () => {
  const cases = [
    ...[...FREQUENCIES].filter((f) => f !== 'intervalo_dias').map((frequency) => ({ frequency, interval_days: null })),
    { frequency: 'intervalo_dias', interval_days: 3 },
    { frequency: 'intervalo_dias', interval_days: 30 },
  ];

  it.each(cases)('$frequency (N=$interval_days)', async ({ frequency, interval_days }) => {
    const p = protocol({ frequency, interval_days });
    tables.protocols = [p];
    for (const d of DATES) {
      vi.setSystemTime(atSpNoon(d));
      const text = await runHoje();
      expect([d, listed(text)]).toEqual([d, isProtocolActiveOnDate(p, d)]);
    }
  });
});

describe('/hoje — período do tratamento (PO-1)', () => {
  it('não lista tratamento encerrado ontem nem que começa amanhã', async () => {
    vi.setSystemTime(atSpNoon('2026-05-10'));
    tables.protocols = [
      protocol({ id: 'ended', name: 'Losartana', end_date: '2026-05-09' }),
      protocol({ id: 'future', name: 'Losartana', start_date: '2026-05-11' }),
    ];
    const text = await runHoje();
    expect(listed(text)).toBe(false);
    expect(text).toMatch(/Progresso: 0\/0/);
  });

  it('lista tratamento cujo último dia é hoje', async () => {
    vi.setSystemTime(atSpNoon('2026-05-10'));
    tables.protocols = [protocol({ end_date: '2026-05-10' })];
    expect(listed(await runHoje())).toBe(true);
  });
});

describe('/hoje no fuso da usuária — Asia/Tokyo às 23:30 de SP (PO-6)', () => {
  beforeEach(() => {
    // 23:30 de 10/05 em SP = 11:30 de 11/05 em Tóquio.
    vi.setSystemTime(new Date('2026-05-11T02:30:00Z'));
    tables.user_settings = [{ user_id: 'user-1', timezone: 'Asia/Tokyo' }];
  });

  it('a dose registrada agora aparece tomada no schedule de Tóquio', async () => {
    tables.protocols = [protocol({ time_schedule: ['11:00'] })];
    tables.medicine_logs = [{ user_id: 'user-1', protocol_id: 'p1', taken_at: '2026-05-11T02:30:00.000Z' }];
    const text = await runHoje();
    expect(text).toMatch(/11\/05\/2026/);
    expect(text).toMatch(/✅ 11:00/);
    expect(text).toMatch(/Progresso: 1\/1/);
  });

  it('log de ontem em Tóquio (hoje em SP) não conta como tomada', async () => {
    // Só o filtro de DIA decide aqui: o log é das 23:00 de Tóquio, na janela de 3h do horário 23:00,
    // mas de 10/05 em Tóquio (14:00Z = 11:00 de 10/05 em SP, que ainda é "hoje" em SP).
    tables.protocols = [protocol({ time_schedule: ['23:00'] })];
    tables.medicine_logs = [{ user_id: 'user-1', protocol_id: 'p1', taken_at: '2026-05-10T14:00:00.000Z' }];
    expect(await runHoje()).toMatch(/Progresso: 0\/1/);
  });

  it('timezone ausente cai em SP', async () => {
    tables.user_settings = [];
    tables.protocols = [protocol()];
    expect(await runHoje()).toMatch(/10\/05\/2026/);
  });
});
