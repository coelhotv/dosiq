// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logSchema } from '@meus-remedios/core'
import { logEvent } from '../../../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'

/**
 * Regista uma dose tomada.
 * Falha de forma clara se o dispositivo estiver offline.
 *
 * @param {{
 *   protocol_id: string|null,
 *   medicine_id: string,
 *   taken_at: string,       — ISO 8601 (ex: "2026-04-14T08:30:00")
 *   quantity_taken: number,
 *   notes?: string|null
 * }} logData
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function registerDose(logData) {
  // R5-008: verificar conectividade antes de escrever
  // React Native não tem navigator.onLine — tentamos a mutação e tratamos o erro de rede
  // A separação é garantida pelo fallback no catch abaixo.

  // R-121: validar com Zod antes de enviar ao Supabase
  if (__DEV__) console.log('[doseService] registerDose — input:', JSON.stringify(logData))
  const parsed = logSchema.safeParse(logData)
  if (!parsed.success) {
    if (__DEV__) console.warn('[doseService] Zod validation FAILED:', JSON.stringify(parsed.error.issues[0]))
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }
  if (__DEV__) console.log('[doseService] Zod OK — parsed:', JSON.stringify(parsed.data))

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' }
    }

    if (__DEV__) console.log('[doseService] insert start — user:', user.id)
    const { data: logEntry, error: insertError } = await supabase
      .from('medicine_logs')
      .insert({ ...parsed.data, user_id: user.id })
      .select('id, taken_at, quantity_taken, medicine_id')
      .single()

    if (insertError) {
      if (__DEV__) console.error('[doseService] insert ERRO:', JSON.stringify(insertError))
      // Detectar erro de rede (R5-008: mensagem clara offline)
      if (insertError.message?.includes('fetch') || insertError.message?.includes('network') || insertError.code === 'PGRST301') {
        return { success: false, error: 'Sem ligação à internet. O registo de dose requer conexão.' }
      }
      return { success: false, error: insertError.message }
    }

    if (__DEV__) console.log('[doseService] insert OK — id:', logEntry?.id, 'A consumir stock...')

    // R-170: Consumir stock via RPC transactional (Wave 4 legacy compatibility)
    // p_medicine_id, p_quantity, p_medicine_log_id
    const { error: stockError } = await supabase.rpc('consume_stock_fifo', {
      p_medicine_id: logEntry.medicine_id,
      p_quantity: logEntry.quantity_taken,
      p_medicine_log_id: logEntry.id
    })

    if (stockError) {
      // R-170: Logar erro de estoque para depuração conforme padrão do projeto
      console.warn('[doseService] erro ao consumir stock:', stockError)
      
      // ROLLBACK: remover o log inserido se não for possível consumir o stock
      const { error: rollbackError } = await supabase
        .from('medicine_logs')
        .delete()
        .eq('id', logEntry.id)
      
      if (rollbackError) {
        console.error('[doseService] erro crítico no rollback:', rollbackError)
        return { 
          success: false, 
          error: 'Erro crítico: falha ao atualizar estoque pós-registro. Contacte o suporte.' 
        }
      }
      
      // Traduções amigáveis para erros comuns de stock
      if (stockError.message?.includes('Estoque insuficiente')) {
        return { success: false, error: 'Estoque insuficiente para registrar esta dose.' }
      }
      
      return { success: false, error: 'Não foi possível registrar a dose: erro ao processar estoque.' }
    }

    if (__DEV__) console.log('[doseService] stock consumido com sucesso')
    await logEvent(EVENTS.DOSE_LOGGED, { medicine_id: logEntry.medicine_id })
    return { success: true, data: logEntry }
  } catch (err) {
    if (__DEV__) console.error('[doseService] erro catastrófico:', err)
    // Captura erros de rede não estruturados do fetch
    if (err.message?.includes('Network') || err.message?.includes('fetch')) {
      return { success: false, error: 'Sem ligação à internet. O registo de dose requer conexão.' }
    }
    return { success: false, error: err.message ?? 'Erro desconhecido ao registrar dose.' }
  }
}
