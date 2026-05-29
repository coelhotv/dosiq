/**
 * doseInstancePlanner — orquestra geração + persistência de dose_instances (ADR-048, Fase 2).
 *
 * Camada entre o gerador puro (`generateInstances`) e o repository de I/O
 * (`createDoseInstanceRepository`). Reusado por DOIS chamadores (DRY):
 *  - cron server-side (service_role) — varredura/renovação em lote;
 *  - lifecycle hooks da factory de protocolo (client authenticated) — geração imediata.
 *
 * Injeção de dependência: recebe `doseInstanceRepo` pronto → testável e agnóstico
 * de plataforma (qual client Supabase é detalhe do chamador).
 *
 * tz: default 'America/Sao_Paulo' (G1 — injeção real do tz do usuário fica para a
 * Fase 3; hoje 99% SP, consistente).
 */

import { generateInstances } from '../utils/doseInstanceGenerator.js'
import { parseISO, parseTimestamp, getServerTimestamp, getEndOfDayISO } from '../utils/dateUtils.js'

/** Janela padrão de geração para protocolos contínuos (sem end_date). */
export const WINDOW_DAYS = 30
/** Renova quando o high-water-mark está a menos de N dias do fim da janela. */
export const RENEWAL_THRESHOLD_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Fim-alvo da janela de geração de um protocolo, em ISO.
 * - com `end_date`: o fim do dia de end_date (não passa disso);
 * - contínuo: `baseTs + WINDOW_DAYS` dias.
 * @param {Object} protocol
 * @param {Date} baseDate - âncora (normalmente agora)
 * @returns {string} ISO UTC
 */
export function computeWindowEnd(protocol, baseDate) {
  const continuousEnd = parseTimestamp(baseDate.getTime() + WINDOW_DAYS * MS_PER_DAY).toISOString()
  if (!protocol.end_date) return continuousEnd
  const endOfEndDate = getEndOfDayISO(protocol.end_date) // ISO do fim do dia de end_date (tz default SP)
  // o menor entre (fim do protocolo) e (janela contínua)
  return parseISO(endOfEndDate).getTime() < parseISO(continuousEnd).getTime() ? endOfEndDate : continuousEnd
}

/**
 * Gera e persiste (idempotente) as instâncias de um protocolo numa janela [fromTs, toTs],
 * e avança o high-water-mark para toTs.
 * @param {Object} params
 * @param {Object} params.protocol
 * @param {Object} params.doseInstanceRepo - repo com upsertMany/setGeneratedThrough
 * @param {Date|string|number} params.fromTs
 * @param {Date|string|number} params.toTs
 * @param {string} [params.tz]
 * @returns {Promise<number>} nº de instâncias geradas (antes do ON CONFLICT)
 */
export async function planWindow({ protocol, doseInstanceRepo, fromTs, toTs, tz = 'America/Sao_Paulo' }) {
  const instances = generateInstances(protocol, fromTs, toTs, tz)
  if (instances.length > 0) {
    await doseInstanceRepo.upsertMany(instances)
  }
  await doseInstanceRepo.setGeneratedThrough(protocol.id, toTs)
  return instances.length
}

/**
 * Rede de segurança lazy: garante que o protocolo tenha instâncias geradas até `ts`.
 * Gera apenas o gap entre o high-water-mark e `ts` (capado no fim do protocolo).
 * No-op se já coberto.
 * @returns {Promise<number>} instâncias geradas no gap (0 se já coberto)
 */
export async function ensureInstancesUpTo({ protocol, doseInstanceRepo, ts, tz = 'America/Sao_Paulo' }) {
  const nowMs = parseISO(getServerTimestamp()).getTime()
  const requestedMs = parseISO(toIsoLike(ts)).getTime()
  // alvo efetivo = min(ts pedido, fim-alvo da janela do protocolo)
  const windowEndIso = computeWindowEnd(protocol, parseTimestamp(requestedMs))
  const targetMs = Math.min(requestedMs, parseISO(windowEndIso).getTime())
  const target = parseTimestamp(targetMs).toISOString()

  const hwm = await doseInstanceRepo.getGeneratedThrough(protocol.id)
  if (hwm && parseISO(hwm).getTime() >= targetMs) return 0 // já coberto

  // Clamp: nunca gerar a partir do passado (evita criar `pending` retroativo se o
  // hwm ficar atrás de `now` — backfill histórico é responsabilidade de outro fluxo).
  const fromMs = Math.max(hwm ? parseISO(hwm).getTime() : nowMs, nowMs)
  return planWindow({ protocol, doseInstanceRepo, fromTs: parseTimestamp(fromMs).toISOString(), toTs: target, tz })
}

/** Converte Date|ISO|ms em ISO (R-020: sem `new Date()` direto). Null-safe. */
function toIsoLike(value) {
  if (value === null || value === undefined) return getServerTimestamp()
  if (typeof value === 'number') return parseTimestamp(value).toISOString()
  if (typeof value === 'string') return value
  if (typeof value.getTime === 'function') return parseTimestamp(value.getTime()).toISOString()
  return getServerTimestamp()
}

/**
 * Renova a janela de um protocolo se o high-water-mark se aproxima do fim
 * (usado pelo cron). Gera de `now` (ou do hwm) até `now + WINDOW_DAYS`.
 * Não regenera se o hwm ainda está longe do fim.
 * @returns {Promise<number>} instâncias geradas (0 se não precisou renovar)
 */
export async function renewProtocolWindow({ protocol, doseInstanceRepo, now = parseISO(getServerTimestamp()), tz = 'America/Sao_Paulo' }) {
  const targetIso = computeWindowEnd(protocol, now)
  const targetMs = parseISO(targetIso).getTime()
  const hwm = await doseInstanceRepo.getGeneratedThrough(protocol.id)

  if (hwm) {
    const hwmMs = parseISO(hwm).getTime()
    if (hwmMs >= targetMs) return 0 // janela já cobre o alvo
    const thresholdMs = now.getTime() + RENEWAL_THRESHOLD_DAYS * MS_PER_DAY
    if (hwmMs > thresholdMs) return 0 // ainda longe do fim — não renova ainda
    // Clamp: nunca gerar a partir do passado (sem `pending` retroativo).
    const fromMs = Math.max(hwmMs, now.getTime())
    return planWindow({ protocol, doseInstanceRepo, fromTs: parseTimestamp(fromMs).toISOString(), toTs: targetIso, tz })
  }
  // nunca gerado: gera do agora até o alvo
  return planWindow({ protocol, doseInstanceRepo, fromTs: now.toISOString(), toTs: targetIso, tz })
}
