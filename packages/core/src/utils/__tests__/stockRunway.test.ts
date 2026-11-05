import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isStockRunwayAlertExpected,
  computeSupplyDate,
  type RunwayProtocol,
  type RunwayStep,
  type RunwayInstance,
  type RunwayStock,
} from '../stockRunway'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const MED_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const MED_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const P1 = 'p1'
const P2 = 'p2'
const TZ = 'America/Sao_Paulo'

const proto = (over: Partial<RunwayProtocol> = {}): RunwayProtocol => ({
  id: P1,
  medicine_id: MED_A,
  frequency: 'personalizado',
  interval_days: 30,
  intake_unit: null,
  dosage_per_intake: 1,
  ...over,
})

const step = (over: Partial<RunwayStep> = {}): RunwayStep => ({
  titration_id: 't1',
  position: 0,
  medicine_id: MED_A,
  status: 'current',
  protocol_id: P1,
  dose: 1,
  intake_unit: null,
  started_at: null,
  duration_days: null,
  ...over,
})

describe('isStockRunwayAlertExpected (FR-G1..G3)', () => {
  it.each([
    ['mensal sozinho ⇒ silêncio', [proto()], [], false],
    ['mensal + diário ⇒ alerta', [proto(), proto({ id: P2, frequency: 'diário', interval_days: null })], [], true],
    ['interval_days NULL ⇒ alerta (INV-2)', [proto({ interval_days: null })], [], true],
    ['interval_days 0 ⇒ alerta (INV-2)', [proto({ interval_days: 0 })], [], true],
    ['interval_days 27 ⇒ alerta', [proto({ interval_days: 27 })], [], true],
    ['sem protocolo ⇒ alerta (fail-safe)', [], [], true],
    [
      'etapa current com próxima de OUTRO medicamento ⇒ silêncio',
      [proto({ frequency: 'diário', interval_days: null })],
      [step(), step({ position: 1, medicine_id: MED_B, status: 'upcoming', protocol_id: null })],
      false,
    ],
    [
      'pending_confirmation com troca ⇒ silêncio',
      [proto({ frequency: 'diário', interval_days: null })],
      [step({ status: 'pending_confirmation' }), step({ position: 1, medicine_id: MED_B, status: 'upcoming', protocol_id: null })],
      false,
    ],
    [
      'próxima etapa com buraco de posição (C-3) ⇒ ainda acha a seguinte',
      [proto({ frequency: 'diário', interval_days: null })],
      [step(), step({ position: 3, medicine_id: MED_B, status: 'upcoming', protocol_id: null })],
      false,
    ],
    [
      'próxima etapa do MESMO medicamento ⇒ alerta',
      [proto({ frequency: 'diário', interval_days: null })],
      [step(), step({ position: 1, status: 'upcoming', protocol_id: null })],
      true,
    ],
    [
      'última etapa ⇒ alerta',
      [proto({ frequency: 'diário', interval_days: null })],
      [step()],
      true,
    ],
    [
      'etapa vigente sem protocol_id ⇒ alerta (INV-6 da 103)',
      [proto({ frequency: 'diário', interval_days: null })],
      [step({ protocol_id: null }), step({ position: 1, medicine_id: MED_B, status: 'upcoming', protocol_id: null })],
      true,
    ],
    [
      'escada de passagem + outro protocolo diário do mesmo remédio ⇒ alerta',
      [proto({ frequency: 'diário', interval_days: null }), proto({ id: P2, frequency: 'diário', interval_days: null })],
      [step(), step({ position: 1, medicine_id: MED_B, status: 'upcoming', protocol_id: null })],
      true,
    ],
  ])('%s', (_label, protocols, steps, expected) => {
    expect(isStockRunwayAlertExpected(MED_A, protocols as RunwayProtocol[], steps as RunwayStep[])).toBe(expected)
  })
})

const inst = (date: string, over: Partial<RunwayInstance> = {}): RunwayInstance => ({
  id: `i-${date}`,
  protocol_id: P1,
  medicine_id: MED_A,
  // 09:00 local em SP (UTC−3) = 12:00Z
  scheduled_for: `${date}T12:00:00Z`,
  expected_dose: 1,
  status: 'pending',
  ...over,
})

const solid = (qty: number): RunwayStock => ({ qty, dosage_unit: 'mg', units_per_ml: null, dosage_per_pill: null })

// eslint-disable-next-line no-restricted-syntax -- instante absoluto de teste (meio-dia SP)
const NOW = new Date('2026-11-05T15:00:00Z')

describe('computeSupplyDate — esparso (FR-003)', () => {
  it('saldo 0 ⇒ D = próxima dose', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07'), inst('2026-12-07')],
      stocks: { [MED_A]: solid(0) }, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'due', date: '2026-11-07', medicineId: MED_A, reason: 'sparse' })
  })

  it('saldo cobre 1 dose ⇒ D = 2ª dose', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07'), inst('2026-12-07')],
      stocks: { [MED_A]: solid(1) }, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-12-07' })
  })

  it('saldo cobre tudo que está materializado ⇒ covered', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07'), inst('2026-12-07')],
      stocks: { [MED_A]: solid(5) }, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'covered' })
  })

  it('sem linha de estoque ⇒ saldo 0', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07')], stocks: {}, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-11-07' })
  })

  it('dose já resolvida não consome nem define D (FR-015)', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07', { status: 'taken' }), inst('2026-12-07')],
      stocks: { [MED_A]: solid(0) }, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-12-07' })
  })

  it('expected_dose 0/NULL não consome', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto()], steps: [],
      instances: [inst('2026-11-07', { expected_dose: 0 }), inst('2026-11-20', { expected_dose: null }), inst('2026-12-07')],
      stocks: { [MED_A]: solid(0) }, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-12-07' })
  })

  it('não elegível (diário) ⇒ not_eligible', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [proto({ frequency: 'diário', interval_days: null })], steps: [],
      instances: [inst('2026-11-07')], stocks: {}, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'not_eligible' })
  })

  it('data local na TZ do usuário perto da meia-noite (E-6)', () => {
    // 02:30Z do dia 8 = 23:30 do dia 7 em SP, mas 11:30 do dia 8 em Tóquio
    const i = inst('2026-11-08', { scheduled_for: '2026-11-08T02:30:00Z' })
    const base = { medicineId: MED_A, protocols: [proto()], steps: [], instances: [i], stocks: {}, now: NOW }
    expect(computeSupplyDate({ ...base, tz: 'America/Sao_Paulo' })).toMatchObject({ date: '2026-11-07' })
    expect(computeSupplyDate({ ...base, tz: 'Asia/Tokyo' })).toMatchObject({ date: '2026-11-08' })
  })

  it('líquido: dose em UI convertida p/ ml antes de comparar (C-2)', () => {
    // 100 UI/ml, dose 20 UI = 0,2 ml; saldo 0,3 ml cobre 1 dose
    const stocks = { [MED_A]: { qty: 0.3, dosage_unit: 'ui/ml', units_per_ml: 100, dosage_per_pill: null } }
    const p = proto({ intake_unit: 'UI', dosage_per_intake: 20 })
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [p], steps: [],
      instances: [inst('2026-11-07', { expected_dose: 20 }), inst('2026-12-07', { expected_dose: 20 })],
      stocks, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-12-07' })
  })
})

describe('computeSupplyDate — escada com troca (FR-003, PO-105-3/4)', () => {
  const daily = proto({ frequency: 'diário', interval_days: null })
  const days = (from: number, n: number) =>
    Array.from({ length: n }, (_, k) => inst(`2026-11-${String(from + k).padStart(2, '0')}`))
  const nextB = step({ position: 1, medicine_id: MED_B, status: 'upcoming', protocol_id: null, dose: 1 })

  it('só saldo: D = 1ª dose não coberta; compra = medicamento da próxima etapa', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily], steps: [step(), nextB],
      instances: days(6, 10), stocks: { [MED_A]: solid(3) }, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'due', date: '2026-11-09', medicineId: MED_B, reason: 'step_switch' })
  })

  it('só duration_days: D = started_at + duration_days', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily],
      steps: [step({ started_at: '2026-10-20T12:00:00Z', duration_days: 21 }), nextB],
      instances: [], stocks: { [MED_A]: solid(50) }, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ status: 'due', date: '2026-11-10', medicineId: MED_B })
  })

  it('ambos: vence o menor', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily],
      steps: [step({ started_at: '2026-10-20T12:00:00Z', duration_days: 21 }), nextB],
      instances: days(6, 10), stocks: { [MED_A]: solid(1) }, tz: TZ, now: NOW,
    })
    expect(r).toMatchObject({ date: '2026-11-07' })
  })

  it('próxima etapa já com saldo para a 1ª dose ⇒ covered', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily], steps: [step(), nextB],
      instances: days(6, 10), stocks: { [MED_A]: solid(3), [MED_B]: solid(1) }, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'covered' })
  })

  it('mesmo medicamento na próxima etapa ⇒ not_eligible (stock_alert normal)', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily],
      steps: [step(), step({ position: 1, status: 'upcoming', protocol_id: null })],
      instances: days(6, 10), stocks: {}, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'not_eligible' })
  })

  it('sem duration_days e sem doses futuras ⇒ no_date (AC-4, sem data inventada)', () => {
    const r = computeSupplyDate({
      medicineId: MED_A, protocols: [daily], steps: [step(), nextB],
      instances: [], stocks: { [MED_A]: solid(0) }, tz: TZ, now: NOW,
    })
    expect(r).toEqual({ status: 'no_date' })
  })
})
