/**
 * §3.8b Estoque (DS-4) — só com rastreio ligado (044, FR-007/FR-020). Seção do PRESENTE: consumo
 * pelo ritmo dos tratamentos vigentes no último dia do período (064, R-299). Sem custo: nenhum
 * campo de preço existe na entrada nem aqui.
 *
 * Diferença deliberada do legado: o legado usava o "dura até" pré-calculado do dashboard quando o
 * período terminava hoje; aqui sempre se recalcula em `asOf` (uma fonte só, web e mobile iguais).
 */
import { calculateDailyIntake } from '../../../utils/adherenceLogic'
import { formatNumberPtBR, roundForDisplay, stockUnitLabel } from '../../../utils/doseUnit'
import { shiftDay } from '../reportFormat'
import type { ReportInputs } from '../reportTypes'
import { isCurrentOn } from './medications'

/** "Acaba antes de N dias" sobe para "Para esta consulta" (§3.2) e fica em negrito (§3.8b). */
export const STOCK_SOON_DAYS = 14

export interface StockRow {
  medicineId: string
  name: string
  quantity: number
  quantityLabel: string
  dailyIntake: number
  dailyIntakeLabel: string
  /** Dias inteiros de estoque no ritmo atual; `null` sem consumo. */
  daysRemaining: number | null
  /** Dia local em que acaba; `null` sem consumo. */
  runsOutOn: string | null
  soon: boolean
}

function _amount(qty: number, medicine: Parameters<typeof stockUnitLabel>[0]): string {
  const rounded = roundForDisplay(qty)
  if (rounded === null) return '-'
  return `${formatNumberPtBR(rounded)} ${stockUnitLabel(medicine)}`
}

/** `null` quando o rastreio está desligado: a seção não existe (≠ lista vazia). */
export function buildStockRows(inputs: ReportInputs): StockRow[] | null {
  if (!inputs.stockTrackingEnabled) return null
  const asOf = inputs.window.to
  const current = inputs.protocols.filter((p) => isCurrentOn(p, asOf))
  // Só quem tem saldo registrado (como o legado): remédio vigente sem nenhum lote nunca teve
  // estoque cadastrado — listá-lo com "acaba hoje" seria afirmar um fato que o app não tem.
  const rows: StockRow[] = []
  for (const { medicine_id: id, total_quantity: quantity } of inputs.stockTotals) {
    const medicine = inputs.medicines.find((m) => m.id === id)
    if (!medicine || medicine.archived_at != null) continue
    const dailyIntake = calculateDailyIntake(id, current, medicine, asOf)
    const daysRemaining = dailyIntake > 0 ? Math.max(0, Math.floor(quantity / dailyIntake)) : null
    rows.push({
      medicineId: id,
      name: medicine.name,
      quantity,
      quantityLabel: _amount(quantity, medicine),
      dailyIntake,
      dailyIntakeLabel: _amount(dailyIntake, medicine),
      daysRemaining,
      runsOutOn: daysRemaining === null ? null : shiftDay(asOf, daysRemaining),
      soon: daysRemaining !== null && daysRemaining < STOCK_SOON_DAYS,
    })
  }
  return rows.sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity) || a.name.localeCompare(b.name, 'pt-BR'))
}
