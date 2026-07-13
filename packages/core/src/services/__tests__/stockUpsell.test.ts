// stockUpsell.test.ts — spec 044 T018 (FR-008): gatilho do card de upsell.

import { describe, it, expect } from 'vitest'
import {
  UPSELL_MIN_DOSES,
  UPSELL_MIN_STREAK_DAYS,
  computeDoseStreakDays,
  evaluateStockUpsell,
} from '../stockUpsell'

const TODAY = '2026-07-12'

/** Dias locais consecutivos terminando em `end` (do mais recente pro mais antigo). */
function consecutiveDays(end: string, count: number): string[] {
  const [y, m, d] = end.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d, 12) - i * 24 * 60 * 60 * 1000)
    return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
  })
}

describe('computeDoseStreakDays', () => {
  it('sem doses → 0', () => {
    expect(computeDoseStreakDays([], TODAY)).toBe(0)
  })

  it('conta dias consecutivos terminando hoje', () => {
    expect(computeDoseStreakDays(consecutiveDays(TODAY, 5), TODAY)).toBe(5)
  })

  it('aceita âncora em ONTEM (ainda não registrou a dose de hoje)', () => {
    expect(computeDoseStreakDays(consecutiveDays('2026-07-11', 5), TODAY)).toBe(5)
  })

  it('sequência que terminou há uma semana NÃO conta (streak ancorado no presente)', () => {
    expect(computeDoseStreakDays(consecutiveDays('2026-07-05', 20), TODAY)).toBe(0)
  })

  it('buraco quebra a sequência', () => {
    // hoje, ontem, [buraco], anteontem-1
    expect(computeDoseStreakDays(['2026-07-12', '2026-07-11', '2026-07-09'], TODAY)).toBe(2)
  })

  it('doses repetidas no mesmo dia colapsam (não inflam o streak)', () => {
    expect(computeDoseStreakDays(['2026-07-12', '2026-07-12', '2026-07-12'], TODAY)).toBe(1)
  })

  it('atravessa a virada de mês', () => {
    expect(computeDoseStreakDays(consecutiveDays('2026-07-02', 4), '2026-07-02')).toBe(4)
  })

  it('atravessa a virada de ANO', () => {
    // 2026-01-02, 2026-01-01, 2025-12-31, 2025-12-30
    expect(computeDoseStreakDays(consecutiveDays('2026-01-02', 4), '2026-01-02')).toBe(4)
  })

  it('atravessa 1º de março em ano BISSEXTO (29/02 existe)', () => {
    // 2028 é bissexto: 2028-03-01 → 2028-02-29 → 2028-02-28
    expect(computeDoseStreakDays(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3)
  })

  it('atravessa 1º de março em ano NÃO bissexto (28/02 é o anterior)', () => {
    expect(computeDoseStreakDays(['2026-03-01', '2026-02-28', '2026-02-27'], '2026-03-01')).toBe(3)
  })
})

describe('evaluateStockUpsell', () => {
  it('poucas doses e sem constância → não elegível', () => {
    expect(evaluateStockUpsell(consecutiveDays(TODAY, 3), TODAY).eligible).toBe(false)
  })

  it(`elegível por VOLUME (${UPSELL_MIN_DOSES} doses) mesmo com streak curto`, () => {
    // 20 doses concentradas em 3 dias (quem toma 4x/dia).
    const days = Array.from({ length: UPSELL_MIN_DOSES }, (_, i) => consecutiveDays(TODAY, 3)[i % 3])
    const result = evaluateStockUpsell(days, TODAY)
    expect(result.doses).toBe(UPSELL_MIN_DOSES)
    expect(result.streakDays).toBe(3)
    expect(result.eligible).toBe(true)
  })

  it(`elegível por CONSTÂNCIA (${UPSELL_MIN_STREAK_DAYS} dias) mesmo com poucas doses`, () => {
    const days = consecutiveDays(TODAY, UPSELL_MIN_STREAK_DAYS)
    const result = evaluateStockUpsell(days, TODAY)
    expect(result.doses).toBe(UPSELL_MIN_STREAK_DAYS)
    expect(result.streakDays).toBe(UPSELL_MIN_STREAK_DAYS)
    expect(result.eligible).toBe(true)
  })

  it('fica logo abaixo dos dois limiares → não elegível (fronteira)', () => {
    const days = consecutiveDays(TODAY, UPSELL_MIN_STREAK_DAYS - 1)
    const result = evaluateStockUpsell(days, TODAY)
    expect(result.doses).toBeLessThan(UPSELL_MIN_DOSES)
    expect(result.eligible).toBe(false)
  })

  it('critério parametrizável (spec §Assumptions)', () => {
    const days = consecutiveDays(TODAY, 5)
    expect(evaluateStockUpsell(days, TODAY, { minStreakDays: 5 }).eligible).toBe(true)
    expect(evaluateStockUpsell(days, TODAY, { minDoses: 5 }).eligible).toBe(true)
  })

  it('doses fora da janela de observação NÃO contam (gatilho igual em web e mobile)', () => {
    // A web carrega ~1 ano de logs para o streak; o mobile, 30 dias. Sem o recorte na regra,
    // 20 doses espalhadas pelo ano ligariam o card só na web.
    const antigas = Array.from({ length: 40 }, (_, i) => consecutiveDays('2026-01-10', 40)[i])
    const result = evaluateStockUpsell(antigas, TODAY)
    expect(result.doses).toBe(0)
    expect(result.eligible).toBe(false)
  })

  it('janela parametrizável e coerente com o default de 30 dias', () => {
    const days = consecutiveDays(TODAY, 40)
    // 40 dias consecutivos → o default recorta em 30, e 30 >= 14 (streak) segue elegível.
    expect(evaluateStockUpsell(days, TODAY).doses).toBe(30)
    expect(evaluateStockUpsell(days, TODAY, { lookbackDays: 7 }).doses).toBe(7)
  })

  it('lista degenerada (vazia / com furos) não quebra', () => {
    expect(evaluateStockUpsell([], TODAY)).toEqual({ doses: 0, streakDays: 0, eligible: false })
    expect(evaluateStockUpsell([null as never, '' as never], TODAY).doses).toBe(0)
  })
})
