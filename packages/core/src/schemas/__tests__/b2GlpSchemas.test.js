import { describe, it, expect } from 'vitest'
import {
  INTAKE_UNITS,
  INJECTION_CONTAINERS,
  validateProtocolCreate,
  validateMedicine,
  validateTitrationStage,
} from '../index.js'

// 012 Fase B2 — sincronização Zod ↔ CHECK (R-082/R-271) + flag de titulação N1.
describe('intake_unit mg (FR-017)', () => {
  it("INTAKE_UNITS inclui 'mg' (sincronizado com CHECK +mg)", () => {
    expect(INTAKE_UNITS).toContain('mg')
    // caixa exata — CHECK usa minúsculo p/ mg
    expect(INTAKE_UNITS).toEqual(['gotas', 'ml', 'UI', 'mg'])
  })

  it('protocolo líquido aceita intake_unit mg', () => {
    const res = validateProtocolCreate({
      medicine_id: '123e4567-e89b-42d3-a456-556642440000',
      name: 'Ozempic semanal',
      dosage_per_intake: 0.25,
      frequency: 'semanal',
      time_schedule: ['08:00'],
      weekdays: ['segunda'],
      start_date: '2026-06-12',
      intake_unit: 'mg',
      _medicineIsLiquid: true,
    })
    expect(res.success).toBe(true)
  })
})

describe('injection_container (FR-019)', () => {
  it('INJECTION_CONTAINERS = enum esperado', () => {
    expect(INJECTION_CONTAINERS).toEqual([
      'caneta',
      'refil',
      'ampola',
      'frasco_ampola',
      'seringa_preenchida',
    ])
  })

  it('medicine aceita injection_container válido e null', () => {
    const base = {
      name: 'Ozempic',
      dosage_per_pill: 1,
      dosage_unit: 'mg/ml',
      units_per_ml: 0.68,
      presentation: 'injetavel',
    }
    expect(validateMedicine({ ...base, injection_container: 'caneta' }).success).toBe(true)
    expect(validateMedicine({ ...base, injection_container: null }).success).toBe(true)
  })

  it('rejeita container fora do enum', () => {
    const res = validateMedicine({
      name: 'X',
      dosage_per_pill: 1,
      dosage_unit: 'mg/ml',
      injection_container: 'tubo',
    })
    expect(res.success).toBe(false)
  })
})

describe('titration stage requires_new_medicine (FR-021)', () => {
  it('aceita flag true/false/ausente', () => {
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5, requires_new_medicine: true }).success).toBe(true)
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5, requires_new_medicine: false }).success).toBe(true)
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5 }).success).toBe(true)
  })
})
