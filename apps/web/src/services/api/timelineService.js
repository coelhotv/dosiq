/**
 * timelineService (web) — wrapper de leitura da timeline event-agnóstica (FP-3/ADR-050).
 *
 * Injeta o client Supabase no serviço core (`createTimelineService`, CON-023) e resolve
 * o fuso do usuário (`user_settings.timezone`, F1/ADR-049) ponta-a-ponta — fechamento do
 * G1 no caminho da timeline. A UI não conhece `dose_instances`: consome só `TimelineEvent[]`.
 *
 * ⚠️ AP-194: os limites de janela são UTC REAL. Derivamos o início/fim do mês no fuso do
 * usuário via `getStartOfDayISO`/`getEndOfDayISO` (que resolvem o offset IANA da data) — o
 * `tz` governa só a derivação do dia local de exibição, NUNCA desloca o filtro com wall-clock.
 *
 * @module services/api/timelineService
 */

import { supabase, getUserId } from '@shared/utils/supabase'
import { createTimelineService, TIMELINE_ORDER } from '@dosiq/core'
import { getStartOfDayISO, getEndOfDayISO } from '@utils/dateUtils'

const DEFAULT_TZ = 'America/Sao_Paulo'

const coreTimeline = createTimelineService({ client: supabase })

/** Dias no mês (month 0-based) sem `new Date` (R-020). */
function daysInMonth(year, month) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return month === 1 && isLeap ? 29 : days[month]
}

/**
 * Resolve o fuso do usuário a partir de `user_settings.timezone` (default SP).
 * @param {string} [userId] - reaproveitado quando já conhecido (evita round-trip).
 * @returns {Promise<string>} IANA timezone.
 */
export async function getUserTimezone(userId = null) {
  const resolvedUserId = userId || (await getUserId())
  const { data, error } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', resolvedUserId)
    .maybeSingle()
  if (error) return DEFAULT_TZ
  return data?.timezone || DEFAULT_TZ
}

/**
 * Lê a timeline de um mês (ano/mês 0-based, como `Date.getMonth()`) no fuso do usuário.
 * Janela = [00:00 do dia 1, 23:59:59.999 do último dia] no fuso, convertida a UTC real.
 *
 * @param {number} year
 * @param {number} month - 0-based (0 = janeiro).
 * @param {Object} [opts]
 * @param {Object<string,Object>} [opts.protocolsById] - enriquecimento de payload (nome/unidade).
 * @param {string} [opts.tz] - fuso já resolvido (evita query extra).
 * @param {'asc'|'desc'} [opts.order=TIMELINE_ORDER.ASC] - ordem por instante absoluto.
 * @returns {Promise<{ events: import('@dosiq/core').TimelineEvent[], tz: string }>}
 */
export async function getMonthTimeline(year, month, { protocolsById = {}, tz = null, order = TIMELINE_ORDER.ASC } = {}) {
  const userId = await getUserId()
  const resolvedTz = tz || (await getUserTimezone(userId))

  const mm = String(month + 1).padStart(2, '0')
  const lastDay = daysInMonth(year, month)
  const firstStr = `${year}-${mm}-01`
  const lastStr = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  const fromTs = getStartOfDayISO(firstStr, resolvedTz)
  const toTs = getEndOfDayISO(lastStr, resolvedTz)

  const events = await coreTimeline.getTimeline({
    userId,
    fromTs,
    toTs,
    tz: resolvedTz,
    order,
    protocolsById,
  })
  return { events, tz: resolvedTz }
}

export const timelineService = {
  getMonthTimeline,
  getUserTimezone,
}

export default timelineService
