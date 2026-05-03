// authService.js — serviço de autenticação com validação Zod
import { z } from 'zod'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

/**
 * Schema para validação de credenciais de login
 */
const loginCredentialsSchema = z.object({
  email: z.string().email('Email inválido').trim(),
  password: z.string().min(1, 'Senha é obrigatória'),
})

/**
 * Traduz erros do Supabase Auth para mensagens amigáveis em português
 * @param {Error} authError - Erro retornado pelo Supabase Auth
 * @returns {string} Mensagem de erro traduzida
 */
function translateAuthError(authError) {
  if (!authError) return null

  const message = authError.message?.toLowerCase() || ''

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha inválidos'
  }
  if (message.includes('user not found')) {
    return 'Usuário não encontrado'
  }
  if (message.includes('email not confirmed')) {
    return 'Email não confirmado'
  }
  if (message.includes('password too long')) {
    return 'Senha muito longa'
  }
  if (message.includes('email_not_authenticated')) {
    return 'Email não autenticado'
  }
  if (message.includes('rate limit')) {
    return 'Muitas tentativas de login. Tente novamente mais tarde'
  }

  // Fallback: retorna mensagem original se não conseguir traduzir
  return authError.message || 'Erro ao fazer login'
}

/**
 * Realiza login com email e senha
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function signInWithEmail(email, password) {
  // Validação com Zod
  const validation = loginCredentialsSchema.safeParse({ email, password })

  if (!validation.success) {
    const errorMessage = validation.error.issues[0]?.message || 'Dados inválidos'
    return { success: false, error: errorMessage }
  }

  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    })

    if (authError) {
      const translatedError = translateAuthError(authError)
      return { success: false, error: translatedError }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Erro inesperado ao fazer login' }
  }
}

/**
 * Faz logout do usuário
 * @returns {Promise<{success: boolean}>}
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Erro ao fazer logout:', error.message)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    console.error('Erro inesperado ao fazer logout:', err)
    return { success: false }
  }
}

export default { signInWithEmail, signOut }
