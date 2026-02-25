/**
 * Prescription Service - Serviço para rastreamento de validade de receitas
 *
 * Este módulo contém funções puras para calcular o status de validade
 * de receitas médicas baseado na data de término do protocolo.
 *
 * @module prescriptionService
 */

import { parseLocalDate, getTodayLocal, daysDifference } from '@utils/dateUtils'

/**
 * Status possíveis para uma receita médica.
 * @readonly
 * @enum {string}
 */
export const PRESCRIPTION_STATUS = {
  VIGENTE: 'vigente',
  VENCENDO: 'vencendo',
  VENCIDA: 'vencida',
}

/**
 * Labels de status para exibição na interface.
 */
export const PRESCRIPTION_STATUS_LABELS = {
  [PRESCRIPTION_STATUS.VIGENTE]: 'Vigente',
  [PRESCRIPTION_STATUS.VENCENDO]: 'Vencendo',
  [PRESCRIPTION_STATUS.VENCIDA]: 'Vencida',
}

/**
 * Calcula o status de validade de uma receita médica baseado no protocolo.
 *
 * A lógica de status é:
 * - Se end_date for null: status = 'vigente', daysRemaining = null (sem expiração)
 * - Se hoje > end_date: status = 'vencida', daysRemaining = número negativo
 * - Se daysRemaining <= 30: status = 'vencendo', daysRemaining = calculado
 * - Caso contrário: status = 'vigente', daysRemaining = calculado
 *
 * @param {Object} protocol - Protocolo com campo end_date (string YYYY-MM-DD ou null)
 * @returns {{ status: string, daysRemaining: number|null }} Status da receita e dias restantes
 *
 * @example
 * // Receita sem data de término (ativa indefinidamente)
 * getPrescriptionStatus({ end_date: null })
 * // => { status: 'vigente', daysRemaining: null }
 *
 * @example
 * // Receita vencida
 * getPrescriptionStatus({ end_date: '2026-01-01' }) // hoje é 2026-02-25
 * // => { status: 'vencida', daysRemaining: -55 }
 *
 * @example
 * // Receita vencendo em 15 dias
 * getPrescriptionStatus({ end_date: '2026-03-12' }) // hoje é 2026-02-25
 * // => { status: 'vencendo', daysRemaining: 15 }
 *
 * @example
 * // Receita vigente com mais de 30 dias
 * getPrescriptionStatus({ end_date: '2026-06-01' }) // hoje é 2026-02-25
 * // => { status: 'vigente', daysRemaining: 96 }
 */
export function getPrescriptionStatus(protocol) {
  // Se não há data de término, a receita está sempre vigente
  if (!protocol.end_date) {
    return {
      status: PRESCRIPTION_STATUS.VIGENTE,
      daysRemaining: null,
    }
  }

  const today = parseLocalDate(getTodayLocal())
  const endDate = parseLocalDate(protocol.end_date)
  const remaining = daysDifference(today, endDate)

  // Se a data de término já passou
  if (remaining < 0) {
    return {
      status: PRESCRIPTION_STATUS.VENCIDA,
      daysRemaining: remaining,
    }
  }

  // Se está vencendo (30 dias ou menos)
  if (remaining <= 30) {
    return {
      status: PRESCRIPTION_STATUS.VENCENDO,
      daysRemaining: remaining,
    }
  }

  // Receita vigente com mais de 30 dias
  return {
    status: PRESCRIPTION_STATUS.VIGENTE,
    daysRemaining: remaining,
  }
}

/**
 * Filtra protocolos que estão com receita vencendo dentro do limite especificado.
 *
 * Retorna apenas protocolos com status 'vencendo' ou 'vencida', ordenados por
 * dias restantes (mais urgentes primeiro).
 *
 * @param {Array<Object>} protocols - Lista de protocolos com campo end_date
 * @param {number} [thresholdDays=30] - Limite de dias para considerar "vencendo"
 * @returns {Array<{ protocol: Object, status: string, daysRemaining: number|null }>} Protocolos filtrados com status
 *
 * @example
 * const protocols = [
 *   { id: 1, end_date: '2026-03-01' },  // vencendo em 4 dias
 *   { id: 2, end_date: '2026-06-01' },  // vigente
 *   { id: 3, end_date: null },          // sem expiração
 *   { id: 4, end_date: '2026-01-01' },  // vencida
 * ]
 *
 * getExpiringPrescriptions(protocols)
 * // => [
 * //   { protocol: { id: 4, ... }, status: 'vencida', daysRemaining: -55 },
 * //   { protocol: { id: 1, ... }, status: 'vencendo', daysRemaining: 4 },
 * // ]
 */
export function getExpiringPrescriptions(protocols, thresholdDays = 30) {
  const results = protocols
    .map((protocol) => ({
      protocol,
      ...getPrescriptionStatus(protocol),
    }))
    .filter((item) => {
      // Inclui apenas vencendo ou vencida
      return (
        item.status === PRESCRIPTION_STATUS.VENCENDO ||
        item.status === PRESCRIPTION_STATUS.VENCIDA
      )
    })
    // Filtra pelo threshold (apenas para status 'vencendo')
    .filter((item) => {
      if (item.status === PRESCRIPTION_STATUS.VENCIDA) {
        return true // Sempre inclui vencidas
      }
      // Para vencendo, verifica se está dentro do threshold
      return item.daysRemaining !== null && item.daysRemaining <= thresholdDays
    })
    // Ordena por urgência: vencidas primeiro, depois por dias restantes
    .sort((a, b) => {
      // Vencidas vêm primeiro
      if (a.status === PRESCRIPTION_STATUS.VENCIDA && b.status !== PRESCRIPTION_STATUS.VENCIDA) {
        return -1
      }
      if (b.status === PRESCRIPTION_STATUS.VENCIDA && a.status !== PRESCRIPTION_STATUS.VENCIDA) {
        return 1
      }
      // Depois ordena por dias restantes (menos dias = mais urgente)
      return (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity)
    })

  return results
}

export default {
  getPrescriptionStatus,
  getExpiringPrescriptions,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_STATUS_LABELS,
}
