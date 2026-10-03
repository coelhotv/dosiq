/**
 * Relatório clínico (spec 097) — coletor, montador, tipos e o template HTML único.
 */
export * from './reportTypes'
export { buildReportWindow, createReportCollector, parseEmergencyCard, type CreateReportCollectorDeps } from './reportCollector'
export { buildReportModel, type ReportLadder, type ReportMedicationRow, type ReportModel } from './reportModel'
export type { DayCellState, IntakeRow, IntakesSection, SlotCount } from './reportSections/intakes'
export type { Ladder, LadderStep, LadderStepState } from './reportSections/ladders'
export type { EndStatus, MedicationRow } from './reportSections/medications'
export type { StockRow } from './reportSections/stock'
export type { ChangeItem, ChangeKind } from './reportSections/changes'
export type { ReportHeader, VisitItem, VisitItemKind } from './reportSections/header'
export { STOCK_SOON_DAYS } from './reportSections/stock'
export { FOR_THIS_VISIT_MAX } from './reportSections/header'
export { formatCycleDoseLabel } from './reportFormat'
export { renderReportFooter, renderReportHtml, reportFileBaseName } from './reportTemplate'
export { escapeAttr, escapeHtml } from './reportHtmlEscape'
export {
  REPORT_ERROR_CODES,
  REPORT_EVENT_KEYS,
  reportSectionsOf,
  reportSizeBucket,
  toReportEventPayload,
  type ReportErrorCode,
  type ReportEventKey,
  type ReportEventPayload,
} from './reportAnalytics'
