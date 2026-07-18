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

    return { success: true, data: rawData || [] }
  } catch (err) {
    errorLog('treatmentsService', 'Erro inesperado', err)
    return { success: false, error: 'Erro ao carregar tratamentos.' }
  }
}

// deprecated — usar getAllTreatments; remover no PR seguinte após callsites migrarem
export const getActiveTreatments = getAllTreatments
