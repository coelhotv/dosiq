// profileService.js — Thin local service para Profile feature (H5)
// ADR-029: Supabase Auth chamadas encapsuladas em services, não em componentes
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

/**
 * Obter utilizador actualmente autenticado
 * @returns {Promise<{data: User|null, error: string|null}>}
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Erro ao obter utilizador:', error)
      return { data: null, error: error.message }
    }
    return { data: data?.user ?? null, error: null }
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
    if (error) {
      console.error('Erro ao fazer logout:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  } catch (err) {
    console.error('Erro ao fazer logout:', err)
    return { success: false, error: err.message }
  }
}
