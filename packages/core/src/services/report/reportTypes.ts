/**
 * Tipos do relatório clínico (spec 097). Linhas cruas que o coletor traz do banco e o modelo que o
 * montador devolve. Nenhum campo de preço/custo existe aqui (DS-4): o que não está no tipo não
 * chega ao template.
 *
 * Colunas verificadas no banco em 2026-10-03 (R-295) — `analysis-A1.md` §1.
 */

/** Períodos fixos do relatório (RC2-D4). */
export const REPORT_PERIOD_DAYS = [7, 30, 90, 180] as const
export type ReportPeriodDays = (typeof REPORT_PERIOD_DAYS)[number]
export const DEFAULT_REPORT_PERIOD_DAYS: ReportPeriodDays = 30

/** Janela do relatório em dias locais, inclusiva (`from` = to − days + 1). */
export interface ReportWindow {
  from: string
  to: string
  days: number
}

export interface ReportProtocolRow {
  id: string
  medicine_id: string
  name: string | null
  frequency: string | null
  time_schedule: string[] | null
  dosage_per_intake: number | null
  intake_unit: string | null
  interval_days: number | null
  weekdays: string[] | null
  start_date: string | null
  end_date: string | null
  active: boolean | null
  paused_at: string | null
  archived_at: string | null
}

export interface ReportMedicineRow {
  id: string
  name: string
  active_ingredient: string | null
  dosage_per_pill: number | null
  dosage_unit: string | null
  units_per_ml: number | null
  concentration_volume_ml: number | null
  presentation: string | null
  type: string | null
  archived_at: string | null
}

/** Linha da RPC `report_dose_days` (contagens; sem percentual — ADR-054 fica no core). */
export interface ReportDoseDayRow {
  protocol_id: string
  medicine_id: string
  day: string
  slot: string
  taken_count: number
  missed_count: number
  paused_count: number
  skipped_count: number
  pending_count: number
}

export interface ReportTitrationStepRow {
  id: string
  titration_id: string
  position: number
  medicine_id: string | null
  protocol_id: string | null
  dose: number | null
  intake_unit: string | null
  duration_days: number | null
  status: string | null
  started_at: string | null
  ended_at: string | null
}

export interface ReportStockTotalRow {
  medicine_id: string
  total_quantity: number
}

export interface ReportBiomarkerRow {
  id: string
  type: string
  value: number
  value_secondary: number | null
  unit: string | null
  measured_at: string
  context: string | null
}

export interface ReportMedicineLogRow {
  id: string
  protocol_id: string | null
  medicine_id: string
  taken_at: string
  injection_site: string | null
}

export interface ReportProfile {
  displayName: string | null
  birthDate: string | null
  allergies: string[]
  bloodType: string | null
}

/** Tudo que o montador precisa — produzido pelo coletor, puro dali em diante. */
export interface ReportInputs {
  window: ReportWindow
  timezone: string
  profile: ReportProfile
  stockTrackingEnabled: boolean
  protocols: ReportProtocolRow[]
  medicines: ReportMedicineRow[]
  doseDays: ReportDoseDayRow[]
  titrationSteps: ReportTitrationStepRow[]
  stockTotals: ReportStockTotalRow[]
  biomarkers: ReportBiomarkerRow[]
  medicineLogs: ReportMedicineLogRow[]
}
