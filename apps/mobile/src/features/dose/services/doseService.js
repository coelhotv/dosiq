// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logSchema } from '@meus-remedios/core'

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
    const { data, error } = await supabase
      .from('medicine_logs')
      .insert({ ...parsed.data, user_id: user.id })
      .select('id, taken_at, quantity_taken')
      .single()

    if (error) {
      if (__DEV__) console.error('[doseService] insert ERRO:', JSON.stringify(error))
      // Detectar erro de rede (R5-008: mensagem clara offline)
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'PGRST301') {
        return { success: false, error: 'Sem ligação à internet. O registo de dose requer conexão.' }
      }
      return { success: false, error: error.message }
    }

    if (__DEV__) console.log('[doseService] insert OK — id:', data?.id, 'taken_at:', data?.taken_at)
    return { success: true, data }
  } catch (err) {
    // Captura erros de rede não estruturados do fetch
    if (err.message?.includes('Network') || err.message?.includes('fetch')) {
      return { success: false, error: 'Sem ligação à internet. O registo de dose requer conexão.' }
    }
    return { success: false, error: err.message ?? 'Erro desconhecido ao registrar dose.' }
  }
}
