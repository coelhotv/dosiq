/**
 * §3.3 Medicamentos em uso — seção do PRESENTE: vigência avaliada no último dia do período (asOf),
 * arquivado fora (CON-039, INV-1). Mesmo predicado do legado (`isProtocolVigentOn`, 073/F-18), para
 * a lista não mudar (PO-1). Dose na unidade da tomada (INV-3), dose total no ciclo (085), término
 * por tratamento (DS-6), forma injetável e validade após aberto como informação (FR-006).
 */
import { formatFrequencyLabel, FREQUENCY_LABELS } from '../../../schemas/protocolSchema'
import { isProtocolVigentOn } from '../../../utils/adherenceLogic'
import { formatMedicineConcentration } from '../../../utils/doseUnit'
import { derivePrescriptionStatus, PRESCRIPTION_STATUS } from '../../../utils/prescriptionStatus'
import { parseLocalDate } from '../../../utils/dateUtils'
import {
  compareTreatments,
  firstSlot,
  formatCycleDoseLabel,
  formatDosePerIntake,
  isInjectable,
  medicineOf,
  treatmentName,
} from '../reportFormat'
import type { ReportInputs, ReportProtocolRow } from '../reportTypes'
import type { Ladder } from './ladders'

export type EndStatus = 'vencida' | 'vencendo' | null

export interface MedicationRow {
  protocolId: string
  medicineId: string
  name: string
  /** Princípio ativo e apresentação (linha secundária). */
  detail: string
  dosePerIntake: string
  frequencyLabel: string
  times: string[]
  cycleDose: string
  startDate: string | null
  /** `null` = contínuo. */
  endDate: string | null
  endStatus: EndStatus
  injectable: boolean
  /** Validade após aberto (dias), só como informação (FR-006). */
  shelfLifeDays: number | null
  /** "Titulação 2/4" — da escada registrada, nunca de `titration_schedule`. */
  titrationChip: string | null
}

/** Vigente e não arquivado no dia `asOf` (seção do presente). */
export function isCurrentOn(protocol: ReportProtocolRow, asOf: string): boolean {
  return protocol.archived_at == null && isProtocolVigentOn(protocol, asOf)
}

function _frequencyLabel(protocol: ReportProtocolRow): string {
  if (!protocol.frequency) return FREQUENCY_LABELS['diário']
  return formatFrequencyLabel(protocol.frequency, protocol.interval_days)
}

export function buildMedicationRows(inputs: ReportInputs, ladders: Ladder[]): MedicationRow[] {
  const asOf = inputs.window.to
  const asOfDate = parseLocalDate(asOf)
  return inputs.protocols
    .filter((p) => isCurrentOn(p, asOf))
    .map((protocol) => {
      const medicine = medicineOf(protocol, inputs.medicines)
      const ingredient = medicine?.active_ingredient?.trim()
      const concentration = formatMedicineConcentration(medicine)
      const status = derivePrescriptionStatus(protocol, asOfDate)
      const endStatus: EndStatus =
        status === PRESCRIPTION_STATUS.VENCIDA ? 'vencida' : status === PRESCRIPTION_STATUS.VENCENDO ? 'vencendo' : null
      const ladder = ladders.find((l) => l.protocolId === protocol.id && l.currentIndex !== null)
      const times = (protocol.time_schedule ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t)).sort()
      return {
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
        name: treatmentName(protocol, medicine),
        detail: [ingredient, concentration].filter(Boolean).join(' · '),
        dosePerIntake: formatDosePerIntake(protocol, medicine),
        frequencyLabel: protocol.frequency === 'quando_necessário' ? FREQUENCY_LABELS['quando_necessário'] : _frequencyLabel(protocol),
        times,
        cycleDose: formatCycleDoseLabel(protocol, medicine),
        startDate: protocol.start_date,
        endDate: protocol.end_date,
        endStatus,
        injectable: isInjectable(medicine),
        shelfLifeDays: medicine?.shelf_life_days ?? null,
        titrationChip: ladder ? `Titulação ${(ladder.currentIndex ?? 0) + 1}/${ladder.steps.length}` : null,
        firstSlot: firstSlot(protocol),
      }
    })
    .sort(compareTreatments)
    .map((row) => {
      const { firstSlot, ...rest } = row
      void firstSlot
      return rest
    })
}
