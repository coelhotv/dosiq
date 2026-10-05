// formatMeasureSeriesA11y.ts — texto do card "Peso durante o tratamento" (spec 069 Bb · FR-015 · R-12).
//
// O core devolve números; a copy nasce aqui, no mobile. Descritivo (ADR-062): sem adjetivo, sem
// verbo de direção, sem diferença calculada — o mesmo texto para qualquer direção da série (INV-5).

import type { TreatmentMeasureSeries } from '@dosiq/core'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** `YYYY-MM-DD` (dia local) → "24 jul". Sem `Date`: o dia já é local (AP-270). */
export function formatShortDay(day: string | null | undefined): string {
  if (!day) return ''
  const [, m, d] = day.split('-').map(Number)
  if (!m || !d) return ''
  return `${d} ${MONTHS[m - 1]}`
}

/** Peso com 1 casa e vírgula: 89 → "89,0". */
export function formatKg(kg: number): string {
  return (Math.round(kg * 10) / 10).toFixed(1).replace('.', ',')
}

export const pluralWeighings = (n: number) => `${n} ${n === 1 ? 'pesagem' : 'pesagens'}`

/** accessibilityLabel do gráfico (FR-015): resumo completo, inclusive as etapas recolhidas. */
export function formatMeasureSeriesA11y(series: TreatmentMeasureSeries): string {
  const { points, steps, firstDay, lastDay } = series
  const parts = ['Gráfico de peso durante o tratamento.']
  if (points.length > 0) {
    parts.push(`${pluralWeighings(points.length)} entre ${formatShortDay(firstDay)} e ${formatShortDay(lastDay)}.`)
    parts.push(`Primeira pesagem: ${formatKg(points[0].kg)} quilos.`)
    parts.push(`Última pesagem: ${formatKg(points[points.length - 1].kg)} quilos.`)
  }
  for (const s of steps) {
    const weight =
      s.meanKg === null ? 'sem pesagens' : `peso médio ${formatKg(s.meanKg)} quilos em ${pluralWeighings(s.count)}`
    parts.push(`Etapa ${s.index}, ${s.dose}: ${weight}, ${s.taken} de ${s.expected} doses registradas.`)
  }
  return parts.join(' ')
}
