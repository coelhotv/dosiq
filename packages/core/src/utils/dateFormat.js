// dateFormat.js — Apresentação de datas PT-BR (Fase 2).
//
// Helpers de display puros. Hermes (mobile) sem ICU completo: NÃO usar
// toLocaleString('pt-BR'). Formatação manual via tabela de meses.

import { parseLocalDate } from './dateUtils.js'

const MONTHS_PT_BR = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/**
 * Formata uma data ISO/string YYYY-MM-DD para "DD MMM YYYY" PT-BR lowercase.
 *
 * @example formatDatePtBR('2026-03-12') → '12 mar 2026'
 * @example formatDatePtBR(null)         → ''
 */
export function formatDatePtBR(isoDate) {
  if (!isoDate) return ''
  const d = typeof isoDate === 'string' ? parseLocalDate(isoDate) : isoDate
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS_PT_BR[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Formata data de término de tratamento. null/undefined → "Uso contínuo".
 *
 * @example formatEndDate(null)         → 'Uso contínuo'
 * @example formatEndDate('2026-12-31') → '31 dez 2026'
 */
export function formatEndDate(isoDate) {
  if (!isoDate) return 'Uso contínuo'
  return formatDatePtBR(isoDate)
}
