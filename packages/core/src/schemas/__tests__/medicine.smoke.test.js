import { describe, it, expect } from 'vitest'
import { validateMedicineCreate } from '../medicineSchema'

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
})
