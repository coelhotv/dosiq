import { describe, it, expect } from 'vitest'
import { resolveTreatmentStatus, isTreatmentActive, isTreatmentSchedulableOn, TREATMENT_STATUS } from '../treatmentStatus.js'

describe('resolveTreatmentStatus', () => {
  // Teste 1: active: true, end_date: null → ATIVO
  it('returns ATIVO when active is true and end_date is null', () => {
    const protocol = { active: true, end_date: null }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 2: active: undefined, end_date: null → ATIVO (default truthy)
  it('returns ATIVO when active is undefined and end_date is null', () => {
    const protocol = { active: undefined, end_date: null }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 3: active: null, end_date: null → ATIVO (null treated as absent)
  it('returns ATIVO when active is null and end_date is null', () => {
    const protocol = { active: null, end_date: null }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 4: active: false, end_date: null → PAUSADO
  it('returns PAUSADO when active is false and end_date is null', () => {
    const protocol = { active: false, end_date: null }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.PAUSADO
    )
  })

  // Teste 5: active: true, end_date: futuro → ATIVO
  it('returns ATIVO when active is true and end_date is in the future', () => {
    const protocol = { active: true, end_date: '2026-06-18' }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 6: active: true, end_date: today → ATIVO (today is NOT < today)
  it('returns ATIVO when active is true and end_date equals today', () => {
    const protocol = { active: true, end_date: '2026-05-18' }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 7: active: true, end_date: passado → FINALIZADO
  it('returns FINALIZADO when active is true and end_date is in the past', () => {
    const protocol = { active: true, end_date: '2026-05-17' }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.FINALIZADO
    )
  })

  // Teste 8: active: false, end_date: passado → FINALIZADO (precedência)
  it('returns FINALIZADO when active is false and end_date is in the past (precedence over PAUSADO)', () => {
    const protocol = { active: false, end_date: '2026-05-17' }
    expect(resolveTreatmentStatus(protocol, '2026-05-18')).toBe(
      TREATMENT_STATUS.FINALIZADO
    )
  })

  // Teste 9: protocol null/undefined returns ATIVO (defensivo)
  it('returns ATIVO when protocol is null or undefined', () => {
    expect(resolveTreatmentStatus(null, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
    expect(resolveTreatmentStatus(undefined, '2026-05-18')).toBe(
      TREATMENT_STATUS.ATIVO
    )
  })

  // Teste 10: today parameter optional, uses local now by default
  it('uses local today when today parameter is not provided', () => {
    const protocol = { active: false, end_date: null }
    // Should not throw and should return PAUSADO regardless of actual current date
    expect(resolveTreatmentStatus(protocol)).toBe(TREATMENT_STATUS.PAUSADO)
  })

  // Teste 11: today parameter explicit override works deterministically
  it('allows explicit today override for deterministic testing', () => {
    const protocol = { active: true, end_date: '2026-06-01' }
    expect(resolveTreatmentStatus(protocol, '2026-05-01')).toBe(
      TREATMENT_STATUS.ATIVO
    )
    expect(resolveTreatmentStatus(protocol, '2026-06-02')).toBe(
      TREATMENT_STATUS.FINALIZADO
    )
  })
})

describe('isTreatmentActive', () => {
  it('returns true only for ATIVO', () => {
    expect(isTreatmentActive({ active: true, end_date: null }, '2026-05-18')).toBe(true)
    expect(isTreatmentActive({ active: true, end_date: '2026-06-18' }, '2026-05-18')).toBe(true)
  })

  it('returns false for PAUSADO and FINALIZADO', () => {
    expect(isTreatmentActive({ active: false, end_date: null }, '2026-05-18')).toBe(false)
    expect(isTreatmentActive({ active: true, end_date: '2026-05-17' }, '2026-05-18')).toBe(false)
  })
})

describe('isTreatmentSchedulableOn', () => {
  const TODAY = '2026-05-18'

  it('returns true when active and today is inside [start, end]', () => {
    expect(isTreatmentSchedulableOn({ active: true, start_date: '2026-05-01', end_date: '2026-06-01' }, TODAY)).toBe(true)
  })

  it('returns true when active with open-ended period (no end_date)', () => {
    expect(isTreatmentSchedulableOn({ active: true, start_date: '2026-05-01', end_date: null }, TODAY)).toBe(true)
  })

  it('returns false for FUTURE treatment (start_date > today) even if active', () => {
    expect(isTreatmentSchedulableOn({ active: true, start_date: '2026-05-19', end_date: null }, TODAY)).toBe(false)
  })

  it('returns false for ENDED treatment (end_date < today)', () => {
    expect(isTreatmentSchedulableOn({ active: true, start_date: '2026-05-01', end_date: '2026-05-17' }, TODAY)).toBe(false)
  })

  it('returns false for PAUSED treatment (active=false) inside period', () => {
    expect(isTreatmentSchedulableOn({ active: false, start_date: '2026-05-01', end_date: '2026-06-01' }, TODAY)).toBe(false)
  })
})

describe('TREATMENT_STATUS constants', () => {
  it('exports frozen object with expected values', () => {
    expect(TREATMENT_STATUS.ATIVO).toBe('ativo')
    expect(TREATMENT_STATUS.PAUSADO).toBe('pausado')
    expect(TREATMENT_STATUS.FINALIZADO).toBe('finalizado')
  })

  it('is frozen and immutable', () => {
    expect(() => {
      TREATMENT_STATUS.ATIVO = 'modified'
    }).toThrow()
  })
})
