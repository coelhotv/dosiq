// prescriptionStatus.js — helper canônico de status de VIGÊNCIA de prescrição (038 Slice C).
//
// Origem: lógica vivia inline em apps/web `views/Stock.jsx::deriveProtocolStatus`,
// usada para colorir o badge do PrescriptionTimeline. Extraído para o core para
// paridade web↔mobile sem drift e para tornar a função pura testável.
//
// NÃO confundir com `resolveTreatmentStatus` (treatmentStatus.js): aquele resolve o
// status OPERACIONAL do tratamento ('ativo'|'pausado'|'finalizado', masculino); este
// resolve a VIGÊNCIA da prescrição/protocolo no tempo ('ativa'|'vencendo'|'vencida'|
// 'finalizada', feminino) com janela de alerta de 14 dias.

import { parseLocalDate, formatLocalDate, getNow } from './dateUtils'

export const PRESCRIPTION_STATUS = Object.freeze({
  ATIVA: 'ativa',
  VENCENDO: 'vencendo',
  VENCIDA: 'vencida',
  FINALIZADA: 'finalizada',
})

/** Dias de antecedência em que uma prescrição passa a contar como 'vencendo'. */
export const PRESCRIPTION_EXPIRY_WARNING_DAYS = 14

/** Milissegundos em um dia (24h). Evita número mágico no cálculo de vigência. */
const MS_PER_DAY = 86400000

/**
 * Resolve o status de vigência de uma prescrição/protocolo.
 *
 * Ordem de precedência (igual à web em Stock.jsx::deriveProtocolStatus):
 *   1. sem end_date              → ATIVA (vigência indeterminada)
 *   2. end_date no passado       → VENCIDA
 *   3. end_date hoje ou em ≤14d  → VENCENDO (válida até o fim do dia de término)
 *   4. active === false          → FINALIZADA
 *   5. caso contrário            → ATIVA
 *
 * Compara DATAS DE CALENDÁRIO (normaliza `now` para meia-noite local + `Math.round`),
 * não diferença de milissegundos em tempo real — senão uma prescrição que vence HOJE
 * apareceria como 'vencida' já ao meio-dia, e transições de DST distorceriam a contagem.
 *
 * @param {{ end_date?: string|null, active?: boolean|null }} protocol
 * @param {Date} [now] — referência temporal; default = agora (America/Sao_Paulo)
 * @returns {'ativa'|'vencendo'|'vencida'|'finalizada'}
 */
export function derivePrescriptionStatus(protocol, now = getNow()) {
  if (!protocol?.end_date) return PRESCRIPTION_STATUS.ATIVA
  const end = parseLocalDate(protocol.end_date)
  // Meia-noite local de hoje, sem `new Date()` (R-020): formata→reparse.
  const today = parseLocalDate(formatLocalDate(now))
  const daysLeft = Math.round((end.getTime() - today.getTime()) / MS_PER_DAY)
  if (daysLeft < 0) return PRESCRIPTION_STATUS.VENCIDA
  if (daysLeft <= PRESCRIPTION_EXPIRY_WARNING_DAYS) return PRESCRIPTION_STATUS.VENCENDO
  if (protocol.active === false) return PRESCRIPTION_STATUS.FINALIZADA
  return PRESCRIPTION_STATUS.ATIVA
}
