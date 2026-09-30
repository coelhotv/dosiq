// nextDoseSummary — "Próxima dose: sex, 10 out às 16:00 · Mesigyna" (spec 086 RC2 D-13).
//
// Estado "Nenhuma dose hoje" da aba Hoje: há tratamento ativo (em curso ou AGENDADO), mas nenhuma
// dose hoje. A data vem de `getNextOccurrence` — a mesma recorrência do gerador de lembretes
// (INV-3): a tela nunca promete uma dose que o lembrete não vai tocar.
import { getNextOccurrence, formatWeekdayDayMonthPtBR, formatLocalDate, parseLocalDate } from '@dosiq/core'

function whenLabel(date: string, now: Date): string {
  const today = formatLocalDate(now)
  if (date === today) return 'hoje'
  const tomorrow = parseLocalDate(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date === formatLocalDate(tomorrow)) return 'amanhã'
  return formatWeekdayDayMonthPtBR(date)
}

/**
 * Próxima dose entre os tratamentos dados (a mais cedo). `null` se nenhum tiver dose futura
 * (PRN, sem horário, término antes da próxima).
 */
export function summarizeNextDose(protocols: any[] | null | undefined, now: Date): string | null {
  let best: { date: string; time: string; name: string } | null = null
  for (const p of protocols ?? []) {
    const occ = getNextOccurrence(p, now)
    if (!occ) continue
    const key = `${occ.date} ${occ.time}`
    if (!best || key < `${best.date} ${best.time}`) {
      best = { ...occ, name: p?.medicine?.name || p?.name || '' }
    }
  }
  if (!best) return null
  const suffix = best.name ? ` · ${best.name}` : ''
  return `Próxima dose: ${whenLabel(best.date, now)} às ${best.time}${suffix}`
}
