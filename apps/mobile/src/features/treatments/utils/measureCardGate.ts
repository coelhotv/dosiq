// measureCardGate — quando o card de glicemia/PA do detalhe desenha o gráfico (spec 100 B · FR-009).
//
// Puro. Conta DIAS LOCAIS distintos com medida nos últimos 7 dias (hoje + 6), independente de quantos
// pontos por dia (PO 2026-10-30: glicemia ≥3 dias, PA ≥2 — o pedido de PA tem teto 3/semana, e 3/7
// deixaria o gráfico refém de um único "Agora não"). Abaixo do mínimo: estado vazio, nunca card sumido.

import { addDays, formatLocalDate, parseISO } from '@dosiq/core'

export type CardMeasure = 'glicemia' | 'pressao_arterial'

export const MEASURE_CARD_WINDOW_DAYS = 7
export const MEASURE_CARD_MIN_DAYS: Record<CardMeasure, number> = { glicemia: 3, pressao_arterial: 2 }

export function distinctRecentDays(items: Array<{ measured_at?: string | null }>, now: Date): number {
  const windowStart = formatLocalDate(addDays(now, -(MEASURE_CARD_WINDOW_DAYS - 1)))
  const today = formatLocalDate(now)
  const days = new Set<string>()
  for (const item of items ?? []) {
    if (!item?.measured_at) continue
    const day = formatLocalDate(parseISO(item.measured_at))
    if (day >= windowStart && day <= today) days.add(day)
  }
  return days.size
}

/** Dias que faltam para o gráfico (0 = desenha). */
export function missingDaysForChart(measure: CardMeasure, items: Array<{ measured_at?: string | null }>, now: Date): number {
  return Math.max(0, MEASURE_CARD_MIN_DAYS[measure] - distinctRecentDays(items, now))
}
