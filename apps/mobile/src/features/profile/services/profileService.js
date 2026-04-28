import { z } from 'zod'
import { userSettingsNotificationSchema } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

/**
 * Mapeia erros técnicos da API para mensagens amigáveis em Português (R-170)
 * @param {Error|Object} error 
 * @returns {string}
 */
function mapErrorToMessage(error) {
  if (!error) return 'Erro desconhecido'
  const message = error.message || ''
  
  if (message.includes('fetch') || message.includes('network')) return 'Sem ligação à internet.'
  if (message.includes('JWT') || message.includes('session')) return 'Sessão expirada. Faça login novamente.'
  if (message.includes('Invalid path')) return 'Erro interno de rota (API). Contacte o suporte.'
  
  return message || 'Erro ao processar pedido.'
}

/**
 * Obter utilizador actualmente autenticado
 * @returns {Promise<{data: User|null, error: string|null}>}
 */
export async function getCurrentUser() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    let user = session?.user
    if (sessionError || !user) {
      const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      user = verifiedUser
    }
    
    return { data: user ?? null, error: null }
  } catch (err) {
    console.error('[profileService] erro ao obter utilizador:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Fazer logout do utilizador actual
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      if (error.message?.includes('session missing') || error.__isAuthError) {
        return { success: true, error: null }
      }
      throw error
    }
    return { success: true, error: null }
  } catch (err) {
    console.error('[profileService] erro ao fazer logout:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Buscar as configurações do usuário atual (inclui telegram_chat_id)
 * @returns {Promise<{data: any, error: string|null}>}
 */
export async function getUserSettings() {
  try {
    const { data: user, error: userError } = await getCurrentUser()
    if (userError || !user) throw new Error(userError || 'Utilizador não encontrado')

    // R-121/R-125: Validar userId antes de realizar consulta ao Supabase
    z.string().uuid().parse(user.id)

    const { data, error } = await supabase
      .from('user_settings')
      .select(`
        user_id, 
        telegram_chat_id, 
        verification_token, 
        notification_preference,
        notification_mode,
        quiet_hours_start,
        quiet_hours_end,
        digest_time,
        channel_mobile_push_enabled,
        channel_web_push_enabled,
        channel_telegram_enabled
      `)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    
    const settings = data || { user_id: user.id, telegram_chat_id: null }
    
    // Adicionando validação do output conforme sugerido
    userSettingsNotificationSchema.extend({
      user_id: z.string().uuid(),
      telegram_chat_id: z.string().nullable().optional(),
      verification_token: z.string().nullable().optional()
    }).parse(settings)

    return { data: settings, error: null }
  } catch (err) {
    console.error('[profileService] erro ao buscar definições:', err)
    return { data: null, error: mapErrorToMessage(err) }
  }
}

/**
 * Atualizar configurações de notificação do utilizador (Sprint N2.6)
 * @param {string} userId
 * @param {Object} settings
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateNotificationSettings(userId, settings) {
  try {
    z.string().uuid().parse(userId)

    const parsed = userSettingsNotificationSchema.partial().safeParse(settings)
    if (!parsed.success) {
      throw new Error(parsed.error.errors.map(e => e.message).join(', '))
    }

    const updatePayload = {
      id: userId,
      ...settings
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(updatePayload, { onConflict: 'id' })

    if (error) throw error
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('[profileService] erro ao salvar notificações:', err)
    return { success: false, error: mapErrorToMessage(err) }
  }
}

/**
 * Gerar token de verificação via Supabase RPC (Opção A)
 * @returns {Promise<{token: string|null, error: string|null}>}
 */
export async function generateTelegramToken() {
  try {
    // Opção A decidida conforme EXEC_SPEC_HIBRIDO_H5_SPRINT_PLAN.md
    const { data, error } = await supabase.rpc('generate_telegram_token')
    
    if (error) throw error
    return { token: data, error: null }
  } catch (err) {
    if (__DEV__) console.error('Erro ao gerar token Telegram:', err)
    return { token: null, error: err.message }
  }
}
