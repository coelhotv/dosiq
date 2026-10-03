/**
 * reportCollector — lê do banco tudo que o relatório clínico precisa (spec 097, FR-003/FR-022).
 *
 * Regras (vinculantes):
 * - `user_id` explícito em TODA leitura, não só a RLS (PO-SEC-2 guard).
 * - Histórico inclui arquivados: os repositórios do core filtram `archived_at` e por isso NÃO são
 *   reusados aqui (CON-039 — leitor de fato não filtra arquivado; seções do presente filtram no
 *   montador).
 * - Leitura de período pagina com `.range()` até a página vir incompleta (AP-186).
 * - Qualquer fonte falhou ⇒ lança. Não existe relatório parcial (FR-022 / RC3-F6).
 * - Dia local = fuso de `user_settings.timezone` (ADR-049; o mesmo da RPC — C-1 do A1).
 * - Nenhuma coluna de preço é selecionada (DS-4).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { DEFAULT_TIMEZONE } from '../../schemas/userSettingsSchema'
import { addDays, formatLocalDate, getEndOfDayISO, getStartOfDayISO, parseLocalDate } from '../../utils/dateUtils'
import {
  REPORT_PERIOD_DAYS,
  type ReportBiomarkerRow,
  type ReportDoseDayRow,
  type ReportInputs,
  type ReportMedicineLogRow,
  type ReportMedicineRow,
  type ReportPeriodDays,
  type ReportProfile,
  type ReportProtocolRow,
  type ReportStockTotalRow,
  type ReportTitrationStepRow,
  type ReportWindow,
} from './reportTypes'

export interface CreateReportCollectorDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

const PAGE_SIZE = 1000

const SETTINGS_SELECT = 'display_name, birth_date, emergency_card, timezone, stock_tracking_enabled'
const PROTOCOL_SELECT =
  'id, medicine_id, name, frequency, time_schedule, dosage_per_intake, intake_unit, interval_days, weekdays, start_date, end_date, active, paused_at, archived_at'
const MEDICINE_SELECT =
  'id, name, active_ingredient, dosage_per_pill, dosage_unit, units_per_ml, concentration_volume_ml, presentation, type, shelf_life_days, archived_at'
const STEP_SELECT =
  'id, titration_id, position, medicine_id, protocol_id, dose, intake_unit, duration_days, status, started_at, ended_at'
const STOCK_SELECT = 'medicine_id, total_quantity'
const BIOMARKER_SELECT = 'id, type, value, value_secondary, unit, measured_at, context'
const LOG_SELECT = 'id, protocol_id, medicine_id, taken_at, injection_site'

/**
 * Janela inclusiva de `days` dias terminando em `to` (data local YYYY-MM-DD).
 * @throws se `days` não for um dos períodos fixos (RC2-D4) ou `to` não for data.
 */
export function buildReportWindow(days: ReportPeriodDays, to: string): ReportWindow {
  if (!REPORT_PERIOD_DAYS.includes(days)) {
    throw new Error(`Período de relatório inválido: ${String(days)}`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error(`Data final inválida: ${to}`)
  const from = formatLocalDate(addDays(parseLocalDate(to), -(days - 1)))
  return { from, to, days }
}

/** Normaliza o cartão de emergência (jsonb) sem confiar na forma: o banco não tem CHECK. */
export function parseEmergencyCard(card: unknown): Pick<ReportProfile, 'allergies' | 'bloodType'> {
  const obj = card && typeof card === 'object' && !Array.isArray(card) ? (card as Record<string, unknown>) : {}
  const rawAllergies = obj.allergies
  const allergies = Array.isArray(rawAllergies)
    ? rawAllergies.filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean)
    : []
  const blood = typeof obj.blood_type === 'string' ? obj.blood_type.trim() : ''
  return { allergies, bloodType: blood || null }
}

type PageQuery = (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>

async function readAllPages<T>(query: PageQuery): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await query(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    out.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

export function createReportCollector({ client, getUserId }: CreateReportCollectorDeps) {
  if (!client) throw new Error('createReportCollector: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createReportCollector: getUserId deve ser uma função async')
  }

  async function readSettings(userId: string) {
    const { data, error } = await client
      .from('user_settings')
      .select(SETTINGS_SELECT)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    const row = (data ?? {}) as {
      display_name?: string | null
      birth_date?: string | null
      emergency_card?: unknown
      timezone?: string | null
      stock_tracking_enabled?: boolean | null
    }
    const profile: ReportProfile = {
      displayName: row.display_name?.trim() || null,
      birthDate: row.birth_date ?? null,
      ...parseEmergencyCard(row.emergency_card),
    }
    return {
      profile,
      timezone: row.timezone || DEFAULT_TIMEZONE,
      // 044: só `false` explícito desliga (FR-007).
      stockTrackingEnabled: row.stock_tracking_enabled !== false,
    }
  }

  return {
    /**
     * Lê todas as fontes do relatório para `days` dias terminando em `to` (dia local).
     * @throws na primeira fonte que falhar (FR-022).
     */
    async collect({ days, to }: { days: ReportPeriodDays; to: string }): Promise<ReportInputs> {
      const window = buildReportWindow(days, to)
      const userId = await getUserId()
      if (!userId) throw new Error('reportCollector: usuário não autenticado')

      const settings = await readSettings(userId)
      const fromIso = getStartOfDayISO(window.from, settings.timezone)
      const toIso = getEndOfDayISO(window.to, settings.timezone)

      const [protocols, medicines, doseDays, titrationSteps, stockTotals, biomarkers, medicineLogs] =
        await Promise.all([
          readAllPages<ReportProtocolRow>((a, b) =>
            client.from('protocols').select(PROTOCOL_SELECT).eq('user_id', userId).order('id').range(a, b)
          ),
          readAllPages<ReportMedicineRow>((a, b) =>
            client.from('medicines').select(MEDICINE_SELECT).eq('user_id', userId).order('id').range(a, b)
          ),
          readAllPages<ReportDoseDayRow>((a, b) =>
            client.rpc('report_dose_days', { p_from: window.from, p_to: window.to }).range(a, b)
          ),
          readAllPages<ReportTitrationStepRow>((a, b) =>
            client.from('titration_steps').select(STEP_SELECT).eq('user_id', userId).order('id').range(a, b)
          ),
          readAllPages<ReportStockTotalRow>((a, b) =>
            client.from('medicine_stock_summary').select(STOCK_SELECT).eq('user_id', userId).order('medicine_id').range(a, b)
          ),
          readAllPages<ReportBiomarkerRow>((a, b) =>
            client
              .from('biomarkers_log')
              .select(BIOMARKER_SELECT)
              .eq('user_id', userId)
              .gte('measured_at', fromIso)
              .lte('measured_at', toIso)
              .order('measured_at')
              .order('id')
              .range(a, b)
          ),
          readAllPages<ReportMedicineLogRow>((a, b) =>
            client
              .from('medicine_logs')
              .select(LOG_SELECT)
              .eq('user_id', userId)
              .gte('taken_at', fromIso)
              .lte('taken_at', toIso)
              .order('taken_at')
              .order('id')
              .range(a, b)
          ),
        ])

      return {
        window,
        timezone: settings.timezone,
        profile: settings.profile,
        stockTrackingEnabled: settings.stockTrackingEnabled,
        protocols,
        medicines,
        doseDays,
        titrationSteps,
        stockTotals: stockTotals.map((s) => ({ medicine_id: s.medicine_id, total_quantity: Number(s.total_quantity) })),
        biomarkers,
        medicineLogs,
      }
    },
  }
}
