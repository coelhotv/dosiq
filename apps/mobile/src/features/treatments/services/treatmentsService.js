// treatmentsService.js — thin local service para listagem de tratamentos
// R-168: compatibilidade com Hermes URL polyfill
// ADR-029: chama Supabase directamente usando nativeSupabaseClient

import { z } from 'zod'
import { getTodayLocal, isProtocolActiveOnDate } from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'
import { debugLog, errorLog } from '@shared/utils/debugLog'

/**
 * Busca todos os tratamentos ativos do usuário com dados de medicamento
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getActiveTreatments(userId) {
  try {
    // Validação de entrada conforme regra do projeto (R-125)
    z.string().uuid().parse(userId)

    debugLog('treatmentsService', `Buscando tratamentos ativos para: ${userId}`)

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
      .eq('active', true)
      .order('name')

    if (error) {
      errorLog('treatmentsService', 'Erro Supabase', error)
      return { success: false, error: error.message }
    }

    // Filtro de validade temporal (Wave v0.1.5)
    // Garantimos que o usuário só veja o que está tomando HOJE na fase Read-Only
    const today = getTodayLocal()
    const validData = (rawData || []).filter(p => isProtocolActiveOnDate(p, today))

    return { success: true, data: validData }
  } catch (err) {
    errorLog('treatmentsService', 'Erro inesperado', err)
    return { success: false, error: 'Erro ao carregar tratamentos ativos.' }
  }
}
