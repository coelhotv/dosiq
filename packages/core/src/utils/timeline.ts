/**
 * timeline — Modelo de evento aberto + builder puro de linha do tempo.
 *
 * Realização do FP-3 (ADR-050): o histórico é uma stream de eventos tipados,
 * ordenada por instante absoluto (`occurred_at`, UTC), aberta a múltiplos tipos
 * (`dose` hoje; `biomarker`/`note` depois) sem reescrever builder nem UI.
 *
 * O builder é PURO (sem I/O). Adapters (timelineService) convertem fontes
 * concretas (`dose_instances`/`medicine_logs`, futuramente `biomarkers_log`)
 * em `TimelineEvent[]` ANTES de chamar `buildTimeline`. O builder não conhece
 * nenhuma fonte — só ordena por instante e deriva o dia local no fuso.
 *
 * @module timeline
 */

import { getUserTime, formatLocalDate, parseISO } from './dateUtils'

/**
 * @typedef {Object} TimelineEvent
 * @property {string} id - Identificador único do evento (estável).
 * @property {string} type - Tipo do evento (string aberta; ex: 'dose'). R-021.
 * @property {string} occurred_at - Instante absoluto em ISO 8601 (UTC).
 * @property {Object} payload - Dados específicos do tipo (medicine, status, ...).
 * @property {string} [localDay] - Dia local (YYYY-MM-DD) derivado pelo builder no `tz`.
 */

/**
 * Tipos de evento conhecidos. A interface é ABERTA — novos tipos entram por
 * adapter sem alterar o builder. Esta constante só documenta os tipos já
 * produzidos; `type` aceita qualquer string.
 */
export const TIMELINE_EVENT_TYPES = Object.freeze({
  DOSE: 'dose',
  BIOMARKER: 'biomarker',
})

/** Ordem de saída da stream. */
export const TIMELINE_ORDER = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
})

const DEFAULT_TZ = 'America/Sao_Paulo'

/**
 * Deriva o dia local (YYYY-MM-DD) de um instante absoluto no fuso informado.
 * Cross-meia-noite: um evento 23:50 e outro 00:10 (UTC convertidos ao tz) caem
 * em dias locais distintos mas permanecem adjacentes na ordem absoluta.
 *
 * @param {string} occurredAt - ISO 8601 (UTC).
 * @param {string} [tz=DEFAULT_TZ] - Timezone IANA.
 * @returns {string|null} YYYY-MM-DD no fuso, ou null se inválido.
 */
export function deriveLocalDay(occurredAt, tz = DEFAULT_TZ) {
  const d = parseISO(occurredAt)
  if (Number.isNaN(d.getTime())) return null
  return formatLocalDate(getUserTime(d, tz))
}

/**
 * Constrói a linha do tempo a partir de eventos já normalizados.
 *
 * PURO: sem I/O, sem mutação dos eventos de entrada. Ordena por instante
 * absoluto (`occurred_at`) e anexa `localDay` derivado no `tz`. O agrupamento
 * por dia é DERIVADO (ver `groupByLocalDay`) e nunca altera a ordem absoluta.
 *
 * Eventos sem `occurred_at` válido são descartados (não quebram a stream).
 * Desempate determinístico por `id` quando o instante coincide.
 *
 * @param {TimelineEvent[]} events - Eventos de qualquer `type`.
 * @param {Object} [opts]
 * @param {string} [opts.tz=DEFAULT_TZ] - Timezone IANA para derivar `localDay`.
 * @param {'asc'|'desc'} [opts.order=TIMELINE_ORDER.DESC] - Ordem por instante.
 * @returns {TimelineEvent[]} Eventos ordenados, cada um com `localDay`.
 */
export function buildTimeline(events, { tz = DEFAULT_TZ, order = TIMELINE_ORDER.DESC as 'asc' | 'desc' } = {}) {
  if (!Array.isArray(events)) return []

  const annotated = []
  for (const ev of events) {
    if (!ev || !ev.occurred_at) continue
    const ts = parseISO(ev.occurred_at).getTime()
    if (Number.isNaN(ts)) continue
    annotated.push({ ev, ts })
  }

  const dir = order === TIMELINE_ORDER.ASC ? 1 : -1
  annotated.sort((a, b) => {
    if (a.ts !== b.ts) return dir * (a.ts - b.ts)
    // Desempate estável e determinístico por id (independe da ordem de entrada).
    const aId = String(a.ev.id ?? '')
    const bId = String(b.ev.id ?? '')
    return aId < bId ? -1 : aId > bId ? 1 : 0
  })

  return annotated.map(({ ev }) => ({ ...ev, localDay: deriveLocalDay(ev.occurred_at, tz) }))
}

/**
 * Agrupa eventos JÁ ordenados (saída de `buildTimeline`) por `localDay`,
 * preservando a ordem absoluta dentro de cada grupo e entre grupos.
 *
 * Derivação de exibição apenas — não recalcula nem reordena instantes.
 *
 * @param {TimelineEvent[]} events - Saída de `buildTimeline` (com `localDay`).
 * @returns {Array<{ localDay: string, events: TimelineEvent[] }>}
 */
export function groupByLocalDay(events) {
  if (!Array.isArray(events)) return []
  const groups = []
  let current = null
  for (const ev of events) {
    const day = ev.localDay ?? deriveLocalDay(ev.occurred_at)
    if (!current || current.localDay !== day) {
      current = { localDay: day, events: [] }
      groups.push(current)
    }
    current.events.push(ev)
  }
  return groups
}
