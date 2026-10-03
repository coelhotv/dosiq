/**
 * Payload dos eventos `report_generated` / `report_generation_error` (spec 097 PO-SEC-5,
 * RC-SEC-F5). Allowlist de chaves e de valores: o chamador tem o modelo inteiro à mão, e nada
 * dele — nome, medicamento, mensagem de erro livre — pode chegar a analytics ou Sentry.
 */
import type { ReportModel } from './reportModel'

export const REPORT_EVENT_KEYS = ['platform', 'period', 'sections', 'duration_ms', 'size_bucket', 'error_code'] as const
export type ReportEventKey = (typeof REPORT_EVENT_KEYS)[number]

/** Etapa em que a geração falhou — vocabulário fechado, nunca a mensagem do erro. */
export const REPORT_ERROR_CODES = ['collect', 'render', 'print', 'share', 'unknown'] as const
export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number]

export type ReportEventPayload = Partial<Record<ReportEventKey, string | number>>

/** Filtra qualquer objeto para a allowlist (chave e tipo primitivo). */
export function toReportEventPayload(raw: Record<string, unknown>): ReportEventPayload {
  const out: ReportEventPayload = {}
  for (const key of REPORT_EVENT_KEYS) {
    const value = raw[key]
    if (typeof value !== 'string' && typeof value !== 'number') continue
    if (key === 'error_code') {
      out.error_code = (REPORT_ERROR_CODES as readonly string[]).includes(String(value)) ? value : 'unknown'
      continue
    }
    out[key] = value
  }
  return out
}

/** Faixa do tamanho do documento (nunca o tamanho exato). */
export function reportSizeBucket(bytes: number): string {
  if (bytes < 100_000) return 'lt_100k'
  if (bytes < 500_000) return 'lt_500k'
  if (bytes < 1_000_000) return 'lt_1m'
  return 'gte_1m'
}

/** Seções presentes no modelo, por nome técnico (sem conteúdo). */
export function reportSectionsOf(model: ReportModel): string {
  const present: string[] = []
  if (model.forThisVisit.length) present.push('for_this_visit')
  if (model.medications.length) present.push('medications')
  if (model.intakes.active.length) present.push('intakes')
  if (model.changes.length) present.push('changes')
  if (model.ladders.length) present.push('ladders')
  if (model.ladders.some((l) => l.weightSeries)) present.push('weight_series')
  if (model.intakes.ended.length) present.push('ended')
  if (model.stock?.length) present.push('stock')
  return present.join(',')
}
