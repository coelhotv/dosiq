/**
 * Helpers puros do relatório (spec 097): dia local de um instante, datas curtas e rótulos de dose
 * que o documento usa. Nenhum `new Date('YYYY-MM-DD')` (R-020): data local sai de `parseLocalDate`.
 */
import { addDays, formatLocalDate, getUserTime, parseISO, parseLocalDate } from '../../utils/dateUtils'
import { cycleDoseAmount, getDoseCycle } from '../../utils/doseCycle'
import {
  formatActiveIngredientShort,
  formatDose,
  formatIntakeDose,
  formatNumberPtBR,
  isLiquidMedicine,
} from '../../utils/doseUnit'
import { isInjectable } from '../../utils/injectionSites'
import type { ReportMedicineRow, ReportProtocolRow, ReportTitrationStepRow, ReportWindow } from './reportTypes'

/** Campos do cadastro que os rótulos de dose leem (o embed da escada no mobile traz só estes). */
type DoseMedicine = Pick<ReportMedicineRow, 'dosage_unit' | 'dosage_per_pill' | 'units_per_ml'>

/** Dia local (YYYY-MM-DD) de um instante ISO no fuso do dono. `null` se o instante for inválido. */
export function localDayOf(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null
  const date = parseISO(iso)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalDate(getUserTime(date, tz))
}

/** "dd/mm/aa" de uma data local YYYY-MM-DD (tabelas — DESIGN_DECISOES §3.3). */
export function formatShortDate(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** "dd/mm" de uma data local YYYY-MM-DD. */
export function formatDayMonth(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

/** Todos os dias locais da janela, em ordem. */
export function windowDays(window: ReportWindow): string[] {
  const out: string[] = []
  const start = parseLocalDate(window.from)
  for (let i = 0; i < window.days; i += 1) out.push(formatLocalDate(addDays(start, i)))
  return out
}

/** Dias corridos de `a` até `b` (datas locais); negativo se `b` vem antes. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000)
}

/** `day` somado de `n` dias (datas locais). */
export function shiftDay(day: string, n: number): string {
  return formatLocalDate(addDays(parseLocalDate(day), n))
}

/** Medicamento do tratamento, ou `null` se o cadastro não veio. */
export function medicineOf(protocol: ReportProtocolRow, medicines: ReportMedicineRow[]): ReportMedicineRow | null {
  return medicines.find((m) => m.id === protocol.medicine_id) ?? null
}

/** Dose por tomada na unidade da tomada (073/F-17; INV-3). */
export function formatDosePerIntake(
  protocol: Pick<ReportProtocolRow, 'dosage_per_intake' | 'intake_unit'>,
  medicine: DoseMedicine | null
): string {
  return formatIntakeDose(protocol.dosage_per_intake ?? 1, protocol.intake_unit, medicine)
}

/**
 * Dose TOTAL no ciclo da frequência (085): "100 mg/dia", "2,4 mg/semana", "1 mL a cada 90 dias".
 * Portado de `consultationPdfDataBuilder._formatCycleDose` (web, legado, apagado no A2) sem mudar o número —
 * a regressão da PO-1 comparou os dois no A1.
 */
export function formatCycleDoseLabel(protocol: ReportProtocolRow, medicine: ReportMedicineRow | null): string {
  // 073/RC5: para PRN a "dose total" seria ficção.
  if (protocol.frequency === 'quando_necessário') return 'sob demanda'
  const cycle = getDoseCycle(protocol)
  const amount = cycleDoseAmount(protocol, Number(protocol.dosage_per_intake ?? 1))
  if (!cycle || amount === null) return '-'
  // O formatador do core não arredonda (R-277).
  const rounded = Math.round(amount * 1000) / 1000

  if (isLiquidMedicine(medicine)) {
    const label = formatDose(rounded, protocol.intake_unit || 'ml')
    return label ? `${label}${cycle.suffix}` : '-'
  }

  const mass = formatActiveIngredientShort(rounded, medicine?.dosage_per_pill, medicine?.dosage_unit)
  if (mass) return `${mass}${cycle.suffix}`
  return `${formatNumberPtBR(rounded)} un.${cycle.suffix}`
}

/**
 * Dose de um degrau da escada. A unidade é do degrau; sem ela, do tratamento. `'cp'` (só existe em
 * `titration_steps`, CON-032 §5) vira texto por extenso e nunca é propagado. Portado do legado.
 */
export function formatStepDose(
  step: Pick<ReportTitrationStepRow, 'dose' | 'intake_unit'>,
  protocol: Pick<ReportProtocolRow, 'intake_unit'> | null,
  medicine: DoseMedicine | null
): string | null {
  if (step.dose == null) return null
  const qty = Number(step.dose)
  if (step.intake_unit === 'cp') {
    const label = `${formatNumberPtBR(qty)} ${qty === 1 ? 'comprimido' : 'comprimidos'}`
    const mass = formatActiveIngredientShort(qty, medicine?.dosage_per_pill, medicine?.dosage_unit)
    return mass ? `${label} (${mass})` : label
  }
  const unit = step.intake_unit ?? protocol?.intake_unit ?? null
  return formatIntakeDose(qty, unit, medicine) || null
}

/** Primeiro horário do tratamento (ordem da §3.3), ou '99:99' sem horário. */
export function firstSlot(protocol: ReportProtocolRow): string {
  const slots = (protocol.time_schedule ?? []).filter((t) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t))
  return slots.length ? [...slots].sort()[0] : '99:99'
}

/** Ordem do documento: injetáveis primeiro, depois primeiro horário, depois nome (§3.3). */
export function compareTreatments(
  a: { injectable: boolean; firstSlot: string; name: string },
  b: { injectable: boolean; firstSlot: string; name: string }
): number {
  if (a.injectable !== b.injectable) return a.injectable ? -1 : 1
  if (a.firstSlot !== b.firstSlot) return a.firstSlot < b.firstSlot ? -1 : 1
  return a.name.localeCompare(b.name, 'pt-BR')
}

/** Nome exibido do tratamento: nome comercial do medicamento, senão o do tratamento. */
export function treatmentName(protocol: ReportProtocolRow, medicine: ReportMedicineRow | null): string {
  return medicine?.name?.trim() || protocol.name?.trim() || 'Tratamento sem nome'
}

export { isInjectable }
