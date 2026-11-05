// enqueueStockAlertsPurchase.test.ts — spec 105 Fatia A: silêncio do volume (PO-105-G3), eixo de
// COMPRA (PO-105-3/4), exclusão mútua (E-7) e os 4 estados da flag (FR-012).
// Predicado real do core e banco falso que filtra: nada da regra é mockado.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeFakeSupabase, makeUniqueRepo } from './_fakeSupabase.js';

const fake = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../services/supabase.js', () => ({
  get supabase() { return fake.db; },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { enqueueStockAlerts } from '../enqueueStockAlerts.js';

const NOW = new Date('2026-11-05T13:03:00Z'); // 10:03 SP
const STOCK = ['stock_alert', 'stock_expiry_alert'];
const ALL = new Set([...STOCK, 'supply_reminder']);

const med = (name: string) => ({ name, shelf_life_days: null, units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1, archived_at: null });
const protocol = (id: string, userId: string, medicineId: string, over: any = {}) => ({
  id, user_id: userId, medicine_id: medicineId, time_schedule: ['09:00'], dosage_per_intake: 1, intake_unit: null,
  frequency: 'diário', interval_days: null, weekdays: null, active: true, end_date: null, paused_at: null, ...over,
});
const lot = (userId: string, medicineId: string, quantity: number) => ({
  id: `lot-${medicineId}`, user_id: userId, medicine_id: medicineId, quantity, opened_at: null, medicine: med(medicineId),
});
const pending = (userId: string, protocolId: string, medicineId: string, day: number) => ({
  id: `i-${medicineId}-${day}`, user_id: userId, protocol_id: protocolId, medicine_id: medicineId,
  scheduled_for: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z`, expected_dose: 1, status: 'pending',
});
const step = (userId: string, position: number, medicineId: string, status: string, protocolId: string | null, over: any = {}) => ({
  id: `s-${userId}-${position}`, titration_id: `t-${userId}`, user_id: userId, position, medicine_id: medicineId,
  status, protocol_id: protocolId, dose: 1, intake_unit: null, started_at: '2026-10-20T12:00:00Z', duration_days: null, ...over,
});

const settings = (userId: string, over: any = {}) => ({
  user_id: userId, timezone: 'America/Sao_Paulo', notification_mode: 'realtime', stock_tracking_enabled: true, ...over,
});

/** L = escada A→B · M = mensal X com estoque 0 · C = contínuo Y com saldo baixo. */
function seed(extra: { steps?: any[]; stock?: any[]; instances?: any[] } = {}) {
  fake.db = makeFakeSupabase({
    user_settings: [settings('L'), settings('M'), settings('C')],
    protocols: [
      protocol('pA', 'L', 'A'),
      protocol('pX', 'M', 'X', { frequency: 'personalizado', interval_days: 30 }),
      protocol('pY', 'C', 'Y'),
    ],
    stock: extra.stock ?? [lot('L', 'A', 2), lot('M', 'X', 0), lot('C', 'Y', 2)],
    titration_steps: extra.steps ?? [step('L', 0, 'A', 'current', 'pA'), step('L', 1, 'B', 'upcoming', null)],
    dose_instances: extra.instances ?? [
      ...[5, 6, 7, 8, 9].map((d) => pending('L', 'pA', 'A', d)),
      pending('M', 'pX', 'X', 6),
      ...[5, 6, 7].map((d) => pending('C', 'pY', 'Y', d)),
    ],
  });
}

const byKind = (repo: ReturnType<typeof makeUniqueRepo>, kind: string) => repo.inserted.filter((e) => e.kind === kind);

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('enqueueStockAlerts — 105 Fatia A', () => {
  it('silêncio + compra + exclusão mútua (PO-105-G3, PO-105-3, E-7)', async () => {
    seed();
    const repo = makeUniqueRepo();
    const r = await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });

    // volume: só o contínuo (C/Y); escada e mensal calados
    expect(byKind(repo, 'stock_alert').map((e) => e.subjectId)).toEqual(['Y']);
    // compra: escada ⇒ medicamento da PRÓXIMA etapa (B) em D-2 (saldo 2 cobre 05 e 06, D = 07);
    //         mensal com saldo 0 ⇒ X em D-1 (D = 06; o D-2 vai no aviso mensal, AC-2)
    expect(byKind(repo, 'supply_reminder').map((e) => `${e.userId}:${e.subjectId}`).sort()).toEqual(['L:B', 'M:X']);
    expect(r.attemptedPurchase).toBe(2);
    // E-7: nenhum medicamento tem os dois
    const vol = new Set(byKind(repo, 'stock_alert').map((e) => e.subjectId));
    for (const e of byKind(repo, 'supply_reminder')) expect(vol.has(e.subjectId)).toBe(false);
  });

  it.each([
    ['estoque + supply ⇒ volume, validade e compra', ALL, 1, 2],
    ['estoque sem supply ⇒ volume sem compra (o silêncio vale igual)', new Set(STOCK), 1, 0],
    ['supply sem estoque ⇒ no-op (gate aninhado, FR-012)', new Set(['supply_reminder']), 0, 0],
    ['nada ⇒ no-op', new Set<string>(), 0, 0],
  ])('flag: %s', async (_l, kinds, volume, purchase) => {
    seed();
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: kinds as Set<string>, now: NOW });
    expect(byKind(repo, 'stock_alert')).toHaveLength(volume);
    expect(byKind(repo, 'supply_reminder')).toHaveLength(purchase);
  });

  it('próxima etapa já com saldo ⇒ nenhum lembrete (PO-105-3)', async () => {
    seed({ stock: [lot('L', 'A', 2), lot('L', 'B', 5), lot('C', 'Y', 2)] });
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });
    expect(byKind(repo, 'supply_reminder').map((e) => e.subjectId)).toEqual(['X']);
  });

  it('próxima etapa com o MESMO medicamento ⇒ stock_alert normal, sem compra (AC-G3)', async () => {
    seed({ steps: [step('L', 0, 'A', 'current', 'pA'), step('L', 1, 'A', 'upcoming', null)] });
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });
    expect(byKind(repo, 'stock_alert').map((e) => e.subjectId).sort()).toEqual(['A', 'Y']);
    expect(byKind(repo, 'supply_reminder').map((e) => e.subjectId)).toEqual(['X']);
  });

  it('escada sem duration_days e sem doses futuras ⇒ 0 enfileiramento + log (PO-105-4)', async () => {
    seed({ instances: [] });
    const repo = makeUniqueRepo();
    const logger = { info: vi.fn(), error: vi.fn() };
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW, logger });
    expect(byKind(repo, 'supply_reminder')).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      '[enqueueStockAlerts] compra sem data (AC-4) — sem lembrete',
      expect.objectContaining({ userId: 'L', medicineId: 'A' }),
    );
  });

  it('escada com duration_days: D = started_at + duration (menor que o saldo)', async () => {
    // início 20/10 + 18 dias = 07/11 ⇒ D-2 hoje, mesmo com saldo para 30 dias
    seed({
      steps: [step('L', 0, 'A', 'current', 'pA', { duration_days: 18 }), step('L', 1, 'B', 'upcoming', null)],
      stock: [lot('L', 'A', 30), lot('C', 'Y', 2)],
    });
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });
    expect(byKind(repo, 'supply_reminder').map((e) => `${e.userId}:${e.subjectId}`)).toContain('L:B');
  });

  it('usuário só-doses não recebe lembrete de compra (FR-014)', async () => {
    seed();
    fake.db.tables.user_settings = [settings('L', { stock_tracking_enabled: false }), settings('M'), settings('C')];
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });
    expect(byKind(repo, 'supply_reminder').map((e) => e.userId)).toEqual(['M']);
  });

  it('reexecução na janela ⇒ 0 novos (UNIQUE)', async () => {
    seed();
    const repo = makeUniqueRepo();
    await enqueueStockAlerts({ repo, kinds: ALL, now: NOW });
    const n = repo.inserted.length;
    await enqueueStockAlerts({ repo, kinds: ALL, now: new Date('2026-11-05T13:08:00Z') });
    expect(repo.inserted.length).toBe(n);
  });
});
