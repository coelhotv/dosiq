import { describe, it, expect } from 'vitest'
import { validateMedicineCreate, validateMedicineUpdate } from '../medicineSchema'

// 066 Slice C (M1a): o Zod precisa conhecer o campo — campo ausente do schema some no
// safeParse e nunca chega ao banco (AP-214).
const base = { name: 'Atacand', dosage_per_pill: 8, dosage_unit: 'mg' }

describe('medicineSchema · anvisa_registration', () => {
  it('mantém o registro de 9 dígitos no dado validado', () => {
    const result = validateMedicineCreate({ ...base, anvisa_registration: '100380118' })
    expect(result.success).toBe(true)
    expect(result.data?.anvisa_registration).toBe('100380118')
  })

  it('aceita null e ausência (genérico e cadastro manual)', () => {
    expect(validateMedicineCreate({ ...base, anvisa_registration: null }).data?.anvisa_registration).toBeNull()
    expect(validateMedicineCreate(base).success).toBe(true)
  })

  it("'' vira null em vez de violar o CHECK", () => {
    const result = validateMedicineCreate({ ...base, anvisa_registration: '' })
    expect(result.success).toBe(true)
    expect(result.data?.anvisa_registration).toBeNull()
  })

  it('rejeita formato que o CHECK do banco rejeitaria', () => {
    expect(validateMedicineCreate({ ...base, anvisa_registration: '10038011' }).success).toBe(false)
    expect(validateMedicineCreate({ ...base, anvisa_registration: '1003801180' }).success).toBe(false)
    expect(validateMedicineCreate({ ...base, anvisa_registration: '10038011X' }).success).toBe(false)
  })

  it('update parcial preserva o campo', () => {
    const result = validateMedicineUpdate({ anvisa_registration: '100380118' })
    expect(result.success).toBe(true)
    expect(result.data?.anvisa_registration).toBe('100380118')
  })
})
