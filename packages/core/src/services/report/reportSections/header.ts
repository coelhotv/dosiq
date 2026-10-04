/**
 * §3.1 Cabeçalho e linha de fatos; §3.2 Para esta consulta.
 *
 * §3.2 só traz fatos administrativos com data (receita, estoque, próxima etapa), no máximo 5,
 * sem "atenção/risco/recomenda-se" (SaMD, INV-5). Rastreio de estoque desligado ⇒ sem item de
 * estoque (044).
 */
import { calculateAge } from '../../../utils/profile'
import { localDayOf } from '../reportFormat'
import type { ReportInputs, ReportWindow } from '../reportTypes'
import type { IntakesSection } from './intakes'
import type { Ladder } from './ladders'
import type { MedicationRow } from './medications'
import type { StockRow } from './stock'

export const FOR_THIS_VISIT_MAX = 5

export interface ReportHeader {
  patientName: string | null
  age: number | null
  /** Período pedido (cabeçalho, rodapé, nome do arquivo). */
  window: ReportWindow
  /**
   * Trecho com registro: do primeiro dia com dose prevista ou medida até o fim do período. Igual a
   * `window` quando há registro desde o início. Faixas e contagens usam este (smoke 097 A2).
   */
  dataWindow: ReportWindow
  allergies: string[]
  bloodType: string | null
  daysWithDose: { count: number; of: number }
  daysWithMeasure: { count: number; of: number }
}

export type VisitItemKind = 'receita' | 'estoque' | 'titulacao'

export interface VisitItem {
  kind: VisitItemKind
  name: string
  /** Data concreta do fato (vencimento, fim do estoque, início previsto da etapa). */
  day: string
  /** Receita: 'vencida' | 'vencendo'. */
  status: string | null
  /** Titulação: dose da próxima etapa. */
  doseLabel: string | null
}

export function buildHeader(inputs: ReportInputs, intakes: IntakesSection): ReportHeader {
  const { window } = inputs
  const doseDays = new Set<string>()
  for (const row of [...intakes.active, ...intakes.ended]) {
    for (const d of row.days) if (d.state === 'full' || d.state === 'partial') doseDays.add(d.day)
  }
  const measureDays = new Set<string>()
  for (const b of inputs.biomarkers) {
    const day = localDayOf(b.measured_at, inputs.timezone)
    if (day && day >= window.from && day <= window.to) measureDays.add(day)
  }
  return {
    patientName: inputs.profile.displayName,
    age: calculateAge(inputs.profile.birthDate),
    window,
    dataWindow: window,
    allergies: inputs.profile.allergies,
    bloodType: inputs.profile.bloodType,
    daysWithDose: { count: doseDays.size, of: window.days },
    daysWithMeasure: { count: measureDays.size, of: window.days },
  }
}

export function buildForThisVisit(
  medications: MedicationRow[],
  stock: StockRow[] | null,
  ladders: Ladder[],
  asOf: string
): VisitItem[] {
  const items: VisitItem[] = []
  for (const m of medications) {
    if (m.endStatus && m.endDate) {
      items.push({ kind: 'receita', name: m.name, day: m.endDate, status: m.endStatus, doseLabel: null })
    }
  }
  for (const s of stock ?? []) {
    if (s.soon && s.runsOutOn) items.push({ kind: 'estoque', name: s.name, day: s.runsOutOn, status: null, doseLabel: null })
  }
  const currentIds = new Set(medications.map((m) => m.protocolId))
  for (const ladder of ladders) {
    if (ladder.currentIndex === null || !currentIds.has(ladder.protocolId)) continue
    const next = ladder.steps[ladder.currentIndex + 1]
    if (next?.start && next.start >= asOf) {
      items.push({ kind: 'titulacao', name: ladder.name, day: next.start, status: null, doseLabel: next.doseLabel })
    }
  }
  return items.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).slice(0, FOR_THIS_VISIT_MAX)
}
