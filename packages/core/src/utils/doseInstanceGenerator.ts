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
} from './dateUtils'
import { isProtocolActiveOnDate } from './adherenceLogic'

// 029 F3.1 (T017c): não estende mais `TitrationProtocol` (o jsonb N1, deletado com o AP-301).
// A escada chega pelo parâmetro `titrationSteps`, não pelo protocol.
interface GeneratorProtocol {
  id?: string
  user_id?: string
  frequency?: string | null
  time_schedule?: string[] | null
  dosage_per_intake?: number | null
  critical_alarm?: boolean | null
  start_date?: string | null
  end_date?: string | null
  active?: boolean
  weekdays?: string[] | null
  days?: string[] | null
}

type GeneratedInstance = {
  user_id?: string
  protocol_id?: string
  scheduled_for: string
  expected_dose: number
  tolerance_minutes: number
  critical_alarm: boolean
}
import { resolveTitrationStageAt, TitrationStepLike } from './titrationUtils'

/**
 * Converte Date | ISO string | timestamp(ms) num Date absoluto.
 * Usa helpers de dateUtils (R-020: nunca `new Date()` direto fora de dateUtils).
 * @param {Date|string|number} value
 * @returns {Date}
 */
function toInstant(value: Date | string | number): Date {
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
 * Período (minutos) entre ocorrências por frequência — base da tolerância
 * não-diária (ADR-061/FR-007): a janela de perdão clínica de uma dose semanal
 * é dias, não horas. Frequências fora do mapa (personalizado etc.) mantêm 120.
 */
const FREQUENCY_PERIOD_MINUTES: Record<string, number> = {
  semanal: 10080,
  semanalmente: 10080,
  weekly: 10080,
  dias_alternados: 2880,
  dia_sim_dia_nao: 2880,
  every_other_day: 2880,
  alternating: 2880,
}

/**
 * Converte "HH:MM" em minutos desde a meia-noite. Retorna null se inválido.
 * @param {string} time
 * @returns {number|null}
 */
function timeToMinutes(time: string): number | null {
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
 * - Não-diário com período conhecido (semanal/dias_alternados — ADR-061/FR-007):
 *   mesma regra "metade do menor intervalo adjacente", mas o wrap-around usa o
 *   PERÍODO da frequência (semanal=10080, alternados=2880) e **sem teto de 120**
 *   — o perdão clínico de GLP-1 semanal é de dias (slot único → floor(10080/2)=5040,
 *   3,5 dias). Diário mantém cap 120 (semântica de adesão do público 1×/dia).
 * - Frequência sem período mapeado (personalizado etc.): 120 fixo (§6 MASTER_PLAN).
 *
 * @param {number[]} sortedMinutes - minutos dos slots, ordenados ascendente
 * @param {string} frequency - frequência normalizada (lowercase) do protocolo
 * @returns {number[]} tolerância por slot (mesma ordem de sortedMinutes)
 */
function computeTolerances(sortedMinutes: number[], frequency: string): number[] {
  const isDaily = DAILY_FREQUENCIES.has(frequency)
  const periodMinutes = isDaily ? 1440 : FREQUENCY_PERIOD_MINUTES[frequency]
  // Sem período conhecido (personalizado etc.): comportamento legado, 120 fixo.
  if (!periodMinutes) return sortedMinutes.map(() => MAX_TOLERANCE_MINUTES)
  // Diário de dose única: legado (120) — só multi-dose tem gap intra-dia.
  if (isDaily && sortedMinutes.length < 2) {
    return sortedMinutes.map(() => MAX_TOLERANCE_MINUTES)
  }
  const len = sortedMinutes.length
  return sortedMinutes.map((minute: number, i: number) => {
    // Para o 1º/último slot, o intervalo adjacente cruza o período (wrap-around):
    // diário = meia-noite; semanal/alternados = próxima ocorrência do ciclo.
    const prevGap = i > 0
      ? minute - sortedMinutes[i - 1]
      : (periodMinutes - sortedMinutes[len - 1]) + minute
    const nextGap = i < len - 1
      ? sortedMinutes[i + 1] - minute
      : (periodMinutes - minute) + sortedMinutes[0]
    const smallestAdjacent = Math.min(prevGap, nextGap)
    const half = Math.floor(smallestAdjacent / 2)
    // Teto de 120 SÓ no diário (ADR-061: não-diário sem cap).
    return isDaily ? Math.min(half, MAX_TOLERANCE_MINUTES) : half
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
function buildScheduledFor(dateStr: string, minutesOfDay: number, tz: string): string {
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
function localDateRange(fromDate: Date, toDate: Date, tz: string): string[] {
  const dates: string[] = []
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
 * @param {Array} [titrationSteps] - etapas da escada N2 **deste protocolo** (spec 029 F3/T014).
 *   Injetadas pelo chamador (a pureza da função é o motivo): quem faz I/O é o repository/cron.
 *   ⚠️ DEVEM vir filtradas por `protocol_id = protocol.id`. A escada inteira quebraria o caso
 *   cross-medicamento: o walk-forward adotaria a dose de OUTRO medicamento para as instâncias
 *   deste executor. Filtradas, o walk para na etapa do protocolo — que é exatamente o
 *   comportamento desejado enquanto um medicine_switch aguarda confirmação.
 * @returns {Array<{user_id: string, protocol_id: string, scheduled_for: string,
 *                  expected_dose: number, tolerance_minutes: number}>}
 *          Ordenadas por scheduled_for; só dentro de [fromTs, toTs].
 */
export function generateInstances(
  protocol: GeneratorProtocol | null | undefined,
  fromTs: Date | string | number,
  toTs: Date | string | number,
  tz = 'America/Sao_Paulo',
  titrationSteps?: TitrationStepLike[] | null
): GeneratedInstance[] {
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
  const expectedDose = protocol.dosage_per_intake ?? 1

  // Slots do dia, ordenados, com tolerância pré-computada (estável dia a dia).
  const slots = schedule
    .map((t: string) => ({ time: t, minutes: timeToMinutes(t) }))
    .filter((s): s is { time: string; minutes: number } => s.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes)
  if (slots.length === 0) return []

  const tolerances = computeTolerances(slots.map((s) => s.minutes), frequency)

  const instances: GeneratedInstance[] = []
  for (const dateStr of localDateRange(fromDate, toDate, tz)) {
    if (!isProtocolActiveOnDate(protocol, dateStr)) continue
    slots.forEach((slot, i) => {
      const scheduledForIso = buildScheduledFor(dateStr, slot.minutes, tz)
      const scheduledMs = parseISO(scheduledForIso).getTime()
      if (scheduledMs < fromMs || scheduledMs > toMs) return
      // 012 Fase B (FR-006/FP-1): titulação ativa congela a dose da ETAPA vigente
      // na data da ocorrência — instância futura nasce com a dose da etapa futura.
      // 029 F3.1 (T017b): as etapas são a fonte ÚNICA e chegam INJETADAS, já filtradas por
      // `protocol_id` (embed via FK — CON-032 §invariante 1). Sem elas, a dose cai para
      // `dosage_per_intake`: quem chama sem passar `titrationSteps` de um protocolo COM escada
      // degrada a dose em silêncio. Por isso o embed vive nos selects, não num if.
      const titrationStage = resolveTitrationStageAt(titrationSteps, scheduledMs)
      instances.push({
        user_id: protocol.user_id,
        protocol_id: protocol.id,
        scheduled_for: scheduledForIso,
        expected_dose: titrationStage ? titrationStage.dosage : expectedDose,
        tolerance_minutes: tolerances[i],
        critical_alarm: protocol.critical_alarm ?? false,
      })
    })
  }

  instances.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
  return instances
}
