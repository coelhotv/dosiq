// fetchChatbotContextData.js — Fetcher canônico do contexto do chatbot (CON-028, ADR-074).
//
// UMA definição dos selects, chamada pelas 3 superfícies (web/mobile client-side, Telegram
// server-side) → os inputs do builder convergem POR CONSTRUÇÃO, não por disciplina (FR-010
// mecanismo 1). Roda no runtime de cada superfície ("(A) client-build"): recebe o client
// Supabase + getUserId e devolve o shape cru/derivado que o builder consome.
//
// Estreito de propósito: é UMA leitura dedicada, NÃO a migração dos CRUD repos full
// (descopada por blast radius — RC3 F2). A saída é validada pelo seam Zod (CON-028) antes
// de chegar ao builder.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { createDoseInstanceRepository } from '../repositories/createDoseInstanceRepository'
import { calculateDailyIntake, calculateDaysRemaining, type AdherenceProtocol } from '../utils/adherenceLogic'
import { getNow, getTodayLocal, parseLocalDate, addDays } from '../utils/dateUtils'
import { validateChatbotContextData } from './chatbotContextSchema'

/** Janela (dias) de dose_instances ao redor de hoje p/ alimentar splitDayTimeline (carry-over+hoje+look-ahead). */
const DOSE_WINDOW_DAYS = 2
/** Janela de adesão instances-based (R-248). */
const ADHERENCE_WINDOW_DAYS = 30

/** Medicamento (linha crua do Supabase, `stock(*)` embedded). */
interface MedicineRow {
  id: string
  min_stock_threshold?: number | null
  stock?: Array<{ quantity: number }> | null
  [key: string]: unknown
}

/** Protocolo (linha crua do Supabase). */
interface ProtocolRow {
  medicine_id: string | null
  active?: boolean | null
  [key: string]: unknown
}

/**
 * Resumo de estoque rich (paridade web — `_deriveStockSummary`). Movido p/ o core para que
 * as 3 superfícies derivem igual. Lê `medicine.stock[]` embedded + protocolos ativos.
 * @param medicines
 * @param protocols
 * @returns Array<{medicine,total,daysRemaining,isZero,isLow,dailyIntake}>
 */
function deriveStockSummary(medicines: MedicineRow[] | null | undefined, protocols: ProtocolRow[] | null | undefined) {
  const activeMedicineIds = new Set((protocols || []).filter((p) => p.active).map((p) => p.medicine_id))
  return (medicines || [])
    .filter((m) => activeMedicineIds.has(m.id))
    .map((medicine) => {
      const activeStockEntries = (medicine.stock || []).filter((s) => s.quantity > 0)
      const totalQuantity = activeStockEntries.reduce((sum, s) => sum + s.quantity, 0)
      // Cast local: `protocols`/`medicine` aqui são linhas cruas do Supabase (shape amplo,
      // `medicine_id` pode ser `null`); `AdherenceProtocol` (adherenceLogic.ts) não modela
      // `null` no FK — seguro pois a comparação `p.medicine_id === medicineId` tolera null.
      const dailyIntake = calculateDailyIntake(
        medicine.id,
        protocols as AdherenceProtocol[] | null | undefined,
        medicine as AdherenceProtocol['medicine']
      )
      const daysRemaining = calculateDaysRemaining(totalQuantity, dailyIntake)
      const threshold = medicine.min_stock_threshold || 0
      const isZero = totalQuantity === 0
      const isLow =
        !isZero &&
        (dailyIntake > 0
          ? daysRemaining <= 7 || totalQuantity <= threshold
          : totalQuantity <= threshold && totalQuantity > 0)
      return { medicine, total: totalQuantity, daysRemaining, isZero, isLow, dailyIntake }
    })
}

/**
 * Adesão leve instances-based (R-248): taken/(taken+missed) na janela; skipped_* neutro;
 * denom vazio → null. Substitui as duas implementações divergentes (web 30d-instances via
 * adherenceService vs Telegram 7d-logs) por uma fonte única no core.
 * @param repo - createDoseInstanceRepository
 * @param userId
 * @returns Promise<{adherence:number|null}>
 */
async function computeInstancesAdherence(repo: ReturnType<typeof createDoseInstanceRepository>, userId: string) {
  // Adesão é dado SECUNDÁRIO (1 linha no contexto): falha transitória na consulta NÃO deve
  // derrubar todo o contexto do chatbot. Degrada gracioso (null) — diferente dos selects
  // primários (medicines/protocols), que falham alto por design (FR-010).
  try {
    const now = getNow()
    const from = addDays(now, -ADHERENCE_WINDOW_DAYS)
    const { taken, missed } = await repo.countByStatus({ userId, fromTs: from, toTs: now })
    const denom = taken + missed
    return { adherence: denom > 0 ? Math.min(taken / denom, 1) : null }
  } catch (error) {
    console.error('[chatbot] Erro ao calcular adesão (degradando p/ null):', error?.message || error)
    return { adherence: null }
  }
}

/**
 * Busca + deriva o contexto do paciente para o chatbot (saída == entrada do builder, CON-028).
 * @param deps
 * @param deps.supabase - Cliente Supabase do runtime
 * @param deps.getUserId - () => Promise<string> (id do usuário autenticado)
 * @returns ChatbotContextData
 */
export async function fetchChatbotContextData({
  supabase,
  getUserId,
}: {
  supabase: SupabaseClient<Database>
  getUserId: () => Promise<string>
}) {
  if (!supabase) throw new Error('fetchChatbotContextData: supabase é obrigatório')
  if (typeof getUserId !== 'function') throw new Error('fetchChatbotContextData: getUserId é obrigatório')

  const userId = await getUserId()
  if (!userId) throw new Error('fetchChatbotContextData: usuário não autenticado')

  const today = getTodayLocal()
  const yesterdayIso = addDays(parseLocalDate(today), -1).toISOString()
  const windowFrom = addDays(parseLocalDate(today), -DOSE_WINDOW_DAYS)
  const windowTo = addDays(parseLocalDate(today), DOSE_WINDOW_DAYS)

  const doseRepo = createDoseInstanceRepository({ client: supabase })

  // Selects canônicos — uma definição, paralelos.
  const [medicinesRes, protocolsRes, logsRes, plansRes, profileRes, doseInstances, stats] = await Promise.all([
    supabase.from('medicines').select('*, stock(*)').eq('user_id', userId),
    supabase
      .from('protocols')
      .select('*, treatment_plan:treatment_plans(id, name, emoji, color)')
      .eq('user_id', userId),
    supabase.from('medicine_logs').select('protocol_id, taken_at').eq('user_id', userId).gte('taken_at', yesterdayIso),
    supabase.from('treatment_plans').select('id, name').eq('user_id', userId),
    // Perfil leve (nome/idade) p/ personalizar tom — DADO SECUNDÁRIO: degrada gracioso
    // (não derruba o contexto se falhar). Perfil vive em user_settings (1 linha/user).
    supabase.from('user_settings').select('display_name, birth_date').eq('user_id', userId).maybeSingle(),
    doseRepo.getWindow(userId, windowFrom, windowTo),
    computeInstancesAdherence(doseRepo, userId),
  ])

  // Falha alto: erro de select PRIMÁRIO não pode gerar contexto silenciosamente parcial (FR-010).
  for (const res of [medicinesRes, protocolsRes, logsRes, plansRes]) {
    if (res.error) throw res.error
  }

  const medicines = medicinesRes.data || []
  const protocols = protocolsRes.data || []
  const data = {
    medicines,
    protocols,
    logs: logsRes.data || [],
    stockSummary: deriveStockSummary(medicines, protocols),
    stats,
    doseInstances: doseInstances || [],
    treatmentPlans: plansRes.data || [],
    // Secundário: erro → null (não bloqueia o contexto).
    profile: profileRes.error ? null : profileRes.data || null,
  }

  // Seam Zod (CON-028) — valida o shape antes do builder (FR-010 mecanismo 3).
  const validation = validateChatbotContextData(data)
  // `=== false` (não `!`): consumidores non-strict (mobile) só estreitam a união com literal
  if (validation.success === false) {
    const detail = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
    throw new Error(`fetchChatbotContextData: shape inválido (CON-028) — ${detail}`)
  }
  return validation.data
}
