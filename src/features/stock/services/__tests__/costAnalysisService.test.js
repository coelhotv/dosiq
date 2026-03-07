import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  calculateMonthlyCosts,
  calculateProjection,
  formatBRL,
  calculateDailyIntake,
  calculateAvgUnitPrice,
} from '../costAnalysisService'

describe('costAnalysisService', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  // ============================================================
  // calculateAvgUnitPrice
  // ============================================================

  describe('calculateAvgUnitPrice', () => {
    it('calcula media ponderada corretamente com multiplas entradas', () => {
      const stockEntries = [
        { quantity: 30, unit_price: 1.5 },
        { quantity: 60, unit_price: 2.0 },
      ]
      const avgPrice = calculateAvgUnitPrice(stockEntries)
      // (30*1.5 + 60*2.0) / (30+60) = (45+120)/90 = 165/90 = 1.833...
      expect(avgPrice).toBeCloseTo(1.833, 2)
    })

    it('retorna 0 para array vazio', () => {
      expect(calculateAvgUnitPrice([])).toBe(0)
    })

    it('retorna 0 para array null/undefined', () => {
      expect(calculateAvgUnitPrice(null)).toBe(0)
      expect(calculateAvgUnitPrice(undefined)).toBe(0)
    })

    it('ignora entradas com quantity <= 0', () => {
      const stockEntries = [
        { quantity: 0, unit_price: 2.0 },
        { quantity: 30, unit_price: 1.5 },
      ]
      const avgPrice = calculateAvgUnitPrice(stockEntries)
      expect(avgPrice).toBe(1.5)
    })

    it('ignora entradas com unit_price <= 0', () => {
      const stockEntries = [
        { quantity: 30, unit_price: 0 },
        { quantity: 30, unit_price: 1.5 },
      ]
      const avgPrice = calculateAvgUnitPrice(stockEntries)
      expect(avgPrice).toBe(1.5)
    })

    it('retorna 0 quando nenhuma entrada tem price > 0', () => {
      const stockEntries = [
        { quantity: 30, unit_price: 0 },
        { quantity: 60, unit_price: 0 },
      ]
      expect(calculateAvgUnitPrice(stockEntries)).toBe(0)
    })

    it('retorna 0 quando nenhuma entrada tem quantity > 0', () => {
      const stockEntries = [
        { quantity: 0, unit_price: 1.5 },
        { quantity: 0, unit_price: 2.0 },
      ]
      expect(calculateAvgUnitPrice(stockEntries)).toBe(0)
    })

    it('calcula com entrada unica', () => {
      const stockEntries = [{ quantity: 30, unit_price: 1.5 }]
      expect(calculateAvgUnitPrice(stockEntries)).toBe(1.5)
    })
  })

  // ============================================================
  // calculateDailyIntake
  // ============================================================

  describe('calculateDailyIntake', () => {
    it('calcula consumo diario para medicamento com um protocolo', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00', '20:00'],
        },
      ]
      const dailyIntake = calculateDailyIntake('med-1', protocols)
      // 1 (dosage) × 2 (times) = 2 pills/day
      expect(dailyIntake).toBe(2)
    })

    it('calcula consumo diario para medicamento com multiplos protocolos', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00', '20:00'],
        },
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['12:00'],
        },
      ]
      const dailyIntake = calculateDailyIntake('med-1', protocols)
      // (1 × 2) + (1 × 1) = 3 pills/day
      expect(dailyIntake).toBe(3)
    })

    it('retorna 0 para medicamento sem protocolo', () => {
      const protocols = [
        {
          medicine_id: 'med-2',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]
      expect(calculateDailyIntake('med-1', protocols)).toBe(0)
    })

    it('retorna 0 para medicamento com protocolo inativo', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: false,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]
      expect(calculateDailyIntake('med-1', protocols)).toBe(0)
    })

    it('retorna 0 para array vazio de protocolos', () => {
      expect(calculateDailyIntake('med-1', [])).toBe(0)
    })

    it('ignora protocols undefined/null em time_schedule', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: null,
        },
      ]
      const dailyIntake = calculateDailyIntake('med-1', protocols)
      // 1 × 0 (null treated as 0) = 0
      expect(dailyIntake).toBe(0)
    })

    it('calcula com dosage_per_intake = 2', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 2,
          time_schedule: ['08:00', '20:00'],
        },
      ]
      const dailyIntake = calculateDailyIntake('med-1', protocols)
      // 2 × 2 = 4 pills/day
      expect(dailyIntake).toBe(4)
    })

    it('ignora protocolos com dosage_per_intake undefined', () => {
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: undefined,
          time_schedule: ['08:00', '20:00'],
        },
      ]
      const dailyIntake = calculateDailyIntake('med-1', protocols)
      // undefined treated as 0: 0 × 2 = 0
      expect(dailyIntake).toBe(0)
    })
  })

  // ============================================================
  // calculateMonthlyCosts
  // ============================================================

  describe('calculateMonthlyCosts', () => {
    it('calcula custo mensal com dados completos', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 1.0 }],
        },
        {
          id: 'med-2',
          name: 'Metformina',
          stock: [{ quantity: 60, unit_price: 0.5 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00', '20:00'],
        },
        {
          medicine_id: 'med-2',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      // Med-1: (1 × 2 times) × 1.0 × 30 = 60
      // Med-2: (1 × 1 time) × 0.5 × 30 = 15
      expect(result.items).toHaveLength(2)
      expect(result.items[0].monthlyCost).toBe(60) // Ordenado DESC
      expect(result.items[0].name).toBe('Losartana')
      expect(result.items[1].monthlyCost).toBe(15)
      expect(result.totalMonthly).toBe(75)
      expect(result.projection3m).toBe(225)
    })

    it('retorna monthlyCost 0 para med sem preco', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 0 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].monthlyCost).toBe(0)
      expect(result.items[0].hasPriceData).toBe(false)
      expect(result.totalMonthly).toBe(0)
    })

    it('exclui medicamentos sem protocolo ativo', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 1.0 }],
        },
        {
          id: 'med-2',
          name: 'Metformina',
          stock: [{ quantity: 60, unit_price: 0.5 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
        // Med-2 sem protocolo
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('Losartana')
    })

    it('ordena items DESC por monthlyCost', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Med1',
          stock: [{ quantity: 30, unit_price: 1.0 }],
        },
        {
          id: 'med-2',
          name: 'Med2',
          stock: [{ quantity: 30, unit_price: 2.0 }],
        },
        {
          id: 'med-3',
          name: 'Med3',
          stock: [{ quantity: 30, unit_price: 0.5 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
        {
          medicine_id: 'med-2',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
        {
          medicine_id: 'med-3',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result.items[0].monthlyCost).toBe(60) // Med2: 2.0 × 30
      expect(result.items[1].monthlyCost).toBe(30) // Med1: 1.0 × 30
      expect(result.items[2].monthlyCost).toBe(15) // Med3: 0.5 × 30
    })

    it('retorna objeto vazio quando nao ha medicamentos', () => {
      const result = calculateMonthlyCosts([], [])
      expect(result.items).toEqual([])
      expect(result.totalMonthly).toBe(0)
      expect(result.projection3m).toBe(0)
    })

    it('calcula totalMonthly corretamente', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Med1',
          stock: [{ quantity: 30, unit_price: 10.0 }],
        },
        {
          id: 'med-2',
          name: 'Med2',
          stock: [{ quantity: 30, unit_price: 5.0 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
        {
          medicine_id: 'med-2',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      // Med1: 1 × 10 × 30 = 300
      // Med2: 1 × 5 × 30 = 150
      expect(result.totalMonthly).toBe(450)
    })

    it('retorna estrutura com campos obrigatorios', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 1.0 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('totalMonthly')
      expect(result).toHaveProperty('projection3m')
      expect(result.items[0]).toHaveProperty('medicineId')
      expect(result.items[0]).toHaveProperty('name')
      expect(result.items[0]).toHaveProperty('dailyIntake')
      expect(result.items[0]).toHaveProperty('avgUnitPrice')
      expect(result.items[0]).toHaveProperty('monthlyCost')
      expect(result.items[0]).toHaveProperty('hasPriceData')
    })

    it('inclui medicine com hasPriceData = true quando tem preco', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 1.0 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result.items[0].hasPriceData).toBe(true)
    })

    it('inclui medicine com hasPriceData = false quando nao tem preco', () => {
      const medicines = [
        {
          id: 'med-1',
          name: 'Losartana',
          stock: [{ quantity: 30, unit_price: 0 }],
        },
      ]
      const protocols = [
        {
          medicine_id: 'med-1',
          active: true,
          dosage_per_intake: 1,
          time_schedule: ['08:00'],
        },
      ]

      const result = calculateMonthlyCosts(medicines, protocols)

      expect(result.items[0].hasPriceData).toBe(false)
    })
  })

  // ============================================================
  // calculateProjection
  // ============================================================

  describe('calculateProjection', () => {
    it('calcula projecao para 3 meses (default)', () => {
      expect(calculateProjection(100)).toBe(300)
    })

    it('calcula projecao para 6 meses', () => {
      expect(calculateProjection(100, 6)).toBe(600)
    })

    it('calcula projecao para 1 mes', () => {
      expect(calculateProjection(187.5, 1)).toBe(187.5)
    })

    it('calcula projecao para 12 meses', () => {
      expect(calculateProjection(50, 12)).toBe(600)
    })

    it('retorna 0 para custo mensal 0', () => {
      expect(calculateProjection(0, 3)).toBe(0)
    })

    it('funciona com valores decimais', () => {
      expect(calculateProjection(123.45, 3)).toBeCloseTo(370.35, 1)
    })
  })

  // ============================================================
  // formatBRL
  // ============================================================

  describe('formatBRL', () => {
    it('formata valor inteiro', () => {
      const formatted = formatBRL(187)
      expect(formatted).toMatch(/^R\$\s*187,00/)
    })

    it('formata valor com centavos', () => {
      const formatted = formatBRL(187.5)
      expect(formatted).toMatch(/^R\$\s*187,50/)
    })

    it('formata valores grandes', () => {
      const formatted = formatBRL(10000)
      expect(formatted).toMatch(/10.000/)
    })

    it('formata zero', () => {
      const formatted = formatBRL(0)
      expect(formatted).toMatch(/^R\$\s*0,00/)
    })

    it('usa locale pt-BR (virgula para decimal, ponto para mil)', () => {
      const formatted = formatBRL(1234.56)
      // pt-BR: 1.234,56
      expect(formatted).toContain('1.234')
      expect(formatted).toContain('56')
    })

    it('funciona com valores muito pequenos', () => {
      const formatted = formatBRL(0.01)
      expect(formatted).toMatch(/^R\$/)
    })

    it('funciona com valores negativos', () => {
      const formatted = formatBRL(-50)
      expect(formatted).toMatch(/^-R\$/)
    })
  })
})
