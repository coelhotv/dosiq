import { z } from 'zod'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

/**
 * Obter utilizador actualmente autenticado
 * @returns {Promise<{data: User|null, error: string|null}>}
 */
export async function getCurrentUser() {
  try {
    // R-020: Usar getSession() primeiro para evitar race conditions em mobile
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    let user = session?.user
    if (sessionError || !user) {
      const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Erro ao obter utilizador via getUser:', userError)
        return { data: null, error: userError.message }
      }
      user = verifiedUser
    }
    
    return { data: user ?? null, error: null }
  } catch (err) {
    if (__DEV__) console.error('Erro ao obter utilizador:', err)
    return { data: null, error: err.message }
  }
}

/**
 * Fazer logout do utilizador actual
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut()
    
    // Se a sessão já não existe, o logout foi tecnicamente bem sucedido localmente
    if (error) {
      if (error.message?.includes('session missing') || error.__isAuthError) {
        if (__DEV__) console.warn('Logout: sessão já estava ausente, considerando sucesso.')
        return { success: true, error: null }
      }
      if (__DEV__) console.error('Erro ao fazer logout:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err) {
    if (__DEV__) console.error('Erro ao fazer logout:', err)
    return { success: false, error: err.message }
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
      .select('user_id, telegram_chat_id, verification_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    
    return { data: data || { user_id: user.id, telegram_chat_id: null }, error: null }
  } catch (err) {
    if (__DEV__) console.error('Erro ao buscar definições (profileService):', err)
    return { data: null, error: err.message }
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
