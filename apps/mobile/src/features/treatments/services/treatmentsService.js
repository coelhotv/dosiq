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

    const { data: rawData, error } = await nativeSupabaseClient
      .from('protocols')
      .select(`
        id,
        name,
        frequency,
        time_schedule,
        dosage_per_intake,
        titration_status,
        active,
        start_date,
        end_date,
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
