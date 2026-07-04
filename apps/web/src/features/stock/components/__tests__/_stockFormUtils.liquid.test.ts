import { describe, it, expect } from 'vitest'
import { validateStockForm, buildStockPayload } from '../_stockFormUtils'

describe('validateStockForm — líquido (frascos × volume)', () => {
  const liquidBase = { medicine_id: 'm1', num_bottles: '2', volume_per_bottle: '100' }

  it('líquido sem frascos → erro num_bottles', () => {
    const errors = validateStockForm({ ...liquidBase, num_bottles: '' }, true)
    expect(errors.num_bottles).toBeTruthy()
  })
  it('líquido sem volume → erro volume_per_bottle', () => {
    const errors = validateStockForm({ ...liquidBase, volume_per_bottle: '0' }, true)
    expect(errors.volume_per_bottle).toBeTruthy()
  })
  it('líquido válido → sem erros', () => {
    const errors = validateStockForm(liquidBase, true)
    expect(Object.keys(errors)).toHaveLength(0)
  })
  it('sólido usa quantity (não frascos)', () => {
    const errors = validateStockForm({ medicine_id: 'm1', quantity: '30' }, false)
    expect(errors.quantity).toBeUndefined()
  })
})

describe('buildStockPayload — líquido', () => {
  it('computa quantity (ml) e unit_price por ml (trunc 4 casas)', () => {
    const payload = buildStockPayload(
      { medicine_id: 'm1', num_bottles: '2', volume_per_bottle: '100', total_price: '30' },
      null,
      true
    )
    expect(payload.quantity).toBe(200) // 2 × 100 ml
    expect(payload.unit_price).toBe(0.15) // 30 / 200
  })
  it('total_price ausente → unit_price 0', () => {
    const payload = buildStockPayload(
      { medicine_id: 'm1', num_bottles: '1', volume_per_bottle: '50', total_price: '' },
      null,
      true
    )
    expect(payload.quantity).toBe(50)
    expect(payload.unit_price).toBe(0)
  })
  it('sólido mantém quantity + unit_price diretos', () => {
    const payload = buildStockPayload(
      { medicine_id: 'm1', quantity: '30', unit_price: '0.5' },
      null,
      false
    )
    expect(payload.quantity).toBe(30)
    expect(payload.unit_price).toBe(0.5)
  })
})
