/**
 * §3.5b Escadas de titulação (DS-5). A escada é a COMPLETA, agrupada por `titration_id` — o recorte
 * por `protocol_id` perde etapas (AP-311). `protocols.titration_schedule` não é sinal (§6).
 *
 * Datas: etapa iniciada usa `started_at`/`ended_at` reais; etapa futura é PREVISTA, encadeada a
 * partir do fim previsto da anterior (`duration_days`). Cada degrau carrega o próprio medicamento
 * (R-299: escada cross-medicamento troca de cadastro no meio).
 */
import { formatMedicineConcentration } from '../../../utils/doseUnit'
import { formatStepDose, localDayOf, medicineOf, shiftDay, treatmentName } from '../reportFormat'
import type { ReportInputs, ReportMedicineRow, ReportProtocolRow, ReportTitrationStepRow } from '../reportTypes'

export type LadderStepState = 'completed' | 'current' | 'planned'

export interface LadderStep {
  position: number
  doseLabel: string
  /** Medicamento do degrau ("Mounjaro · 5 mg"); só quando a escada usa mais de um cadastro. */
  medicineLabel: string | null
  /** `null` = contínua (última etapa sem fim). */
  durationDays: number | null
  state: LadderStepState
  /** Dia local de início (real ou previsto). */
  start: string | null
  /** Dia local de fim (real ou previsto); `null` = sem fim. */
  end: string | null
  /** Datas previstas (etapa ainda não iniciada). */
  planned: boolean
}

export interface Ladder {
  titrationId: string
  protocolId: string
  medicineId: string | null
  name: string
  steps: LadderStep[]
  /** Índice (0-based) da etapa atual, ou `null`. */
  currentIndex: number | null
}

function _state(step: ReportTitrationStepRow): LadderStepState {
  if (step.status === 'completed') return 'completed'
  if (step.status === 'current') return 'current'
  return 'planned'
}

function _protocolOfLadder(steps: ReportTitrationStepRow[], protocols: ReportProtocolRow[]): ReportProtocolRow | null {
  // Executor vigente primeiro; senão o de qualquer etapa.
  const ordered = [...steps].sort((a, b) => (a.status === 'current' ? -1 : b.status === 'current' ? 1 : 0))
  for (const s of ordered) {
    const p = protocols.find((pr) => pr.id === s.protocol_id)
    if (p) return p
  }
  return null
}

function _medicineLabel(medicine: ReportMedicineRow | null): string | null {
  if (!medicine) return null
  // Mesmo rótulo de concentração da tabela de medicamentos ("5 mg / 0,5 mL").
  const strength = formatMedicineConcentration(medicine)
  return strength ? `${medicine.name} · ${strength}` : medicine.name
}

/**
 * Uma escada por titulação ligada a um tratamento do usuário. Escada de uma etapa só não é
 * titulação (é uma dose) e não entra (smoke 097 A2).
 */
export function buildLadders(inputs: ReportInputs): Ladder[] {
  const byTitration = new Map<string, ReportTitrationStepRow[]>()
  for (const step of inputs.titrationSteps) {
    const list = byTitration.get(step.titration_id) ?? []
    list.push(step)
    byTitration.set(step.titration_id, list)
  }

  const ladders: Ladder[] = []
  for (const [titrationId, raw] of byTitration) {
    if (raw.length < 2) continue
    const ordered = [...raw].sort((a, b) => a.position - b.position)
    const protocol = _protocolOfLadder(ordered, inputs.protocols)
    if (!protocol) continue
    const protoMedicine = medicineOf(protocol, inputs.medicines)
    // Troca de cadastro no meio da escada (ex.: caneta de outra concentração): cada degrau diz qual
    // medicamento usa (smoke 097 A2).
    const medicineIds = new Set(ordered.map((st) => st.medicine_id ?? protocol.medicine_id))
    const showMedicine = medicineIds.size > 1

    let prevEnd: string | null = null
    const steps: LadderStep[] = ordered.map((step, index) => {
      const stepMedicine = inputs.medicines.find((m) => m.id === step.medicine_id) ?? protoMedicine
      const dose = formatStepDose(step, protocol, stepMedicine) ?? '-'
      const duration = Number(step.duration_days)
      const durationDays = Number.isFinite(duration) && duration > 0 ? duration : null
      const startedDay = localDayOf(step.started_at, inputs.timezone)
      const start = startedDay ?? prevEnd
      const endedDay = localDayOf(step.ended_at, inputs.timezone)
      const end = endedDay ?? (start && durationDays ? shiftDay(start, durationDays) : null)
      prevEnd = end
      return {
        position: index + 1,
        doseLabel: dose,
        medicineLabel: showMedicine ? _medicineLabel(stepMedicine) : null,
        durationDays,
        state: _state(step),
        start,
        end,
        planned: startedDay === null,
      }
    })

    const currentIndex = steps.findIndex((s) => s.state === 'current')
    ladders.push({
      titrationId,
      protocolId: protocol.id,
      medicineId: protocol.medicine_id,
      name: treatmentName(protocol, protoMedicine),
      steps,
      currentIndex: currentIndex >= 0 ? currentIndex : null,
    })
  }
  return ladders.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
