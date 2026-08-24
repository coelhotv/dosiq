/**
 * Testes do Prescription Service
 *
 * Após a spec 073 PR 3 (ADR-095) este serviço só FILTRA e ORDENA — quem
 * classifica é `derivePrescriptionStatus` do core, com janela de 14 dias.
 * Por isso as datas aqui são RELATIVAS (`dateOffset`): a vigência passou a ser
 * lida contra o relógio real, e data fixa vira bomba-relógio.
 *
 * @module prescriptionService.test
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { PRESCRIPTION_STATUS } from '@dosiq/core'
import { getExpiringPrescriptions } from '@/features/prescriptions/services/prescriptionService'
import { dateOffset } from '@/test/fixtures/clinicalSurfaces'

describe('prescriptionService', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('getExpiringPrescriptions', () => {
    it('retorna apenas receitas vencendo ou vencidas', () => {
      const protocols = [
        { id: 1, end_date: dateOffset(96) }, // ativa
        { id: 2, end_date: dateOffset(8) }, // vencendo
        { id: 3, end_date: null }, // sem expiração
        { id: 4, end_date: dateOffset(-41) }, // vencida
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
        { id: 1, end_date: dateOffset(4) },
        { id: 2, end_date: dateOffset(3) },
        { id: 3, end_date: dateOffset(-55) },
        { id: 4, end_date: dateOffset(1) },
      ]

      const result = getExpiringPrescriptions(protocols)

      expect(result).toHaveLength(4)
      expect(result[0].protocol.id).toBe(3) // vencida
      expect(result[1].protocol.id).toBe(4) // 1 dia
      expect(result[2].protocol.id).toBe(2) // 3 dias
      expect(result[3].protocol.id).toBe(1) // 4 dias
    })

    it('retorna array vazio quando não há receitas vencendo ou vencidas', () => {
      const protocols = [
        { id: 1, end_date: dateOffset(96) },
        { id: 2, end_date: null },
        { id: 3, end_date: dateOffset(280) },
      ]

      expect(getExpiringPrescriptions(protocols)).toHaveLength(0)
    })

    // AC-9: a janela é a canônica do core (14 dias). O parâmetro `thresholdDays`
    // e o literal 30 da web foram DELETADOS — 18 dias não alerta mais.
    it('AC-9: a janela é 14 dias — 15 dias não alerta, 14 alerta', () => {
      const result = getExpiringPrescriptions([
        { id: 1, end_date: dateOffset(15) },
        { id: 2, end_date: dateOffset(14) },
      ])

      expect(result).toHaveLength(1)
      expect(result[0].protocol.id).toBe(2)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCENDO)
    })

    it('inclui todas as vencidas, sem limite de antiguidade', () => {
      const result = getExpiringPrescriptions([
        { id: 1, end_date: dateOffset(-55) },
        { id: 2, end_date: dateOffset(-41) },
      ])

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
      expect(result[1].status).toBe(PRESCRIPTION_STATUS.VENCIDA)
    })

    // AC-8 · ADR-095: tratamento encerrado é 'finalizada' no core, não 'vencendo'.
    // Antes do PR 3 ele aparecia na lista de renovação (073/F-4).
    it('AC-8: tratamento com active === false NÃO entra na lista', () => {
      const result = getExpiringPrescriptions([
        { id: 1, end_date: dateOffset(3), active: false },
        { id: 2, end_date: dateOffset(-3), active: false },
        { id: 3, end_date: dateOffset(3), active: true },
      ])

      expect(result).toHaveLength(1)
      expect(result[0].protocol.id).toBe(3)
    })

    it('retorna objeto com protocol, status e daysRemaining', () => {
      const result = getExpiringPrescriptions([{ id: 1, end_date: dateOffset(4) }])

      expect(result[0]).toHaveProperty('protocol')
      expect(result[0]).toHaveProperty('status')
      expect(result[0].protocol.id).toBe(1)
      expect(result[0].status).toBe(PRESCRIPTION_STATUS.VENCENDO)
      expect(result[0].daysRemaining).toBe(4)
    })

    it('daysRemaining é negativo para vencida e null sem end_date', () => {
      const [vencida] = getExpiringPrescriptions([{ id: 1, end_date: dateOffset(-4) }])
      expect(vencida.daysRemaining).toBe(-4)
      expect(getExpiringPrescriptions([{ id: 2, end_date: null }])).toHaveLength(0)
    })
  })
})
