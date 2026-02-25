/**
 * Testes do Prescription Service
 *
 * Testa as funções de cálculo de status de validade de receitas médicas.
 *
 * @module prescriptionService.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getPrescriptionStatus,
  getExpiringPrescriptions,
  PRESCRIPTION_STATUS,
} from '../prescriptionService'

// Mock da data atual para testes determinísticos
// Fixamos a data em 2026-02-25 para todos os testes
const MOCK_TODAY = '2026-02-25'

vi.mock('@utils/dateUtils', () => ({
  parseLocalDate: (dateStr) => new Date(dateStr + 'T00:00:00'),
  getTodayLocal: () => MOCK_TODAY,
  daysDifference: (date1, date2) => {
    const d1 = typeof date1 === 'string' ? new Date(date1 + 'T00:00:00') : date1
    const d2 = typeof date2 === 'string' ? new Date(date2 + 'T00:00:00') : date2
    const diffTime = d2.getTime() - d1.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },
}))

describe('prescriptionService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getPrescriptionStatus', () => {
    describe('quando end_date é null', () => {
      it('retorna status vigente com daysRemaining null', () => {
        const protocol = { id: 1, end_date: null }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VIGENTE)
        expect(result.daysRemaining).toBeNull()
      })
    })

    describe('quando a receita está vigente (mais de 30 dias)', () => {
      it('retorna status vigente com dias restantes corretos', () => {
        // 2026-04-01 está a 35 dias de 2026-02-25
        const protocol = { id: 1, end_date: '2026-04-01' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VIGENTE)
        expect(result.daysRemaining).toBe(35)
      })

      it('retorna vigente quando exatamente 31 dias restantes', () => {
        // 2026-03-28 está a 31 dias de 2026-02-25
        const protocol = { id: 1, end_date: '2026-03-28' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VIGENTE)
        expect(result.daysRemaining).toBe(31)
      })
    })

    describe('quando a receita está vencendo (30 dias ou menos)', () => {
      it('retorna status vencendo quando exatamente 30 dias restantes', () => {
        // 2026-03-27 está a 30 dias de 2026-02-25
        const protocol = { id: 1, end_date: '2026-03-27' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCENDO)
        expect(result.daysRemaining).toBe(30)
      })

      it('retorna status vencendo quando 7 dias restantes', () => {
        // 2026-03-04 está a 7 dias de 2026-02-25
        const protocol = { id: 1, end_date: '2026-03-04' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCENDO)
        expect(result.daysRemaining).toBe(7)
      })

      it('retorna status vencendo quando 1 dia restante', () => {
        // 2026-02-26 está a 1 dia de 2026-02-25
        const protocol = { id: 1, end_date: '2026-02-26' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCENDO)
        expect(result.daysRemaining).toBe(1)
      })

      it('retorna status vencendo quando 0 dias restantes (vence hoje)', () => {
        // 2026-02-25 é hoje
        const protocol = { id: 1, end_date: '2026-02-25' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCENDO)
        expect(result.daysRemaining).toBe(0)
      })
    })

    describe('quando a receita está vencida', () => {
      it('retorna status vencida com dias negativos', () => {
        // 2026-01-01 está -55 dias de 2026-02-25
        const protocol = { id: 1, end_date: '2026-01-01' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCIDA)
        expect(result.daysRemaining).toBe(-55)
      })

      it('retorna status vencida quando venceu ontem', () => {
        // 2026-02-24 está -1 dia de 2026-02-25
        const protocol = { id: 1, end_date: '2026-02-24' }

        const result = getPrescriptionStatus(protocol)

        expect(result.status).toBe(PRESCRIPTION_STATUS.VENCIDA)
        expect(result.daysRemaining).toBe(-1)
      })
    })
  })

  describe('getExpiringPrescriptions', () => {
    it('retorna apenas receitas vencendo ou vencidas', () => {
      const protocols = [
        { id: 1, end_date: '2026-06-01' }, // vigente (96 dias)
        { id: 2, end_date: '2026-03-05' }, // vencendo (8 dias)
        { id: 3, end_date: null }, // sem expiração
        { id: 4, end_date: '2026-01-15' }, // vencida (-41 dias)
      ]

      const result = getExpiringPrescriptions(protocols)

      expect(result).toHaveLength(2)
      expect(result[0].protocol.id).toBe(4) // vencida vem primeiro
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
      expect(result[1].protocol.id).toBe(2)
      expect(result[1].status).toBe(PRESCRIPTION_STATUS.VENCENDO)
    })

    it('ordena por urgência: vencidas primeiro, depois por dias restantes', () => {
      const protocols = [
        { id: 1, end_date: '2026-03-01' }, // vencendo (4 dias)
        { id: 2, end_date: '2026-02-28' }, // vencendo (3 dias)
        { id: 3, end_date: '2026-01-01' }, // vencida (-55 dias)
        { id: 4, end_date: '2026-02-26' }, // vencendo (1 dia)
      ]

      const result = getExpiringPrescriptions(protocols)

      expect(result).toHaveLength(4)
      // Vencida vem primeiro
      expect(result[0].protocol.id).toBe(3)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
      // Depois ordenado por dias restantes (menor = mais urgente)
      expect(result[1].protocol.id).toBe(4) // 1 dia
      expect(result[2].protocol.id).toBe(2) // 3 dias
      expect(result[3].protocol.id).toBe(1) // 4 dias
    })

    it('retorna array vazio quando não há receitas vencendo ou vencidas', () => {
      const protocols = [
        { id: 1, end_date: '2026-06-01' }, // vigente
        { id: 2, end_date: null }, // sem expiração
        { id: 3, end_date: '2026-12-01' }, // vigente
      ]

      const result = getExpiringPrescriptions(protocols)

      expect(result).toHaveLength(0)
    })

    it('respeita o threshold customizado de dias', () => {
      const protocols = [
        { id: 1, end_date: '2026-03-15' }, // 18 dias (fora do threshold de 10)
        { id: 2, end_date: '2026-03-02' }, // 5 dias (dentro do threshold de 10)
        { id: 3, end_date: '2026-01-01' }, // vencida
      ]

      const result = getExpiringPrescriptions(protocols, 10)

      expect(result).toHaveLength(2)
      expect(result[0].protocol.id).toBe(3) // vencida
      expect(result[1].protocol.id).toBe(2) // 5 dias
    })

    it('inclui todas as vencidas independente do threshold', () => {
      const protocols = [
        { id: 1, end_date: '2026-01-01' }, // vencida (-55 dias)
        { id: 2, end_date: '2026-01-15' }, // vencida (-41 dias)
      ]

      const result = getExpiringPrescriptions(protocols, 7)

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
      expect(result[1].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
    })

    it('retorna objeto com protocol, status e daysRemaining', () => {
      const protocols = [{ id: 1, end_date: '2026-03-01' }]

      const result = getExpiringPrescriptions(protocols)

      expect(result[0]).toHaveProperty('protocol')
      expect(result[0]).toHaveProperty('status')
      expect(result[0]).toHaveProperty('daysRemaining')
      expect(result[0].protocol.id).toBe(1)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCENDO)
      expect(result[0].daysRemaining).toBe(4)
    })
  })
})
