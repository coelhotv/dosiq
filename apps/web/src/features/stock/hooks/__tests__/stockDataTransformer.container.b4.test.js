import { describe, it, expect } from 'vitest'
import { transformStockItems } from '../_stockDataTransformer.js'

// 012 Fase B4 / ADR-068 — apresentação (injection_container) derivada do LOTE ativo,
// não mais do medicine. Card lê item.medicine.injection_container (vindo do lote).
describe('_stockDataTransformer — injection_container por lote (B4)', () => {
  const med = { id: 'm1', name: 'Ozempic', dosage_unit: 'mg/ml', presentation: 'injetavel' }
  const noop = () => 'normal'
  const bar = () => 50

  const run = (entries) =>
    transformStockItems([med], [], { m1: { total: 4, entries } }, {}, noop, bar)[0]

  it('deriva do lote aberto mais antigo com container', () => {
    const item = run([
      { quantity: 2, opened_at: '2026-06-10T00:00:00Z', injection_container: 'refil' },
      { quantity: 2, opened_at: '2026-06-01T00:00:00Z', injection_container: 'caneta' },
    ])
    expect(item.medicine.injection_container).toBe('caneta') // opened_at mais antigo
  })

  it('fallback p/ primeiro lote com container quando nenhum aberto', () => {
    const item = run([
      { quantity: 2, opened_at: null, injection_container: null },
      { quantity: 2, opened_at: null, injection_container: 'caneta' },
    ])
    expect(item.medicine.injection_container).toBe('caneta')
  })

  it('null quando nenhum lote tem container', () => {
    const item = run([{ quantity: 2, opened_at: null, injection_container: null }])
    expect(item.medicine.injection_container).toBeNull()
  })
})
