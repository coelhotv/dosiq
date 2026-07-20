// treatmentsService.js — thin local service para listagem de tratamentos
// R-168: compatibilidade com Hermes URL polyfill
// ADR-029: chama Supabase directamente usando nativeSupabaseClient

import { z } from 'zod'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'
import { debugLog, errorLog } from '@shared/utils/debugLog'

/**
 * Busca TODOS os tratamentos do usuário (ativos, pausados e finalizados).
 * Categorização por status é feita no transformer via resolveTreatmentStatus
 * (@dosiq/core/utils/treatmentStatus.js) — sem filtros server-side ou client-side.
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
/**
 * Substitui o embed `titration_steps` (filtrado por `protocol_id`) pela escada COMPLETA da
 * titulação de cada tratamento.
 *
 * 🔴 POR QUE ISTO EXISTE (furo achado no smoke do PO, 2026-07-20): o embed resolve pela FK
 * `titration_steps.protocol_id → protocols.id`, e **a maioria das etapas não tem `protocol_id`**
 * — hoje ele só é preenchido na etapa que vira executora (medido em prod: 6 de 15 etapas sem, e
 * 1 das 4 vigentes sem). Resultado: a listagem via o pedaço da escada que por acaso apontava para
 * aquele protocolo, quase nunca incluindo a etapa `current` — e o badge dizia **"Estável" sobre um
 * tratamento em plena evolução**. O detalhe acertava (usa `getLadderForProtocol`, que resolve pela
 * `titration_id`), então a MESMA escada dava duas respostas em duas telas.
 *
 * A identidade de uma escada é a `titration_id`, não o `protocol_id` — este último é o executor
 * VIGENTE e, por construção do modelo atual, transitório. Uma query só para o usuário (dezenas de
 * linhas), sem N+1.
 *
 * Best-effort (R-245): falhar aqui não pode derrubar a listagem — mantém o embed, que é um
 * subconjunto correto, apenas incompleto.
 *
 * @private
 */
async function attachFullLadders(userId, protocols) {
  if (!Array.isArray(protocols) || protocols.length === 0) return protocols
  try {
    // R-295: colunas verificadas no banco (information_schema) e select EXECUTADO via curl.
    const { data: steps, error } = await nativeSupabaseClient
      .from('titration_steps')
      .select('id, titration_id, protocol_id, position, status, duration_days')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    if (error || !Array.isArray(steps)) {
      errorLog('treatmentsService', 'Escada completa indisponível (mantém embed)', error)
      return protocols
    }

    const titrationByProtocol = new Map()
    const stepsByTitration = new Map()
    for (const s of steps) {
      if (s.protocol_id && !titrationByProtocol.has(s.protocol_id)) {
        titrationByProtocol.set(s.protocol_id, s.titration_id)
      }
      if (!stepsByTitration.has(s.titration_id)) stepsByTitration.set(s.titration_id, [])
      stepsByTitration.get(s.titration_id).push(s)
    }

    // AP-311 regra 3: não achar o vínculo ≠ não existir vínculo. Uma titulação cujas etapas NÃO
    // carregam `protocol_id` em nenhuma linha é inatribuível: o tratamento dela cai de volta no
    // embed incompleto e o badge volta a mentir — o mesmo furo que esta função corrige, de novo em
    // silêncio. Não dá para consertar aqui (o vínculo não existe no dado; some por construção no
    // Slice C / ADR-085), mas tem de ser OBSERVÁVEL.
    //
    // ⚠️ O sinal NÃO pode ser `protocols.titration_status`: verificado no banco (2026-07-20) é
    // `text` nullable, sem CHECK, default `'estável'` — e as 68 linhas de prod estão TODAS em
    // `'estável'`, inclusive tratamentos com escada em curso. Coluna nunca escrita ⇒ inútil como
    // evidência de titulação ativa.
    const linkedTitrations = new Set(titrationByProtocol.values())
    for (const titrationId of stepsByTitration.keys()) {
      if (!linkedTitrations.has(titrationId)) {
        errorLog(
          'treatmentsService',
          `Titulação órfã ${titrationId}: nenhuma etapa carrega protocol_id — tratamento fica sem escada na listagem e o badge pode subestimar a evolução (AP-311)`
        )
      }
    }

    return protocols.map((p) => {
      const titrationId = titrationByProtocol.get(p.id)
      const ladder = titrationId ? stepsByTitration.get(titrationId) : null
      // Sem escada ligada, preserva o embed (tratamento sem titulação → array vazio, badge Estável).
      return ladder ? { ...p, titration_steps: ladder } : p
    })
  } catch (err) {
    errorLog('treatmentsService', 'Erro ao montar escadas completas (mantém embed)', err)
    return protocols
  }
}

export async function getAllTreatments(userId) {
  try {
    // Validação de entrada conforme regra do projeto (R-125)
    z.string().uuid().parse(userId)

    debugLog('treatmentsService', `Buscando todos os tratamentos para: ${userId}`)

    // R-295: o embed `titration_steps(status, duration_days)` abaixo tem status/duration_days
    // verificadas no banco; resolve via FK `titration_steps.protocol_id → protocols.id` (mesmo shape
    // do MOBILE_DETAIL_SELECT — executado contra o PostgREST: 401 auth, não 42703/PGRST200).
    const { data: rawData, error } = await nativeSupabaseClient
      .from('protocols')
      .select(`
        id,
        name,
        frequency,
        time_schedule,
        dosage_per_intake,
        intake_unit,
        titration_status,
        active,
        start_date,
        end_date,
        weekdays,
        titration_steps(status, duration_days),
        treatment_plan:treatment_plan_id (
          id,
          name,
          emoji,
          color
        ),
        medicine:medicine_id (
          id,
          name,
          type,
          dosage_per_pill,
          dosage_unit,
          concentration_volume_ml,
          units_per_ml,
          therapeutic_class
        )
      `)
      .eq('user_id', userId)
      .order('name')

    if (error) {
      errorLog('treatmentsService', 'Erro Supabase', error)
      return { success: false, error: error.message }
    }

    const data = await attachFullLadders(userId, rawData || [])
    return { success: true, data }
  } catch (err) {
    errorLog('treatmentsService', 'Erro inesperado', err)
    return { success: false, error: 'Erro ao carregar tratamentos.' }
  }
}

// deprecated — usar getAllTreatments; remover no PR seguinte após callsites migrarem
export const getActiveTreatments = getAllTreatments
