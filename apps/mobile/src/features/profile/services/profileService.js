// profileService.js — Thin local service para Profile feature (H5)
// ADR-029: Supabase Auth chamadas encapsuladas em services, não em componentes
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
    console.error('Erro ao obter utilizador:', err)
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
        console.warn('Logout: sessão já estava ausente, considerando sucesso.')
        return { success: true, error: null }
      }
      console.error('Erro ao fazer logout:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err) {
    console.error('Erro ao fazer logout:', err)
    return { success: false, error: err.message }
  }
}
