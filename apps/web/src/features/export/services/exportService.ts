/**
 * Export Service (web) — adapter de ENTREGA do bundle LGPD (spec 008).
 *
 * @module exportService
 * @description Inventário, formatação (JSON/CSV) e sanitização vivem em `@dosiq/core`
 * (`createExportService` + formatadores puros) — uma implementação só, compartilhada com o
 * mobile. Aqui fica apenas o que é do browser: Blob + `<a download>`.
 *
 * REGRAS SEGUIDAS:
 * - R-020: datas no fuso local do usuário (via core)
 * - R-050: JSDoc em português
 */

import { createExportService, FULL_EXPORT_SCOPE } from '@dosiq/core'
import type { ExportScope } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'
import { getNow } from '@utils/dateUtils'

const exportService = createExportService({ client: supabase, getUserId })

/**
 * Faz download de arquivo no navegador (API exclusiva do browser — NÃO existe em RN).
 *
 * @param {string} content - Conteúdo do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Normaliza as opções do dialog no escopo canônico do core. */
function toScope(options: Partial<ExportScope>): ExportScope {
  return {
    includeProfile: options.includeProfile ?? FULL_EXPORT_SCOPE.includeProfile,
    includeProtocols: options.includeProtocols ?? FULL_EXPORT_SCOPE.includeProtocols,
    includeLogs: options.includeLogs ?? FULL_EXPORT_SCOPE.includeLogs,
    includeStock: options.includeStock ?? FULL_EXPORT_SCOPE.includeStock,
    includeMedicines: options.includeMedicines ?? FULL_EXPORT_SCOPE.includeMedicines,
    includeBiomarkers: options.includeBiomarkers ?? FULL_EXPORT_SCOPE.includeBiomarkers,
  }
}

interface ExportOptions extends Partial<ExportScope> {
  /** Filtra SOMENTE os registros de dose — demais seções saem completas. */
  dateRange?: { start: Date; end: Date } | null
}

/**
 * Exporta os dados do usuário como JSON e baixa o arquivo.
 *
 * @param {Object} options - Escopo (checkboxes) + período opcional
 * @returns {Promise<void>}
 */
export async function exportAsJSON(options: ExportOptions = {}) {
  const file = await exportService.buildExport({
    format: 'json',
    scope: toScope(options),
    dateRange: options.dateRange ?? null,
    now: getNow(),
  })

  downloadFile(file.content, file.filename, file.mimeType)
}

/**
 * Exporta os dados do usuário como CSV e baixa o arquivo.
 *
 * @param {Object} options - Escopo (checkboxes) + período opcional
 * @returns {Promise<void>}
 */
export async function exportAsCSV(options: ExportOptions = {}) {
  const file = await exportService.buildExport({
    format: 'csv',
    scope: toScope(options),
    dateRange: options.dateRange ?? null,
    now: getNow(),
  })

  downloadFile(file.content, file.filename, file.mimeType)
}

/**
 * Exporta nos dois formatos (JSON + CSV).
 *
 * @param {Object} options - Escopo (checkboxes) + período opcional
 * @returns {Promise<void>}
 */
export async function exportAll(options: ExportOptions = {}) {
  await Promise.all([exportAsJSON(options), exportAsCSV(options)])
}
