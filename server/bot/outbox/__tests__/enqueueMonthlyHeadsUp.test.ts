// enqueueMonthlyHeadsUp.test.ts — spec 105 US-1 (PO-105-1).
// Banco falso que filtra de verdade + repo com a UNIQUE: nem o dedupe nem a outbox são mockados (R-288).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeFakeSupabase, makeUniqueRepo } from './_fakeSupabase.js';

const fake = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../services/supabase.js', () => ({
  get supabase() { return fake.db; },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { enqueueMonthlyHeadsUp } from '../enqueueMonthlyHeadsUp.js';

const KINDS = new Set(['stock_alert', 'stock_expiry_alert', 'supply_reminder']);
// 2026-11-05 10:03 em São Paulo (UTC−3)
const NOW_SP = new Date('2026-11-05T13:03:00Z');

const U_OFF = 'u-dose-only';
const U_STOCK = 'u-stock-ok';
const U_ZERO = 'u-stock-zero';

const monthly = (userId: string, id = `pm-${userId}`) => ({
  id, user_id: userId, medicine_id: `m-${userId}`, interval_days: 30, active: true, paused_at: null, end_date: null,
});
const daily = (userId: string) => ({
  id: `pd-${userId}`, user_id: userId, medicine_id: `md-${userId}`, interval_days: null, active: true, paused_at: null, end_date: null,
});
const inst = (userId: string, protocolId: string, scheduledFor: string, status = 'pending', id?: string) => ({
  id: id ?? `i-${protocolId}-${scheduledFor}`, user_id: userId, protocol_id: protocolId,
  medicine_id: `m-${userId}`, scheduled_for: scheduledFor, expected_dose: 1, status,
});

function seed() {
  fake.db = makeFakeSupabase({
    user_settings: [
      { user_id: U_OFF, timezone: 'America/Sao_Paulo', stock_tracking_enabled: false },
      { user_id: U_STOCK, timezone: 'America/Sao_Paulo', stock_tracking_enabled: true },
      { user_id: U_ZERO, timezone: 'America/Sao_Paulo', stock_tracking_enabled: true },
    ],
    protocols: [monthly(U_OFF), monthly(U_STOCK), monthly(U_ZERO), daily(U_ZERO)],
    stock: [{ id: 'lot', user_id: U_STOCK, medicine_id: `m-${U_STOCK}`, quantity: 3 }],
    dose_instances: [
      // D-2 (07/11 local) — os três casos de estoque
      inst(U_OFF, `pm-${U_OFF}`, '2026-11-07T12:00:00Z'),
      inst(U_STOCK, `pm-${U_STOCK}`, '2026-11-07T12:00:00Z'),
      inst(U_ZERO, `pm-${U_ZERO}`, '2026-11-07T12:00:00Z'),
      // ruído: diário em D-2, mensal em D-1, mensal resolvido em D-2
      inst(U_ZERO, `pd-${U_ZERO}`, '2026-11-07T11:00:00Z'),
      inst(U_OFF, `pm-${U_OFF}`, '2026-11-06T12:00:00Z', 'pending', 'i-d1'),
      inst(U_STOCK, `pm-${U_STOCK}`, '2026-11-07T15:00:00Z', 'taken', 'i-taken'),
    ],
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('enqueueMonthlyHeadsUp (PO-105-1)', () => {
  it('estoque desligado, ligado com saldo e ligado sem saldo ⇒ 1 aviso D-2 cada', async () => {
    seed();
    const repo = makeUniqueRepo();
    const r = await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: NOW_SP });
    expect(r.attempted).toBe(3);
    expect(repo.inserted.map((e) => e.userId).sort()).toEqual([U_OFF, U_STOCK, U_ZERO].sort());
    for (const e of repo.inserted) {
      expect(e.kind).toBe('supply_reminder');
      expect(e.periodKey).toBe('2026-11-05');
      expect(e.subjectId).toMatch(/^i-pm-/);
    }
  });

  it('reexecução no mesmo dia (outro minuto da janela) ⇒ 0 novos pela UNIQUE', async () => {
    seed();
    const repo = makeUniqueRepo();
    await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: NOW_SP });
    const before = repo.inserted.length;
    await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: new Date('2026-11-05T13:07:00Z') });
    expect(repo.inserted.length).toBe(before);
  });

  it('sem o kind no env ⇒ no-op total, nenhuma query', async () => {
    seed();
    const repo = makeUniqueRepo();
    const r = await enqueueMonthlyHeadsUp({ repo, kinds: new Set(['stock_alert', 'stock_expiry_alert']), now: NOW_SP });
    expect(r.attempted).toBe(0);
    expect(fake.db.calls).toHaveLength(0);
  });

  it('fora da janela 10:00–10:09 ⇒ nenhuma leitura de protocolo/dose (C-7)', async () => {
    seed();
    const repo = makeUniqueRepo();
    await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: new Date('2026-11-05T13:10:00Z') });
    expect(fake.db.calls).toEqual(['user_settings']);
    expect(repo.inserted).toHaveLength(0);
  });

  it('TZ ≠ São Paulo perto da meia-noite: D-2 pelo dia LOCAL do usuário (E-6/E-17)', async () => {
    // 10:03 em Tóquio (UTC+9) de 05/11 = 01:03Z. Dose às 00:30 local de 07/11 = 15:30Z de 06/11:
    // em SP ainda seria 06/11 (D-1) — só a data local de Tóquio a põe em D-2.
    fake.db = makeFakeSupabase({
      user_settings: [{ user_id: 'u-jp', timezone: 'Asia/Tokyo', stock_tracking_enabled: true }],
      protocols: [monthly('u-jp')],
      dose_instances: [inst('u-jp', 'pm-u-jp', '2026-11-06T15:30:00Z')],
    });
    const repo = makeUniqueRepo();
    const r = await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: new Date('2026-11-05T01:03:00Z') });
    expect(r.attempted).toBe(1);
    expect(repo.inserted[0].periodKey).toBe('2026-11-05');
  });

  it('`now` injetado decide a janela e o D-2 (C-6, relógio do tick da 116)', async () => {
    seed();
    const repo = makeUniqueRepo();
    // mesmo instante real, relógio do tick = 10:05 de 04/11 ⇒ D-2 seria 06/11 ⇒ só a dose `i-d1`
    const r = await enqueueMonthlyHeadsUp({ repo, kinds: KINDS, now: new Date('2026-11-04T13:05:00Z') });
    expect(r.attempted).toBe(1);
    expect(repo.inserted[0].subjectId).toBe('i-d1');
  });
});
