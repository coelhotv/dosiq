/**
 * Prescription Service - Serviço para rastreamento de validade de receitas
 *
 * Fonte ÚNICA de status: `derivePrescriptionStatus` do `@dosiq/core` (ADR-095).
 * A cópia local (`getPrescriptionStatus`, `PRESCRIPTION_STATUS`, janela de 30 dias)
 * foi deletada no PR 3 da spec 073 — o app e o PDF divergiam sobre a mesma receita.
 *
 * @module prescriptionService
 */

import { parseLocalDate, getTodayLocal, daysDifference } from '@utils/dateUtils'
import { derivePrescriptionStatus, PRESCRIPTION_STATUS } from '@dosiq/core'

/**
 * Dias restantes até o fim da vigência (negativo = vencida há N dias).
 * `null` quando não há `end_date` — não existe prazo a contar.
 * @private
 */
function _daysRemaining(protocol) {
  if (!protocol?.end_date) return null
  return daysDifference(parseLocalDate(getTodayLocal()), parseLocalDate(protocol.end_date))
}

/**
 * Filtra protocolos cuja receita exige atenção: vencidas e vencendo dentro da
 * janela canônica do core (`PRESCRIPTION_EXPIRY_WARNING_DAYS` = 14 dias).
 *
 * Ordenados por urgência (vencidas primeiro, depois menos dias restantes).
 *
 * Tratamento encerrado (`active === false`) NÃO entra: o core o classifica como
 * 'finalizada' (ADR-095) e pedir renovação dele é ruído clínico (073/F-4).
 *
 * @param {Array<Object>} protocols - Lista de protocolos com `end_date` e `active`
 * @returns {Array<{ protocol: Object, status: string, daysRemaining: number|null }>}
 *
 * @example
 * getExpiringPrescriptions([
 *   { id: 1, end_date: '2026-03-01' },  // vencendo em 4 dias
 *   { id: 2, end_date: '2026-06-01' },  // ativa
 *   { id: 3, end_date: null },          // sem expiração
 *   { id: 4, end_date: '2026-01-01' },  // vencida
 * ])
 * // => [
 * //   { protocol: { id: 4, ... }, status: 'vencida', daysRemaining: -55 },
 * //   { protocol: { id: 1, ... }, status: 'vencendo', daysRemaining: 4 },
 * // ]
 */
export function getExpiringPrescriptions(protocols) {
  return protocols
    .map((protocol) => ({
      protocol,
      status: derivePrescriptionStatus(protocol),
      daysRemaining: _daysRemaining(protocol),
    }))
    .filter(
      (item) =>
        item.status === PRESCRIPTION_STATUS.VENCIDA || item.status === PRESCRIPTION_STATUS.VENCENDO
    )
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
}

export default {
  getExpiringPrescriptions,
}
