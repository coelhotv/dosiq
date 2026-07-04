import { describe, it, expect } from 'vitest'
import { validateStockCreate } from '../stockSchema'
import { medicineSchema } from '../medicineSchema'

// 012 Fase B4 / ADR-068 — injection_container migrou medicine-level → LOTE.
describe('injection_container por lote (B4 — ADR-068)', () => {
  const BASE = {
    medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    quantity: 3,
    purchase_date: '2026-01-10',
  }

  it('stockCreate aceita injection_container válido', () => {
    const r = validateStockCreate({ ...BASE, injection_container: 'caneta' })
    expect(r.success).toBe(true)
    expect(r.data.injection_container).toBe('caneta')
  })

  it('stockCreate normaliza ausência/"" → null', () => {
    expect(validateStockCreate(BASE).data.injection_container).toBeNull()
    expect(validateStockCreate({ ...BASE, injection_container: null }).data.injection_container).toBeNull()
  })

  it('stockCreate rejeita enum inválido', () => {
    const r = validateStockCreate({ ...BASE, injection_container: 'caixa' })
    expect(r.success).toBe(false)
  })

  it('medicineSchema NÃO tem mais injection_container (campo desconhecido é descartado)', () => {
    const parsed = medicineSchema.safeParse({
      name: 'Ozempic',
      presentation: 'injetavel',
      dosage_unit: 'mg/ml',
      injection_container: 'caneta', // campo legado — deve ser ignorado (strip)
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('injection_container')
  })
})
