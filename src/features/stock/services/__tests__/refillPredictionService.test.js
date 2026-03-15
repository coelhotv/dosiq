// src/features/stock/services/__tests__/refillPredictionService.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { predictRefill, predictAllRefills } from '../refillPredictionService'

describe('refillPredictionService', () => {
  beforeEach(() => {
    // Usar data fixa para evitar flakiness perto de meia-noite (fix: Gemini issue #7)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('predictRefill', () => {
    it('calcula previsao com consumo real (>=14 dias de dados)', () => {
      // 30 logs em 15 dias, quantity_taken=1 cada, currentStock=30
      // dailyConsumption = 30/15 = 2, daysRemaining = 30/2 = 15
      // isRealData=true, confidence='medium' (15 dias)

      const now = new Date()
      const logs = []
      // Create 30 logs over 15 days (2 logs per day)
      for (let i = 0; i < 15; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 30,
        logs,
        protocols: [],
      })

      expect(result.dailyConsumption).toBe(2)
      expect(result.daysRemaining).toBe(15)
      expect(result.isRealData).toBe(true)
      expect(result.confidence).toBe('medium')
    })

    it('usa consumo teorico quando dados insuficientes (<14 dias)', () => {
      // 5 logs em 5 dias, protocolo diario 2x/dia
      // dailyConsumption = 2 (teorico), isRealData=false, confidence='low'

      const now = new Date()
      const logs = []
      for (let i = 0; i < 5; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          frequency: 'diário',
          time_schedule: ['08:00', '20:00'],
          active: true,
        },
      ]

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 30,
        logs,
        protocols,
      })

      expect(result.isRealData).toBe(false)
      expect(result.confidence).toBe('low')
      expect(result.dailyConsumption).toBe(2)
    })

    it('retorna confidence high com >=21 dias', () => {
      // 42 logs em 21 dias
      // confidence='high'

      const now = new Date()
      const logs = []
      for (let i = 0; i < 21; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 30,
        logs,
        protocols: [],
      })

      expect(result.confidence).toBe('high')
    })

    it('retorna Infinity quando dailyConsumption e 0', () => {
      // Med sem protocolo, sem logs
      // daysRemaining = Infinity, predictedStockoutDate = null

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 30,
        logs: [],
        protocols: [],
      })

      expect(result.daysRemaining).toBe(Infinity)
      expect(result.predictedStockoutDate).toBeNull()
    })

    it('calcula data de stockout corretamente', () => {
      // currentStock=10, dailyConsumption=2
      // daysRemaining=5, predictedStockoutDate = hoje + 5 dias

      const now = new Date()
      const logs = []
      // 14+ days of data
      for (let i = 0; i < 14; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 2 })
      }

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 10,
        logs,
        protocols: [],
      })

      expect(result.daysRemaining).toBe(5)
      expect(result.predictedStockoutDate).not.toBeNull()
    })

    it('lida com estoque zero', () => {
      // currentStock=0
      // daysRemaining=0

      const result = predictRefill({
        medicineId: 'med-1',
        currentStock: 0,
        logs: [],
        protocols: [],
      })

      expect(result.daysRemaining).toBe(0)
    })
  })

  describe('predictAllRefills', () => {
    it('ordena por daysRemaining ASC (mais urgente primeiro)', () => {
      const medicines = [
        { id: 'med-1', name: 'Medicine A' },
        { id: 'med-2', name: 'Medicine B' },
        { id: 'med-3', name: 'Medicine C' },
      ]
      const stocks = [
        { medicine_id: 'med-1', quantity: 30 },
        { medicine_id: 'med-2', quantity: 10 },
        { medicine_id: 'med-3', quantity: 20 },
      ]

      const now = new Date()
      const logs = []

      // med-1: 15 days of data -> 30/2 = 15 days
      for (let i = 0; i < 15; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
        logs.push({ medicine_id: 'med-1', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      // med-2: 14 days of data -> 10/2 = 5 days
      for (let i = 0; i < 14; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-2', taken_at: date.toISOString(), quantity_taken: 1 })
        logs.push({ medicine_id: 'med-2', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      // med-3: 21 days of data -> 20/1 = 20 days
      for (let i = 0; i < 21; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        logs.push({ medicine_id: 'med-3', taken_at: date.toISOString(), quantity_taken: 1 })
      }

      const result = predictAllRefills({ medicines, stocks, logs, protocols: [] })

      expect(result[0].medicineId).toBe('med-2') // 5 days
      expect(result[1].medicineId).toBe('med-1') // 15 days
      expect(result[2].medicineId).toBe('med-3') // 20 days
    })

    it('exclui medicamentos com estoque zero', () => {
      const medicines = [
        { id: 'med-1', name: 'Medicine A' },
        { id: 'med-2', name: 'Medicine B' },
      ]
      const stocks = [
        { medicine_id: 'med-1', quantity: 30 },
        { medicine_id: 'med-2', quantity: 0 },
      ]

      const result = predictAllRefills({ medicines, stocks, logs: [], protocols: [] })

      expect(result.length).toBe(1)
      expect(result[0].medicineId).toBe('med-1')
    })

    it('retorna array vazio quando nao ha estoque', () => {
      const medicines = [{ id: 'med-1', name: 'Medicine A' }]
      const stocks = [{ medicine_id: 'med-1', quantity: 0 }]

      const result = predictAllRefills({ medicines, stocks, logs: [], protocols: [] })

      expect(result).toEqual([])
    })
  })
})
