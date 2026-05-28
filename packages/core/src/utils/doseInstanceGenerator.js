/**
 * doseInstanceGenerator — motor de geração de ocorrências de dose (ADR-048, Fase 2).
 *
 * Funções PURAS (sem I/O): dado um protocolo + janela [fromTs, toTs] + fuso do
 * usuário, produz as linhas a materializar em `dose_instances`.
 *
 * Princípios:
 * - REUSA `isProtocolActiveOnDate` (adherenceLogic) como fonte única de recorrência.
 *   Não reimplementa frequência → gerador e adesão enxergam os mesmos dias.
 *   ⚠️ Gap conhecido (AP futuro): o matcher de `isProtocolActiveOnDate` ainda não
 *   cobre `dias_alternados`/`personalizado` corretamente (vide adherenceLogic
 *   FREQUENCY_MATCHERS). Como nenhum protocolo em prod usa essas frequências hoje
 *   e o fix muda comportamento de adesão (fora do escopo F2.1), o gerador herda o
 *   comportamento atual — consistente com o que o dashboard mostra. Corrigir na Fase 3.
 * - `scheduled_for` é instante absoluto (ISO/UTC). O `tz` só governa o wall-clock de
 *   origem (que horas o relógio do usuário marcava). Leitura/ordenação é tz-agnóstica
 *   por ser timestamptz. Brasil não tem DST → offset constante dentro do dia.
 * - PRN (`quando_necessário`) nunca gera instâncias.
 */

import {
  getStartOfDayISO,
  getUserTime,
  formatLocalDate,
  parseISO,
  parseTimestamp,
} from './dateUtils.js'
import { isProtocolActiveOnDate } from './adherenceLogic.js'

/**
 * Converte Date | ISO string | timestamp(ms) num Date absoluto.
 * Usa helpers de dateUtils (R-020: nunca `new Date()` direto fora de dateUtils).
 * @param {Date|string|number} value
 * @returns {Date}
 */
function toInstant(value) {
  if (value instanceof Date) return value
  if (typeof value === 'number') return parseTimestamp(value)
  return parseISO(value)
}

/** Frequências que não materializam ocorrências (sob demanda). */
const PRN_FREQUENCIES = new Set(['quando_necessário', 'when_needed', 'prn'])

/** Frequências "diárias" elegíveis a janela de tolerância dinâmica (§6). */
const DAILY_FREQUENCIES = new Set(['diário', 'diariamente', 'daily'])

const MAX_TOLERANCE_MINUTES = 120

/**
 * Converte "HH:MM" em minutos desde a meia-noite. Retorna null se inválido.
 * @param {string} time
 * @returns {number|null}
 */
function timeToMinutes(time) {
  if (typeof time !== 'string') return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/**
 * Calcula a tolerância (minutos) de cada slot do dia.
 *
 * - Diário multi-dose: por slot, metade do menor intervalo adjacente (anterior/próximo),
 *   com teto de 120 — garante que janelas de slots vizinhos não se sobreponham.
 *   ⚠️ Considera o wrap-around da meia-noite: como o protocolo diário repete os mesmos
 *   slots todo dia, a última dose do dia N e a primeira do dia N+1 são adjacentes no
 *   tempo real. Sem isso, doses tipo 23:30/00:30 teriam janelas de 120min sobrepostas.
 * - Não-diário ou dose única: 120 fixo (§6 MASTER_PLAN).
 *
 * @param {number[]} sortedMinutes - minutos dos slots, ordenados ascendente
 * @param {boolean} isDaily
 * @returns {number[]} tolerância por slot (mesma ordem de sortedMinutes)
 */
function computeTolerances(sortedMinutes, isDaily) {
  if (!isDaily || sortedMinutes.length < 2) {
    return sortedMinutes.map(() => MAX_TOLERANCE_MINUTES)
  }
  const len = sortedMinutes.length
  const MINUTES_PER_DAY = 1440
  return sortedMinutes.map((minute, i) => {
    // Para o 1º/último slot, o intervalo adjacente cruza a meia-noite (wrap-around).
    const prevGap = i > 0
      ? minute - sortedMinutes[i - 1]
      : (MINUTES_PER_DAY - sortedMinutes[len - 1]) + minute
    const nextGap = i < len - 1
      ? sortedMinutes[i + 1] - minute
      : (MINUTES_PER_DAY - minute) + sortedMinutes[0]
    const smallestAdjacent = Math.min(prevGap, nextGap)
    // metade do menor intervalo adjacente (arredonda p/ baixo), teto 120
    return Math.min(Math.floor(smallestAdjacent / 2), MAX_TOLERANCE_MINUTES)
  })
}

/**
 * Constrói o instante absoluto (ISO UTC) para uma data local + minutos do dia, no fuso.
 * Reusa getStartOfDayISO (offset do fuso descoberto via Intl, Hermes-safe) e soma os
 * minutos do wall-clock. Brasil sem DST → soma linear é exata.
 * @param {string} dateStr - YYYY-MM-DD (data local no fuso)
 * @param {number} minutesOfDay
 * @param {string} tz
 * @returns {string} ISO 8601 UTC
 */
function buildScheduledFor(dateStr, minutesOfDay, tz) {
  const startOfDayMs = parseISO(getStartOfDayISO(dateStr, tz)).getTime()
  return parseTimestamp(startOfDayMs + minutesOfDay * 60 * 1000).toISOString()
}

/**
 * Itera as datas locais (YYYY-MM-DD, no fuso) entre dois instantes, inclusive.
 * @param {Date} fromDate
 * @param {Date} toDate
 * @param {string} tz
 * @returns {string[]}
 */
function localDateRange(fromDate, toDate, tz) {
  const dates = []
  // Itera em UTC (T00:00:00Z + setUTCDate): imune a DST e ao fuso do ambiente de
  // execução (servidor Vercel ou device móvel em fuso arbitrário). UTC não tem
  // transições, então cada incremento é exatamente 24h. parseISO mantém R-020.
  const cursor = parseISO(formatLocalDate(getUserTime(fromDate, tz)) + 'T00:00:00Z')
  const last = parseISO(formatLocalDate(getUserTime(toDate, tz)) + 'T00:00:00Z')
  while (cursor <= last) {
    const y = cursor.getUTCFullYear()
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
    const d = String(cursor.getUTCDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

/**
 * Gera as ocorrências de dose de um protocolo na janela [fromTs, toTs].
 *
 * @param {Object} protocol - linha de `protocols` (id, user_id, frequency, time_schedule,
 *                            dosage_per_intake, start_date, end_date, weekdays, active)
 * @param {Date|string|number} fromTs - início da janela (instante absoluto)
 * @param {Date|string|number} toTs - fim da janela (instante absoluto, inclusive)
 * @param {string} [tz='America/Sao_Paulo'] - fuso do usuário (user_settings.timezone)
 * @returns {Array<{user_id: string, protocol_id: string, scheduled_for: string,
 *                  expected_dose: number, tolerance_minutes: number}>}
 *          Ordenadas por scheduled_for; só dentro de [fromTs, toTs].
 */
export function generateInstances(protocol, fromTs, toTs, tz = 'America/Sao_Paulo') {
  if (!protocol || !protocol.id) return []

  const frequency = (protocol.frequency || 'diário').toLowerCase()
  if (PRN_FREQUENCIES.has(frequency)) return []

  const schedule = Array.isArray(protocol.time_schedule) ? protocol.time_schedule : []
  if (schedule.length === 0) return []

  const fromDate = toInstant(fromTs)
  const toDate = toInstant(toTs)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return []
  if (toDate < fromDate) return []

  const fromMs = fromDate.getTime()
  const toMs = toDate.getTime()
  const isDaily = DAILY_FREQUENCIES.has(frequency)
  const expectedDose = protocol.dosage_per_intake ?? 1

  // Slots do dia, ordenados, com tolerância pré-computada (estável dia a dia).
  const slots = schedule
    .map((t) => ({ time: t, minutes: timeToMinutes(t) }))
    .filter((s) => s.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes)
  if (slots.length === 0) return []

  const tolerances = computeTolerances(slots.map((s) => s.minutes), isDaily)

  const instances = []
  for (const dateStr of localDateRange(fromDate, toDate, tz)) {
    if (!isProtocolActiveOnDate(protocol, dateStr)) continue
    slots.forEach((slot, i) => {
      const scheduledForIso = buildScheduledFor(dateStr, slot.minutes, tz)
      const scheduledMs = parseISO(scheduledForIso).getTime()
      if (scheduledMs < fromMs || scheduledMs > toMs) return
      instances.push({
        user_id: protocol.user_id,
        protocol_id: protocol.id,
        scheduled_for: scheduledForIso,
        expected_dose: expectedDose,
        tolerance_minutes: tolerances[i],
      })
    })
  }

  instances.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
  return instances
}
