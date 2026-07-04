// treatmentStatus.js — helper canônico de status de tratamento (Fase 2.5 T1).
// Spec EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md §6.
//
// Origem: lógica idêntica vinha duplicada em apps/web em
// `_treatmentListUtils.resolveTabStatus`. Helper canônico permite paridade
// web↔mobile sem drift. Web adopt como wrapper no mesmo PR (G1 implícito).

import { formatLocalDate, getNow, isProtocolActiveOnDate } from './dateUtils'

export const TREATMENT_STATUS = Object.freeze({
  ATIVO: 'ativo',
  PAUSADO: 'pausado',
  FINALIZADO: 'finalizado',
})

/**
 * Resolve o status operacional de um tratamento.
 *
 * Ordem de precedência (igual à web em _treatmentListUtils.js):
 *   1. end_date && end_date < hoje  → FINALIZADO  (vence pausado)
 *   2. active === false             → PAUSADO
 *   3. caso contrário               → ATIVO
 *
 * @param {{ active?: boolean|null, end_date?: string|null }} protocol
 * @param {string} [today] — YYYY-MM-DD; default = hoje local
 * @returns {'ativo'|'pausado'|'finalizado'}
 */
export function resolveTreatmentStatus(protocol, today?: string) {
  const ref = today ?? formatLocalDate(getNow())
  if (protocol?.end_date && protocol.end_date < ref) return TREATMENT_STATUS.FINALIZADO
  if (protocol?.active === false) return TREATMENT_STATUS.PAUSADO
  return TREATMENT_STATUS.ATIVO
}

/**
 * Predicado canônico "tratamento operacionalmente ativo hoje" — evita repetir o
 * literal `=== 'ativo'` espalhado pelos callsites (modal bulk, listas, transformers).
 * Exclui FINALIZADO (end_date < hoje) e PAUSADO (active=false).
 *
 * @param {{ active?: boolean|null, end_date?: string|null }} protocol
 * @param {string} [today] — YYYY-MM-DD; default = hoje local
 * @returns {boolean}
 */
export function isTreatmentActive(protocol, today) {
  if (!protocol) return false
  return resolveTreatmentStatus(protocol, today) === TREATMENT_STATUS.ATIVO
}

/**
 * Predicado canônico para SUPERFÍCIES DE SELEÇÃO DE DOSE (modal bulk mobile, FAB
 * global de doses web): tratamento elegível para registrar dose HOJE.
 *
 * Exige AMBOS:
 *   1. status operacional ATIVO (active=true, não pausado, end_date >= hoje), e
 *   2. data de hoje DENTRO do período [start_date, end_date] (end inclusivo).
 *
 * Diferença vs `isTreatmentActive`: este TAMBÉM exclui tratamentos FUTUROS
 * (start_date > hoje), que `resolveTreatmentStatus` classifica como ATIVO por não
 * olhar start_date. Sem isto, prescrições futuras/encerradas do mesmo plano vazam
 * na modal de registro (bug prod 039).
 *
 * @param {{ active?: boolean|null, start_date?: string|null, end_date?: string|null }} protocol
 * @param {string} [today] — YYYY-MM-DD; default = hoje local
 * @returns {boolean}
 */
export function isTreatmentSchedulableOn(protocol, today?: string) {
  if (!protocol) return false
  const ref = today ?? formatLocalDate(getNow())
  return isTreatmentActive(protocol, ref) && isProtocolActiveOnDate(protocol, ref)
}
