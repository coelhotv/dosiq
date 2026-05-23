import { describe, it, expect } from 'vitest'
import {
  STOCK_STATUS,
  STOCK_THRESHOLDS,
  resolveStockStatus,
  computeAverageUnitPrice,
  computeExpiryDays,
  formatBRL,
} from '../stock.js'

describe('resolveStockStatus', () => {
  it('retorna critico quando daysRemaining < 7', () => {
    // 12 un. / 2 un./dia = 6 dias
    expect(resolveStockStatus(12, 2)).toBe(STOCK_STATUS.CRITICO)
  })

  it('retorna baixo quando 7 <= daysRemaining < 14', () => {
    // 20 / 2 = 10 dias
    expect(resolveStockStatus(20, 2)).toBe(STOCK_STATUS.BAIXO)
  })

  it('retorna normal quando 14 <= daysRemaining < 30', () => {
    // 40 / 2 = 20 dias
    expect(resolveStockStatus(40, 2)).toBe(STOCK_STATUS.NORMAL)
  })

  it('retorna alto quando daysRemaining >= 30', () => {
    // 100 / 2 = 50 dias
    expect(resolveStockStatus(100, 2)).toBe(STOCK_STATUS.ALTO)
  })

  it('retorna critico quando qty <= 0 e sem consumo', () => {
    expect(resolveStockStatus(0, 0)).toBe(STOCK_STATUS.CRITICO)
  })

  it('retorna normal quando qty > 0 e sem consumo', () => {
    expect(resolveStockStatus(50, 0)).toBe(STOCK_STATUS.NORMAL)
  })

  it('retorna vencido se validade < hoje (sobrepoe critico)', () => {
    // hoje: '2026-05-18'; expiry "04/2026" (ultimo dia abril) já vencido
    expect(resolveStockStatus(100, 0, '04/2026', '2026-05-18')).toBe(STOCK_STATUS.VENCIDO)
  })

  it('NAO retorna vencido se validade no futuro', () => {
    expect(resolveStockStatus(100, 0, '12/2027', '2026-05-18')).toBe(STOCK_STATUS.NORMAL)
  })
})

describe('computeAverageUnitPrice', () => {
  it('retorna 0 para array vazio ou null', () => {
    expect(computeAverageUnitPrice([])).toBe(0)
    expect(computeAverageUnitPrice(null)).toBe(0)
    expect(computeAverageUnitPrice(undefined)).toBe(0)
  })

  it('calcula media ponderada pela quantidade', () => {
    // (30 * 0.90 + 60 * 1.00) / 90 = (27 + 60) / 90 = 0.9666...
    const result = computeAverageUnitPrice([
      { quantity: 30, unit_price: 0.90 },
      { quantity: 60, unit_price: 1.00 },
    ])
    expect(result).toBeCloseTo(0.9667, 4)
  })

  it('ignora compras sem unit_price ou quantity <= 0', () => {
    const result = computeAverageUnitPrice([
      { quantity: 30, unit_price: 0.90 },
      { quantity: 0, unit_price: 5 },
      { quantity: 30 },
      { quantity: 30, unit_price: null },
    ])
    // só conta o primeiro: 30 * 0.90 / 30 = 0.90
    expect(result).toBe(0.90)
  })

  it('retorna 0 se todas invalidas', () => {
    expect(computeAverageUnitPrice([{ quantity: 0, unit_price: 5 }])).toBe(0)
  })
})

describe('computeExpiryDays', () => {
  it('retorna null para input invalido', () => {
    expect(computeExpiryDays(null)).toBe(null)
    expect(computeExpiryDays('')).toBe(null)
    expect(computeExpiryDays('foo')).toBe(null)
    expect(computeExpiryDays('13/2026')).toBe(null)
  })

  it('calcula dias para MM/YYYY (ultimo dia do mes)', () => {
    // "05/2026" = 31/05/2026; ref = 18/05/2026 → 13 dias
    expect(computeExpiryDays('05/2026', '2026-05-18')).toBe(13)
  })

  it('aceita YYYY-MM-DD', () => {
    expect(computeExpiryDays('2026-06-01', '2026-05-18')).toBe(14)
  })

  it('retorna negativo se vencido', () => {
    expect(computeExpiryDays('04/2026', '2026-05-18')).toBeLessThan(0)
  })
})

describe('formatBRL', () => {
  it('formata valor positivo', () => {
    // Intl pode usar NBSP entre R$ e número; normalizar pra teste
    const formatted = formatBRL(1234.56)
    expect(formatted.replace(/\s/g, ' ')).toContain('1.234,56')
    expect(formatted).toContain('R$')
  })

  it('formata zero', () => {
    expect(formatBRL(0)).toMatch(/R\$\s?0,00/)
  })

  it('formata valor invalido como 0', () => {
    expect(formatBRL(null)).toMatch(/R\$\s?0,00/)
    expect(formatBRL(undefined)).toMatch(/R\$\s?0,00/)
    expect(formatBRL('xyz')).toMatch(/R\$\s?0,00/)
  })
})

describe('STOCK_THRESHOLDS', () => {
  it('expõe constantes esperadas', () => {
    expect(STOCK_THRESHOLDS.CRITICAL_DAYS).toBe(7)
    expect(STOCK_THRESHOLDS.LOW_DAYS).toBe(14)
    expect(STOCK_THRESHOLDS.NORMAL_DAYS).toBe(30)
    expect(STOCK_THRESHOLDS.EXPIRY_WARNING_DAYS).toBe(90)
  })
})
