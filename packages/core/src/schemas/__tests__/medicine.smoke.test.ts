import { describe, it, expect } from 'vitest'
import { validateMedicineCreate, validateMedicineUpdate } from '../medicineSchema'

describe('Smoke: Medicine Schema', () => {
  it('validates minimum valid medicine', () => {
    const result = validateMedicineCreate({
      name: 'Paracetamol',
      dosage_per_pill: 500,
      dosage_unit: 'mg',
    })
    expect(result.success).toBe(true)
  })

  it('rejects medicine without name', () => {
    const result = validateMedicineCreate({
      dosage_per_pill: 500,
      dosage_unit: 'mg',
    })
    expect(result.success).toBe(false)
  })

  // 012 Fase B2 (smoke PO 2026-06-12): update parcial NÃO pode reintroduzir defaults.
  // `.partial()` no Zod v4 mantém `.default()` → omitir presentation/type flipava
  // injetável→comprimido (líquido→sólido) — corrupção clínica.
  describe('update parcial não injeta defaults (anti-flip clínico)', () => {
    // 012 B4 (ADR-068): injection_container saiu de medicines → usa outro campo parcial.
    it('update parcial (só therapeutic_class) não traz presentation/type', () => {
      const result = validateMedicineUpdate({ therapeutic_class: 'Análogo de GLP-1' })
      expect(result.success).toBe(true)
      expect('presentation' in result.data).toBe(false)
      expect('type' in result.data).toBe(false)
      expect(result.data.therapeutic_class).toBe('Análogo de GLP-1')
    })

    it('create ainda aplica os defaults (comprimido/medicamento)', () => {
      const result = validateMedicineCreate({
        name: 'Dipirona',
        dosage_per_pill: 500,
        dosage_unit: 'mg',
      })
      expect(result.success).toBe(true)
      expect(result.data.presentation).toBe('comprimido')
      expect(result.data.type).toBe('medicamento')
    })

    it('update preserva presentation quando explicitamente enviado', () => {
      const result = validateMedicineUpdate({ presentation: 'injetavel' })
      expect(result.success).toBe(true)
      expect(result.data.presentation).toBe('injetavel')
    })
  })
})
