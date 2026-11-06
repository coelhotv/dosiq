// supplyReminderContent.test.ts — spec 105: revalidação NO ENVIO (FR-005, PO-105-2, E-15) e payload
// sem campo de remédio (FR-017). Banco falso que filtra de verdade; predicado e data reais do core.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeFakeSupabase } from './_fakeSupabase.js';

const fake = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../services/supabase.js', () => ({
  get supabase() { return fake.db; },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { buildSupplyReminderContent } from '../supplyReminderContent.js';

const NOW = new Date('2026-11-05T13:20:00Z'); // 10:20 SP (drain depois do enqueue)

const med = (name: string) => ({ name, shelf_life_days: null, units_per_ml: null, dosage_unit: 'mg', dosage_per_pill: 1, archived_at: null });
const protocol = (id: string, userId: string, medicineId: string, over: any = {}) => ({
  id, user_id: userId, medicine_id: medicineId, time_schedule: ['09:00'], dosage_per_intake: 1, intake_unit: null,
  frequency: 'personalizado', interval_days: 30, weekdays: null, active: true, end_date: null, paused_at: null, ...over,
});
const lot = (userId: string, medicineId: string, quantity: number) => ({
  id: `lot-${medicineId}`, user_id: userId, medicine_id: medicineId, quantity, opened_at: null, medicine: med(medicineId),
});
const pending = (id: string, userId: string, protocolId: string, medicineId: string, iso: string, status = 'pending') => ({
  id, user_id: userId, protocol_id: protocolId, medicine_id: medicineId, scheduled_for: iso, expected_dose: 1, status,
});

function seed(over: { tracking?: boolean; stockX?: number; instStatus?: string; protocol?: any } = {}) {
  fake.db = makeFakeSupabase({
    user_settings: [{ user_id: 'M', timezone: 'America/Sao_Paulo', stock_tracking_enabled: over.tracking ?? true }],
    protocols: [protocol('pX', 'M', 'X', over.protocol)],
    stock: over.stockX === undefined ? [] : [lot('M', 'X', over.stockX)],
    titration_steps: [],
    dose_instances: [
      pending('dD1', 'M', 'pX', 'X', '2026-11-06T12:00:00Z'),
      pending('dD2', 'M', 'pX', 'X', '2026-11-07T12:00:00Z', over.instStatus ?? 'pending'),
    ],
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

describe('aviso de dose mensal (subject = dose_instance.id)', () => {
  it('estoque ligado e saldo que não cobre ESTA dose ⇒ linha de compra (AC-2)', async () => {
    // saldo 1 cobre a dose de 06/11; a de 07/11 fica descoberta
    seed({ stockX: 1 });
    const d = await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: NOW });
    expect(d).toEqual({ reason: 'monthly_dose', daysUntil: 2, withPurchaseLine: true, protocolId: 'pX' });
  });

  it('saldo cobre ⇒ sem linha de compra', async () => {
    seed({ stockX: 5 });
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: NOW }))
      .toEqual({ reason: 'monthly_dose', daysUntil: 2, withPurchaseLine: false, protocolId: 'pX' });
  });

  it('estoque DESLIGADO ⇒ aviso sai, sem linha de compra (FR-014, INV-6)', async () => {
    seed({ tracking: false });
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: NOW }))
      .toEqual({ reason: 'monthly_dose', daysUntil: 2, withPurchaseLine: false, protocolId: 'pX' });
  });

  it.each([
    ['dose já resolvida (FR-015)', { instStatus: 'taken' }],
    ['protocolo pausado (E-15)', { protocol: { paused_at: '2026-11-05T12:00:00Z' } }],
    ['protocolo encerrado', { protocol: { end_date: '2026-11-04' } }],
    ['virou cadência < 28 dias (E-15)', { protocol: { interval_days: 7 } }],
  ])('%s ⇒ null (skippedNoContent)', async (_l, over) => {
    seed(over as any);
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: NOW })).toBeNull();
  });

  it('D-1 (recuperação FR-018) ⇒ aviso com "amanhã"', async () => {
    seed({ tracking: false });
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: new Date('2026-11-06T13:20:00Z') }))
      .toEqual({ reason: 'monthly_dose', daysUntil: 1, withPurchaseLine: false, protocolId: 'pX' });
  });

  it('drain no dia da dose (D-0) ⇒ null', async () => {
    seed();
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'dD2', now: new Date('2026-11-07T13:20:00Z') })).toBeNull();
  });

  it('instância de OUTRO usuário não é lida (user_id no filtro)', async () => {
    seed();
    expect(await buildSupplyReminderContent({ userId: 'outro', subjectId: 'dD2', now: NOW })).toBeNull();
  });
});

describe('lembrete de compra (subject = medicine_id) — PO-105-2', () => {
  it('saldo 0, dose amanhã ⇒ compra em D-1', async () => {
    seed({ stockX: 0 });
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'X', now: NOW }))
      .toEqual({ reason: 'monthly_purchase', daysUntil: 1, withPurchaseLine: false, protocolId: 'pX' });
  });

  it('🔴 compra registrada entre o enqueue e o envio ⇒ null (revalida no envio)', async () => {
    seed({ stockX: 0 });
    fake.db.tables.stock = [lot('M', 'X', 1)];
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'X', now: NOW })).toBeNull();
  });

  it('desligou o controle de estoque ⇒ null', async () => {
    seed({ stockX: 0, tracking: false });
    expect(await buildSupplyReminderContent({ userId: 'M', subjectId: 'X', now: NOW })).toBeNull();
  });

  it('payload nunca carrega campo de remédio (FR-017)', async () => {
    seed({ stockX: 0 });
    const d = await buildSupplyReminderContent({ userId: 'M', subjectId: 'X', now: NOW });
    expect(Object.keys(d!).sort()).toEqual(['daysUntil', 'protocolId', 'reason', 'withPurchaseLine']);
  });
});
