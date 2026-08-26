// treatmentsService.js — thin local service para listagem de tratamentos
// R-168: compatibilidade com Hermes URL polyfill
// ADR-029: chama Supabase directamente usando nativeSupabaseClient

import { z } from 'zod'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'
import { attachFullLadders } from '@dosiq/core'
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
async function fetchAndAttachFullLadders(userId, protocols) {
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

    // 029 F6: a DERIVAÇÃO mora no core (`attachFullLadders`) — a web precisou da mesma
    // escada e duas cópias da mesma regra divergem (AP-306). Aqui fica só a I/O, que é
    // o que de fato difere entre as plataformas (cliente nativo vs. web).
    const { protocols: withLadders, orphanTitrationIds } = attachFullLadders(protocols, steps)

    // AP-311 regra 3: titulação inatribuível não pode sumir em silêncio — ver a doc de
    // `attachFullLadders`. O sinal NÃO pode ser `protocols.titration_status`: a coluna foi
    // dropada no F6 e, antes disso, estava `'estável'` nas 68 linhas de prod, inclusive em
    // tratamentos com escada em curso — nunca foi escrita.
    for (const titrationId of orphanTitrationIds) {
      errorLog(
        'treatmentsService',
        `Titulação órfã ${titrationId}: nenhuma etapa carrega protocol_id — tratamento fica sem escada na listagem e o badge pode subestimar a evolução (AP-311)`
      )
    }

    return withLadders
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
    // 029 F6: `titration_status` saiu deste select (coluna N1 DROPADA). Era vestígio: o badge
    // desta listagem já vinha de `fetchAndAttachFullLadders` acima, e não dela — ver a nota do AP-311
    // logo acima, que diz literalmente que o sinal NÃO pode ser `protocols.titration_status`.
    // Vestígio em `select()` não é inofensivo: pós-DROP vira `42703` (AP-300).
    const { data: rawData, error } = await nativeSupabaseClient
      .from('protocols')
      .select(`
        id,
        name,
        frequency,
        time_schedule,
        dosage_per_intake,
        intake_unit,
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
          presentation,
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

    const data = await fetchAndAttachFullLadders(userId, rawData || [])
    return { success: true, data }
  } catch (err) {
    errorLog('treatmentsService', 'Erro inesperado', err)
    return { success: false, error: 'Erro ao carregar tratamentos.' }
  }
}

// deprecated — usar getAllTreatments; remover no PR seguinte após callsites migrarem
export const getActiveTreatments = getAllTreatments
