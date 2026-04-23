// ADR-029: thin local service — chama Supabase directamente via nativeSupabaseClient
// R-125: validação Zod na camada de serviço (R-NNN sugerido em review PR #467)

import { z } from 'zod'
import { getTodayLocal, isProtocolActiveOnDate } from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'

/**
 * Busca a lista de medicamentos com seu estoque e protocolos ativos para cálculo de consumo.
 * 
 * @param {string} userId - UUID do usuário
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getStockData(userId) {
  try {
    // Validação de entrada conforme R-125
    z.string().uuid().parse(userId)

    if (__DEV__) console.log('[stockService] Buscando dados de estoque para:', userId)

    // Buscamos medicamentos com: 
    // 1. Quantidade total (da view medicine_stock_summary)
    // 2. Protocolos ativos (para calcular consumo diário)
    // Nota: O join com medicine_stock_summary usa a relação automática baseada em medicine_id
    const { data: rawData, error } = await nativeSupabaseClient
      .from('medicines')
      .select(`
        id,
        name,
        laboratory,
        dosage_unit,
        dosage_per_pill,
        medicine_stock_summary!left (
          total_quantity
        ),
        protocols (
          id,
          dosage_per_intake,
          time_schedule,
          frequency,
          active,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId)
      .eq('protocols.active', true)
      .order('name')

    if (error) {
      console.error('[stockService] Erro na query:', error)
      return { success: false, error: 'Erro ao carregar dados de estoque' }
    }

    // Filtro de validade de protocolos (Wave v0.1.5)
    // Na fase Read-Only, só mostramos estoque do que tem tratamento "rodando" hoje.
    const today = getTodayLocal()
    const validData = (rawData || []).filter(m => {
      // Verifica se existe pelo menos um protocolo vinculado que seja válido para hoje
      const hasValidProtocol = (m.protocols || []).some(p => isProtocolActiveOnDate(p, today))
      return hasValidProtocol
    })

    return { success: true, data: validData }
  } catch (err) {
    console.error('[stockService] Erro inesperado:', err)
    return { success: false, error: err.message }
  }
}
