// dateFormat.js — Apresentação de datas PT-BR (Fase 2).
//
// Helpers de display puros. Hermes (mobile) sem ICU completo: NÃO usar
// toLocaleString('pt-BR'). Formatação manual via tabela de meses.

import { parseLocalDate, parseISO } from './dateUtils'

const MONTHS_PT_BR = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

// Dias da semana curtos, índice = Date#getDay() (0 = domingo). Fonte única (086 E-8): antes viviam
// privados no adherenceLogic.
export const WEEKDAYS_SHORT_PT_BR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Aceita Date | timestamp ISO completo (com hora). Hermes sem ICU → NÃO usar
// toLocale*; parse manual via parseISO (timestamp) e tabela de meses.
function toLocalDate(input: Date | string): Date | null {
  if (input instanceof Date) return input
  if (typeof input === 'string') return parseISO(input)
  return null
}

/**
 * Formata um timestamp (Date|ISO com hora) para "HH:MM" 24h.
 * @example formatTimePtBR('2026-03-12T08:05:00Z') → '08:05'
 */
export function formatTimePtBR(input: Date | string): string {
  const d = toLocalDate(input)
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Formata um timestamp (Date|ISO com hora) para "DD mmm · HH:MM" PT-BR lowercase.
 * @example formatDateTimePtBR('2026-03-12T08:05:00Z') → '12 mar · 08:05'
 */
export function formatDateTimePtBR(input: Date | string): string {
  const d = toLocalDate(input)
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS_PT_BR[d.getMonth()]
  return `${day} ${month} · ${formatTimePtBR(d)}`
}

/**
 * Formata um timestamp (Date|ISO com hora) para "DD/mmm · HH:MM" PT-BR lowercase.
 * Usado nos cards de histórico de medida (032) — data curta + hora p/ transparência
 * com múltiplas entradas por dia ao longo da semana.
 * @example formatDateTimeShortPtBR('2026-03-12T08:05:00Z') → '12/mar · 08:05'
 */
export function formatDateTimeShortPtBR(input: Date | string): string {
  const d = toLocalDate(input)
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS_PT_BR[d.getMonth()]
  return `${day}/${month} · ${formatTimePtBR(d)}`
}

/**
 * Formata uma data ISO/string YYYY-MM-DD para "DD MMM YYYY" PT-BR lowercase.
 *
 * @example formatDatePtBR('2026-03-12') → '12 mar 2026'
 * @example formatDatePtBR(null)         → ''
 */
export function formatDatePtBR(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return ''
  const d = typeof isoDate === 'string' ? parseLocalDate(isoDate) : isoDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS_PT_BR[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Formata uma data ISO/string YYYY-MM-DD para "DD/MM/AA" numérico PT-BR.
 * Variante compacta data-driven (só números) para cards densos em dados.
 *
 * @example formatDateShortPtBR('2026-03-12') → '12/03/26'
 * @example formatDateShortPtBR(null)         → ''
 */
export function formatDateShortPtBR(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return ''
  const d = typeof isoDate === 'string' ? parseLocalDate(isoDate) : isoDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

/**
 * Formata uma data YYYY-MM-DD (ou Date) para "ddd, DD mmm" PT-BR lowercase — prévia das próximas
 * doses (086 FR-018): o dia da semana importa porque posto de saúde não abre no fim de semana.
 *
 * @example formatWeekdayDayMonthPtBR('2026-10-28') → 'qua, 28 out'
 * @example formatWeekdayDayMonthPtBR(null)         → ''
 */
export function formatWeekdayDayMonthPtBR(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return ''
  const d = typeof isoDate === 'string' ? parseLocalDate(isoDate) : isoDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${WEEKDAYS_SHORT_PT_BR[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT_BR[d.getMonth()]}`
}

/**
 * Formata uma data YYYY-MM-DD (ou Date) para "DD mmm" PT-BR lowercase — badge "Começa em 10 out" (086).
 *
 * @example formatDayMonthPtBR('2026-10-10') → '10 out'
 */
export function formatDayMonthPtBR(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return ''
  const d = typeof isoDate === 'string' ? parseLocalDate(isoDate) : isoDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT_BR[d.getMonth()]}`
}

/**
 * Formata data de término de tratamento. null/undefined → "Uso contínuo".
 *
 * @example formatEndDate(null)         → 'Uso contínuo'
 * @example formatEndDate('2026-12-31') → '31 dez 2026'
 */
export function formatEndDate(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return 'Uso contínuo'
  return formatDatePtBR(isoDate)
}
