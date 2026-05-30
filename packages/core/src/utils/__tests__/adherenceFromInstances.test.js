import { describe, it, expect } from 'vitest'
import {
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  computeLongestStreakFromInstances,
  ADHERENCE_MODE,
} from '../adherenceLogic'

// Helper: cria uma linha de dose_instances mínima.
const inst = (status, extra = {}) => ({ status, ...extra })

describe('computeAdherenceFromInstances — modo binary (default)', () => {
  it('rate = taken / (taken + missed); pending e skipped fora do denominador', () => {
    const instances = [
      inst('taken'),
      inst('taken'),
      inst('taken'),
      inst('missed'),
      inst('pending'),
      inst('skipped_paused'),
      inst('skipped_user'),
    ]
    const r = computeAdherenceFromInstances(instances)
    expect(r.taken).toBe(3)
    expect(r.missed).toBe(1)
    expect(r.pending).toBe(1)
    expect(r.skipped).toBe(2)
    expect(r.rate).toBeCloseTo(0.75, 5) // 3 / (3 + 1)
  })

  it('skipped_* nunca penaliza: só taken → rate 1', () => {
    const r = computeAdherenceFromInstances([
      inst('taken'),
      inst('taken'),
      inst('skipped_paused'),
      inst('skipped_user'),
      inst('pending'),
    ])
    expect(r.rate).toBe(1)
    expect(r.skipped).toBe(2)
  })

  it('denominador vazio (sem taken/missed) → rate null, não NaN nem 0', () => {
    const r = computeAdherenceFromInstances([inst('pending'), inst('skipped_user')])
    expect(r.rate).toBeNull()
    expect(Number.isNaN(r.rate)).toBe(false)
  })

  it('lista vazia / não-array → zeros e rate null', () => {
    expect(computeAdherenceFromInstances([])).toEqual({
      taken: 0, missed: 0, pending: 0, skipped: 0, rate: null,
    })
    expect(computeAdherenceFromInstances(null).rate).toBeNull()
    expect(computeAdherenceFromInstances(undefined).rate).toBeNull()
  })

  it('ignora status desconhecido sem quebrar', () => {
    const r = computeAdherenceFromInstances([inst('taken'), inst('weird'), inst('missed')])
    expect(r.taken).toBe(1)
    expect(r.missed).toBe(1)
    expect(r.rate).toBeCloseTo(0.5, 5)
  })
})

describe('computeAdherenceFromInstances — modo dose_exactness (Seam B)', () => {
  it('rate = Σ aplicado / Σ esperado sobre taken+missed', () => {
    const instances = [
      inst('taken', { expected_dose: 2, quantity_taken: 2 }),
      inst('taken', { expected_dose: 2, quantity_taken: 1 }), // tomou metade
      inst('missed', { expected_dose: 2 }), // 0 aplicado, 2 esperado
    ]
    const r = computeAdherenceFromInstances(instances, { mode: ADHERENCE_MODE.DOSE_EXACTNESS })
    // aplicado = 2 + 1 = 3 ; esperado = 2 + 2 + 2 = 6 → 0.5
    expect(r.rate).toBeCloseTo(0.5, 5)
  })

  it('FP-1: aplicado > esperado é permitido mas clampado a 1', () => {
    const r = computeAdherenceFromInstances(
      [inst('taken', { expected_dose: 1, quantity_taken: 3 })],
      { mode: ADHERENCE_MODE.DOSE_EXACTNESS },
    )
    expect(r.rate).toBe(1) // clamp [0,1]
  })

  it('taken sem quantity_taken → assume dose cheia (expected_dose)', () => {
    const r = computeAdherenceFromInstances(
      [inst('taken', { expected_dose: 2 }), inst('missed', { expected_dose: 2 })],
      { mode: ADHERENCE_MODE.DOSE_EXACTNESS },
    )
    // aplicado = 2 (cheia) ; esperado = 4 → 0.5
    expect(r.rate).toBeCloseTo(0.5, 5)
  })

  it('quantity_taken = 0 é valor válido (não cai no fallback de dose cheia)', () => {
    const r = computeAdherenceFromInstances(
      [inst('taken', { expected_dose: 2, quantity_taken: 0 })],
      { mode: ADHERENCE_MODE.DOSE_EXACTNESS },
    )
    expect(r.rate).toBe(0) // 0 aplicado / 2 esperado
  })

  it('Seam A: somas respeitam dosage_unit arbitrária (ex: 0.5 ml), sem cap pill', () => {
    const r = computeAdherenceFromInstances(
      [inst('taken', { expected_dose: 0.5, quantity_taken: 0.5 })],
      { mode: ADHERENCE_MODE.DOSE_EXACTNESS },
    )
    expect(r.rate).toBe(1)
  })

  it('esperado total 0 → rate null', () => {
    const r = computeAdherenceFromInstances([inst('pending')], {
      mode: ADHERENCE_MODE.DOSE_EXACTNESS,
    })
    expect(r.rate).toBeNull()
  })
})

describe('computeStreakFromInstances', () => {
  // scheduled_for em UTC; tz SP (UTC-3) → fronteira de dia local.
  const at = (isoLocalDay, hourUtc = '12') =>
    `${isoLocalDay}T${hourUtc}:00:00.000Z`

  it('dias só com taken contam; missed quebra', () => {
    const instances = [
      inst('taken', { scheduled_for: at('2026-05-30') }),
      inst('taken', { scheduled_for: at('2026-05-29') }),
      inst('missed', { scheduled_for: at('2026-05-28') }),
      inst('taken', { scheduled_for: at('2026-05-27') }),
    ]
    const streak = computeStreakFromInstances(instances, { today: '2026-05-30' })
    expect(streak).toBe(2) // 30 e 29; quebra no 28
  })

  it('dia só com skipped é neutro (não soma, não quebra)', () => {
    const instances = [
      inst('taken', { scheduled_for: at('2026-05-30') }),
      inst('skipped_paused', { scheduled_for: at('2026-05-29') }),
      inst('taken', { scheduled_for: at('2026-05-28') }),
    ]
    const streak = computeStreakFromInstances(instances, { today: '2026-05-30' })
    expect(streak).toBe(2) // 29 neutro, não quebra
  })

  it('gap (dia sem dose) é neutro', () => {
    const instances = [
      inst('taken', { scheduled_for: at('2026-05-30') }),
      // 29 sem dose
      inst('taken', { scheduled_for: at('2026-05-28') }),
    ]
    const streak = computeStreakFromInstances(instances, { today: '2026-05-30' })
    expect(streak).toBe(2)
  })

  it('missed hoje → streak 0', () => {
    const instances = [
      inst('missed', { scheduled_for: at('2026-05-30') }),
      inst('taken', { scheduled_for: at('2026-05-29') }),
    ]
    expect(computeStreakFromInstances(instances, { today: '2026-05-30' })).toBe(0)
  })

  it('cross-meia-noite: dose 22:30 local cai no dia correto no tz', () => {
    // 2026-05-30 22:30 BRT = 2026-05-31 01:30 UTC → dia local 2026-05-30
    const instances = [
      inst('taken', { scheduled_for: '2026-05-31T01:30:00.000Z' }),
    ]
    const streak = computeStreakFromInstances(instances, { tz: 'America/Sao_Paulo', today: '2026-05-30' })
    expect(streak).toBe(1) // conta no dia 30, não no 31
  })

  it('ocorrências futuras (> today) são ignoradas', () => {
    const instances = [
      inst('taken', { scheduled_for: at('2026-06-05') }), // futuro
      inst('taken', { scheduled_for: at('2026-05-30') }),
    ]
    expect(computeStreakFromInstances(instances, { today: '2026-05-30' })).toBe(1)
  })

  it('lista vazia / sem scheduled_for → 0', () => {
    expect(computeStreakFromInstances([], { today: '2026-05-30' })).toBe(0)
    expect(computeStreakFromInstances([inst('taken')], { today: '2026-05-30' })).toBe(0)
    expect(computeStreakFromInstances(null, { today: '2026-05-30' })).toBe(0)
  })
})

describe('computeLongestStreakFromInstances', () => {
  const at = (isoLocalDay, hourUtc = '12') => `${isoLocalDay}T${hourUtc}:00:00.000Z`

  it('maior sequência sem missed (não só a partir de hoje)', () => {
    const instances = [
      // run 1: 3 dias (10,11,12)
      inst('taken', { scheduled_for: at('2026-05-10') }),
      inst('taken', { scheduled_for: at('2026-05-11') }),
      inst('taken', { scheduled_for: at('2026-05-12') }),
      inst('missed', { scheduled_for: at('2026-05-13') }), // quebra
      // run 2: 2 dias (14,15)
      inst('taken', { scheduled_for: at('2026-05-14') }),
      inst('taken', { scheduled_for: at('2026-05-15') }),
    ]
    expect(computeLongestStreakFromInstances(instances)).toBe(3)
  })

  it('skipped/gap neutros não quebram a sequência mais longa', () => {
    const instances = [
      inst('taken', { scheduled_for: at('2026-05-10') }),
      inst('skipped_user', { scheduled_for: at('2026-05-11') }), // neutro
      // gap 12
      inst('taken', { scheduled_for: at('2026-05-13') }),
      inst('taken', { scheduled_for: at('2026-05-14') }),
    ]
    expect(computeLongestStreakFromInstances(instances)).toBe(3) // 10,13,14
  })

  it('sem taken → 0; lista vazia/null → 0', () => {
    expect(computeLongestStreakFromInstances([inst('missed', { scheduled_for: at('2026-05-10') })])).toBe(0)
    expect(computeLongestStreakFromInstances([])).toBe(0)
    expect(computeLongestStreakFromInstances(null)).toBe(0)
  })
})
