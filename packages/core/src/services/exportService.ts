// exportService.ts — Coletor do bundle de export LGPD (spec 008, padrão 037).
//
// Busca os dados e delega a formatação aos formatadores puros (`../export`).
// UMA implementação para web e mobile: a paridade do inventário (PO-1) é por CONSTRUÇÃO,
// não por duas listas de colunas que alguém promete manter iguais.
//
// A plataforma injeta client + getUserId e cuida SÓ da entrega do arquivo:
//   - web:    Blob + <a download>
//   - mobile: FileSystem.cacheDirectory + Sharing.shareAsync

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import {
  buildExportCSV,
  buildExportJSON,
  generateExportFilename,
  type ExportBundle,
  type ExportDateRange,
  type ExportScope,
} from '../export/exportFormatters'
import { createProfileRepository } from '../repositories/createProfileRepository'
import { formatLocalDate, getEndOfDayISO, getServerTimestamp, getStartOfDayISO } from '../utils/dateUtils'

/** Teto de linhas por seção (SC-001: export local, sem paginação infinita). */
const MAX_ROWS = 10000

const MEDICINE_SELECT = `
  *,
  stock(*),
  purchases(*)
`

const PROTOCOL_SELECT = `
  *,
  medicine:medicines(*),
  treatment_plan:treatment_plans(id, name, emoji, color)
`

// 029 F6 — escada COMPLETA do titular, por `titration_id` (não o recorte por `protocol_id`
// que os selects de `protocols` carregam para o gerador de doses: aquele é a fatia do
// executor vigente e entregaria ao titular um histórico truncado).
// R-295: colunas conferidas em `information_schema` 2026-07-21 — `titrations` tem
// (id, user_id, treatment_plan_id, created_at, updated_at) e `titration_steps` tem
// (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days,
// status, protocol_id, started_at, ended_at, created_at, updated_at). NÃO existe
// `description` nem `requires_new_medicine` — foi um `description` inventado num select
// que derrubou prod no #750 (AP-300).
const TITRATION_SELECT = `
  id,
  treatment_plan_id,
  created_at,
  steps:titration_steps(
    id, position, medicine_id, dose, intake_unit, duration_days,
    status, protocol_id, started_at, ended_at,
    medicine:medicines(name)
  )
`

const LOG_SELECT = `
  *,
  medicine:medicines(*)
`

const BIOMARKER_SELECT =
  'id, user_id, type, value, value_secondary, unit, measured_at, context, source, notes, created_at'

export type ExportFormat = 'json' | 'csv'

export interface ExportFile {
  filename: string
  mimeType: string
  content: string
}

export interface BuildExportInput {
  format: ExportFormat
  scope: ExportScope
  /** Filtra SOMENTE registros de dose (demais seções saem completas). */
  dateRange?: ExportDateRange | null
  /** Instante do export (injetado — o core não chama `new Date()`, R-020). */
  now: Date
}

interface CreateExportServiceDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

type Row = Record<string, unknown>

/** Escopo completo — default do dialog/sheet. */
export const FULL_EXPORT_SCOPE: ExportScope = Object.freeze({
  includeProfile: true,
  includeProtocols: true,
  includeLogs: true,
  includeStock: true,
  includeMedicines: true,
  includeBiomarkers: true,
})

/** Fetchers de export isolados do client — extraídos pra manter createExportService enxuta. */
function _createExportFetchers(client: CreateExportServiceDeps['client']) {
  async function fetchMedicines(userId: string): Promise<Row[]> {
    const { data, error } = await client
      .from('medicines')
      .select(MEDICINE_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }

  async function fetchProtocols(userId: string): Promise<Row[]> {
    const { data, error } = await client
      .from('protocols')
      .select(PROTOCOL_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }

  async function fetchTitrations(userId: string): Promise<Row[]> {
    const { data, error } = await client
      .from('titrations')
      .select(TITRATION_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }

  async function fetchLogs(userId: string, dateRange: ExportDateRange | null): Promise<Row[]> {
    let query = client
      .from('medicine_logs')
      .select(LOG_SELECT)
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(MAX_ROWS)

    // Bordas do dia no fuso do usuário — `taken_at` é timestamptz e um corte ingênuo
    // comeria as doses da noite em runner UTC (R-020). Cada borda é INDEPENDENTE: o
    // usuário pode informar só "de" ou só "até" (paridade com o dialog web).
    if (dateRange?.start) {
      query = query.gte('taken_at', getStartOfDayISO(formatLocalDate(dateRange.start)))
    }
    if (dateRange?.end) {
      query = query.lte('taken_at', getEndOfDayISO(formatLocalDate(dateRange.end)))
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }

  async function fetchBiomarkers(userId: string): Promise<Row[]> {
    const { data, error } = await client
      .from('biomarkers_log')
      .select(BIOMARKER_SELECT)
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) throw error
    return (data ?? []) as unknown as Row[]
  }

  /** E-mail do titular (FR-012). Ausência não bloqueia o export — o bundle é o direito. */
  async function fetchEmail(): Promise<string | null> {
    try {
      const { data } = await client.auth.getUser()
      return data?.user?.email ?? null
    } catch (err) {
      console.error('Erro ao ler e-mail do titular (export segue sem ele):', err)
      return null
    }
  }

  return { fetchMedicines, fetchProtocols, fetchTitrations, fetchLogs, fetchBiomarkers, fetchEmail }
}

export function createExportService({ client, getUserId }: CreateExportServiceDeps) {
  if (!client) throw new Error('createExportService: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createExportService: getUserId deve ser uma função async')
  }

  const profileRepo = createProfileRepository({ client, getUserId })
  const { fetchMedicines, fetchProtocols, fetchTitrations, fetchLogs, fetchBiomarkers, fetchEmail } =
    _createExportFetchers(client)

  /**
   * Preferência de controle de estoque (044). Fail-safe: falha de leitura → `true`
   * (exportar estoque a mais é inócuo; omitir por engano esconderia dado real do titular).
   */
  async function isStockTracked(): Promise<boolean> {
    try {
      const { stock_tracking_enabled: enabled } = await profileRepo.getStockTracking()
      return enabled !== false
    } catch (err) {
      console.error('Erro ao ler preferência de estoque (assumindo controlado):', err)
      return true
    }
  }

  return {
    /** Monta o bundle cru (dados + identificação). Exposto para teste e reuso. */
    async collectBundle(
      scope: ExportScope,
      dateRange: ExportDateRange | null = null,
    ): Promise<ExportBundle> {
      const userId = await getUserId()
      // 046 Slice D: `stockTracked` é só METADADO informativo agora — NÃO gateia mais os dados.
      // O estoque desligado (044) congela lotes/compras no banco; eles são do titular (art. 18) e
      // saem no export independentemente da preferência. Condicionar a inclusão a `stockTracked`
      // escondia dado real (o furo de cobertura LGPD — R-291).
      const stockTracked = scope.includeStock ? await isStockTracked() : true

      // Estoque e compras vêm aninhados nos medicamentos — uma busca serve às duas seções.
      const needsMedicines = scope.includeMedicines || scope.includeStock

      const [profile, medicines, protocols, titrations, logs, biomarkers, email] = await Promise.all([
        scope.includeProfile ? profileRepo.getProfileForExport() : Promise.resolve(null),
        needsMedicines ? fetchMedicines(userId) : Promise.resolve(null),
        scope.includeProtocols ? fetchProtocols(userId) : Promise.resolve(null),
        // A escada segue o checkbox do tratamento: é a evolução da dose DELE (029 F6).
        scope.includeProtocols ? fetchTitrations(userId) : Promise.resolve(null),
        scope.includeLogs ? fetchLogs(userId, dateRange) : Promise.resolve(null),
        scope.includeBiomarkers ? fetchBiomarkers(userId) : Promise.resolve(null),
        fetchEmail(),
      ])

      return {
        subject: { userId, email },
        exportedAt: getServerTimestamp(),
        dateRange,
        stockTracked,
        profile,
        medicines: scope.includeMedicines ? (medicines ?? []) : null,
        protocols,
        titrations,
        logs,
        // Sempre que o titular pediu estoque, os dados vão — mesmo com o controle desligado.
        stock: scope.includeStock ? (medicines ?? []) : null,
        biomarkers,
      }
    },

    /** Bundle pronto para gravar/baixar: conteúdo + nome + mime. */
    async buildExport({ format, scope, dateRange = null, now }: BuildExportInput): Promise<ExportFile> {
      const bundle = await this.collectBundle(scope, dateRange)

      if (format === 'csv') {
        return {
          filename: generateExportFilename('dosiq_export', 'csv', now),
          mimeType: 'text/csv;charset=utf-8',
          content: buildExportCSV(bundle, scope),
        }
      }

      return {
        filename: generateExportFilename('dosiq_export', 'json', now),
        mimeType: 'application/json;charset=utf-8',
        content: buildExportJSON(bundle, scope),
      }
    },
  }
}
