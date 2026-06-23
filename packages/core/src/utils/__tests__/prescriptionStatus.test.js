import { describe, it, expect } from 'vitest'
import {
  derivePrescriptionStatus,
  PRESCRIPTION_STATUS,
} from '../prescriptionStatus.js'

// Referência fixa: 2026-06-23 12:00 local (America/Sao_Paulo).
const NOW = new Date('2026-06-23T15:00:00.000Z')

describe('derivePrescriptionStatus', () => {
  it('returns ATIVA when end_date is absent (vigência indeterminada)', () => {
    expect(derivePrescriptionStatus({ end_date: null }, NOW)).toBe(
      PRESCRIPTION_STATUS.ATIVA
    )
    expect(derivePrescriptionStatus({}, NOW)).toBe(PRESCRIPTION_STATUS.ATIVA)
  })

  it('returns VENCIDA when end_date is in the past', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-06-20' }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCIDA)
  })

  it('returns VENCENDO (not VENCIDA) when end_date is today, even at noon (calendar-date compare)', () => {
    // NOW = 12:00 local do dia 23; prescrição vence hoje → ainda válida (vencendo), não vencida.
    expect(
      derivePrescriptionStatus({ end_date: '2026-06-23' }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCENDO)
  })

  it('returns VENCENDO when end_date is within 14 days', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-07-01' }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCENDO)
  })

  it('returns VENCENDO at the 14-day boundary', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-07-07' }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCENDO)
  })

  it('returns ATIVA when end_date is far in the future and active', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-12-31', active: true }, NOW)
    ).toBe(PRESCRIPTION_STATUS.ATIVA)
  })

  it('returns FINALIZADA when far-future end_date but active === false', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-12-31', active: false }, NOW)
    ).toBe(PRESCRIPTION_STATUS.FINALIZADA)
  })

  it('prioritizes VENCIDA/VENCENDO over active === false', () => {
    expect(
      derivePrescriptionStatus({ end_date: '2026-06-20', active: false }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCIDA)
    expect(
      derivePrescriptionStatus({ end_date: '2026-07-01', active: false }, NOW)
    ).toBe(PRESCRIPTION_STATUS.VENCENDO)
  })
})
