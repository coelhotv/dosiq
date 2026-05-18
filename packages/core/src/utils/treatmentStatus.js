// treatmentStatus.js — helper canônico de status de tratamento (Fase 2.5 T1).
// Spec EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md §6.
//
// Origem: lógica idêntica vinha duplicada em apps/web em
// `_treatmentListUtils.resolveTabStatus`. Helper canônico permite paridade
// web↔mobile sem drift. Web adopt como wrapper no mesmo PR (G1 implícito).

import { formatLocalDate, getNow } from './dateUtils.js'

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
export function resolveTreatmentStatus(protocol, today) {
  const ref = today ?? formatLocalDate(getNow())
  if (protocol?.end_date && protocol.end_date < ref) return TREATMENT_STATUS.FINALIZADO
  if (protocol?.active === false) return TREATMENT_STATUS.PAUSADO
  return TREATMENT_STATUS.ATIVO
}
