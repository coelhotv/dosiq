// packages/core/src/utils/schedulePresets.ts
// Presets de horário (086 FR-001..FR-009): "1x", "12/12h", "8/8h", "6/6h" + "manual".
//
// POR QUE EXISTE: o preset NUNCA é persistido — o banco guarda só `time_schedule` (lista de HH:MM).
// O preset é DERIVADO do array na leitura, então dado antigo e dado editado à mão caem no mesmo
// caminho. Tolerância ZERO: `['08:00','20:01']` é 'manual', não '12h' — um preset "quase certo"
// mostraria à usuária um intervalo que o alarme não cumpre.
//
// Madrugada = [00:01, 06:00) — decisão do PO no smoke (2026-09-29), revendo o §11 da spec: meia-noite
// é hora de dormir, não madrugada, e a faixa vale para todo mundo (não para o padrão de uma usuária).
// A "primeira dose do dia" (âncora) segue a partir de `DAY_START` (05:00) — DESACOPLADA de propósito:
// com a mesma fronteira das 06:00, um 8/8 às 05:30 mostraria "primeira dose 13:30". O texto do aviso
// ("ajuste a primeira dose do dia") segue verdadeiro: primeira dose às 06:00 tira qualquer preset da faixa.
//
// PURO: sem I/O e sem relógio. Trabalha em minutos inteiros (1440 / n) — nada de float.

/** Quantidade de doses por dia de cada preset. */
export const SCHEDULE_PRESETS = { '1x': 1, '12h': 2, '8h': 3, '6h': 4 } as const

export type SchedulePresetKey = keyof typeof SCHEDULE_PRESETS
export type SchedulePresetValue = SchedulePresetKey | 'manual'

/** Âncora sugerida (primeira dose) quando a usuária escolhe o preset. */
export const DEFAULT_ANCHORS: Record<SchedulePresetKey, string> = {
  '1x': '08:00',
  '12h': '08:00',
  '8h': '08:00',
  '6h': '06:00',
}

/** Início do dia: fronteira da "primeira dose do dia" (âncora exibida). */
export const DAY_START = '05:00'

/** Faixa da madrugada, início inclusivo e fim exclusivo: [00:01, 06:00). */
export const EARLY_MORNING_START = '00:01'
export const EARLY_MORNING_END = '06:00'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const MINUTES_PER_DAY = 1440

const KEY_BY_COUNT: Record<number, SchedulePresetKey> = { 1: '1x', 2: '12h', 3: '8h', 4: '6h' }

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_REGEX.test(value)
}

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Horários válidos e ordenados (HH:MM zero-padded ordena lexicograficamente). */
function validSorted(schedule: unknown): string[] {
  if (!Array.isArray(schedule)) return []
  return schedule.filter(isValidTime).sort()
}

/**
 * Gera `n` horários espaçados de exatamente 24/n horas a partir da âncora, módulo 24h, ordenados.
 * Entrada inválida devolve `[]` (nunca lança).
 */
export function computePresetSchedule(n: number, anchor: string): string[] {
  if (!Number.isInteger(n) || n < 1 || n > 4 || !isValidTime(anchor)) return []
  const step = MINUTES_PER_DAY / n
  const start = toMinutes(anchor)
  const times: string[] = []
  for (let i = 0; i < n; i++) {
    times.push(toTime((start + i * step) % MINUTES_PER_DAY))
  }
  return times.sort()
}

/**
 * Deriva o preset a partir do array de horários. `null` = não se aplica (sem horários ou
 * `quando_necessário`); `'manual'` = qualquer coisa que não seja um preset exato.
 */
export function deriveSchedulePreset(
  schedule: unknown,
  frequency?: string | null
): SchedulePresetValue | null {
  if (frequency === 'quando_necessário') return null
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  if (!schedule.every(isValidTime)) return 'manual'
  if (new Set(schedule).size !== schedule.length) return 'manual'
  const n = schedule.length
  if (n > 4) return 'manual'
  if (n === 1) return '1x'

  const minutes = (schedule as string[]).map(toMinutes).sort((a, b) => a - b)
  const step = MINUTES_PER_DAY / n
  for (let i = 0; i < n; i++) {
    const next = i === n - 1 ? minutes[0] + MINUTES_PER_DAY : minutes[i + 1]
    if (next - minutes[i] !== step) return 'manual'
  }
  return KEY_BY_COUNT[n]
}

/** Âncora = primeira dose do dia (primeiro horário >= DAY_START); se não houver, o primeiro. */
export function deriveAnchor(schedule: unknown): string | null {
  const sorted = validSorted(schedule)
  if (sorted.length === 0) return null
  return sorted.find((t) => t >= DAY_START) ?? sorted[0]
}

/** Primeiro horário na madrugada [00:01, 06:00) — 00:00 e 06:00 NÃO contam. `null` se não houver. */
export function findEarlyMorningDose(schedule: unknown): string | null {
  return validSorted(schedule).find((t) => t >= EARLY_MORNING_START && t < EARLY_MORNING_END) ?? null
}
