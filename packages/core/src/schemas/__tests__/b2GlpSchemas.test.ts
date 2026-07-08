import { describe, it, expect } from 'vitest'
import {
  INTAKE_UNITS,
  INJECTION_CONTAINERS,
  validateProtocolCreate,
  validateMedicine,
  validateTitrationStage,
} from '../index'

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

describe('injection_container — enum (FR-019)', () => {
  it('INJECTION_CONTAINERS = enum esperado', () => {
    expect(INJECTION_CONTAINERS).toEqual([
      'caneta',
      'refil',
      'ampola',
      'frasco_ampola',
      'seringa_preenchida',
    ])
  })

  // 012 B4 (ADR-068): injection_container saiu de `medicines` → vive no LOTE. A
  // validação por lote (stockCreateSchema) está em stockInjectionContainer.b4.test.js.
  it('medicineSchema descarta injection_container (campo legado)', () => {
    const res = validateMedicine({
      name: 'Ozempic',
      dosage_per_pill: 1,
      dosage_unit: 'mg/ml',
      presentation: 'injetavel',
      injection_container: 'caneta',
    })
    expect(res.success).toBe(true)
    expect('injection_container' in res.data!).toBe(false)
  })
})

describe('titration stage requires_new_medicine (FR-021)', () => {
  it('aceita flag true/false/ausente', () => {
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5, requires_new_medicine: true }).success).toBe(true)
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5, requires_new_medicine: false }).success).toBe(true)
    expect(validateTitrationStage({ duration_days: 28, dosage: 0.5 }).success).toBe(true)
  })
})
