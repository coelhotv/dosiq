// titrationSchema.test.ts — 029 F1 (T002). Guarda o sync enum Zod ↔ CHECK do banco (R-271/R-270).
// Se o CHECK da migração 20260715_titrations.sql mudar sem espelhar aqui, este teste quebra.

import { describe, it, expect } from 'vitest'
import {
  TITRATION_INTAKE_UNITS,
  TITRATION_STEP_STATUSES,
  validateTitrationStep,
  titrationStepCreateSchema,
} from '../titrationSchema'
import { INTAKE_UNITS } from '../protocolSchema'

describe('titrationSchema — sync com os CHECKs da migração F1', () => {
  it('TITRATION_INTAKE_UNITS = INTAKE_UNITS do core + cp (espelha CHECK intake_unit)', () => {
    expect(TITRATION_INTAKE_UNITS).toEqual([...INTAKE_UNITS, 'cp'])
    // O CHECK do banco é IN ('gotas','ml','UI','mg','cp'):
    expect([...TITRATION_INTAKE_UNITS]).toEqual(['gotas', 'ml', 'UI', 'mg', 'cp'])
  })

  it('TITRATION_STEP_STATUSES espelha o CHECK status', () => {
    expect([...TITRATION_STEP_STATUSES]).toEqual([
      'upcoming',
      'current',
      'pending_confirmation',
      'completed',
    ])
  })
})

describe('validateTitrationStep', () => {
  const validRow = {
    id: '11111111-1111-4111-8111-111111111111',
    titration_id: '22222222-2222-4222-8222-222222222222',
    user_id: '33333333-3333-4333-8333-333333333333',
    position: 0,
    medicine_id: '44444444-4444-4444-8444-444444444444',
    dose: 0.25,
    intake_unit: 'mg',
    duration_days: 28,
    status: 'current',
    protocol_id: null,
    started_at: null,
    ended_at: null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  }

  it('aceita etapa válida', () => {
    const r = validateTitrationStep(validRow)
    expect(r.success).toBe(true)
  })

  it('aceita duration_days null (etapa contínua)', () => {
    const r = validateTitrationStep({ ...validRow, duration_days: null })
    expect(r.success).toBe(true)
  })

  it('rejeita dose <= 0 (espelha CHECK dose > 0)', () => {
    const r = validateTitrationStep({ ...validRow, dose: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita intake_unit fora do domínio', () => {
    const r = validateTitrationStep({ ...validRow, intake_unit: 'comprimido' })
    expect(r.success).toBe(false)
  })

  it('rejeita status fora do domínio', () => {
    const r = validateTitrationStep({ ...validRow, status: 'paused' })
    expect(r.success).toBe(false)
  })
})

describe('titrationStepCreateSchema', () => {
  it('não exige campos de servidor (status/timestamps)', () => {
    const r = titrationStepCreateSchema.safeParse({
      titration_id: '22222222-2222-4222-8222-222222222222',
      position: 1,
      medicine_id: '44444444-4444-4444-8444-444444444444',
      dose: 0.5,
      intake_unit: 'mg',
      duration_days: 28,
    })
    expect(r.success).toBe(true)
  })
})
