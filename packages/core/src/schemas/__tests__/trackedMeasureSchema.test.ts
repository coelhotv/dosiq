// Spec 100 PO-8 / FM-5 / FM-6: os campos novos nunca materializam valor num update parcial.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { medicineCreateSchema, medicineUpdateSchema } from '../medicineSchema'
import { protocolSchema, protocolUpdateSchema } from '../protocolSchema'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('protocols.tracked_measure', () => {
  it('PO-8: update da web sem o campo passa no Zod e não materializa a chave', () => {
    const result = protocolUpdateSchema.safeParse({ active: false })
    expect(result.success).toBe(true)
    expect(result.success && 'tracked_measure' in result.data).toBe(false)
  })

  it('INV-2: sem default — create sem o campo deixa a chave ausente (banco grava NULL)', () => {
    const shape = protocolSchema.shape.tracked_measure
    expect(shape.safeParse(undefined)).toEqual({ success: true, data: undefined })
  })

  it.each(['peso', 'glicemia', 'pressao_arterial', 'nenhum', null])('aceita %j', (value) => {
    expect(protocolUpdateSchema.safeParse({ tracked_measure: value }).success).toBe(true)
  })

  it.each(['Peso', 'pressão', '', 'batimentos'])('rejeita %j (espelha o CHECK)', (value) => {
    expect(protocolUpdateSchema.safeParse({ tracked_measure: value }).success).toBe(false)
  })
})

describe('medicines.therapeutic_class_code', () => {
  it('FM-6: update parcial sem o campo não vira null (repositório grava validation.data cru)', () => {
    const result = medicineUpdateSchema.safeParse({ name: 'Ozempic' })
    expect(result.success).toBe(true)
    expect(result.success && 'therapeutic_class_code' in result.data).toBe(false)
  })

  it.each(['A10S', 'C7A', 'A10X9', null])('aceita %j', (value) => {
    expect(medicineUpdateSchema.safeParse({ therapeutic_class_code: value }).success).toBe(true)
  })

  it.each(['c7a', ' C7A', 'C', 'A10X9Z9', '7A', ''])('rejeita %j (espelha o CHECK)', (value) => {
    expect(medicineUpdateSchema.safeParse({ therapeutic_class_code: value }).success).toBe(false)
  })

  it('create aceita o rascunho com código', () => {
    const result = medicineCreateSchema.safeParse({
      name: 'Ozempic',
      dosage_per_pill: 1,
      dosage_unit: 'mg/ml',
      presentation: 'injetavel',
      therapeutic_class_code: 'A10S',
    })
    expect(result.error?.issues ?? []).toEqual([])
    expect(result.success && result.data.therapeutic_class_code).toBe('A10S')
  })
})
