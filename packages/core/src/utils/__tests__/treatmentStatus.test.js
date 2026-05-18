import { describe, it, expect } from 'vitest'
import { resolveTreatmentStatus, TREATMENT_STATUS } from '../treatmentStatus.js'

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
