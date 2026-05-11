// authService.js — serviço de autenticação com validação Zod
import { z } from 'zod'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

const loginCredentialsSchema = z.object({
  email: z.string().email('Email inválido').trim(),
  password: z.string().min(1, 'Senha é obrigatória'),
})

const signupCredentialsSchema = z
  .object({
    email: z.string().email('Email inválido').trim(),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

const emailSchema = z.object({
  email: z.string().email('Email inválido').trim(),
})

function translateAuthError(authError, context = 'login') {
  if (!authError) return null

  const message = authError.message?.toLowerCase() || ''

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha inválidos'
  }
  if (message.includes('user not found')) {
    return 'Usuário não encontrado'
  }
  if (message.includes('email not confirmed')) {
    return 'Email não confirmado. Verifique sua caixa de entrada.'
  }
  if (message.includes('user already registered')) {
    return 'Email já cadastrado. Faça login.'
  }
  if (message.includes('password should be at least') || message.includes('weak password')) {
    return 'Senha muito fraca. Use no mínimo 8 caracteres.'
  }
  if (message.includes('password too long')) {
    return 'Senha muito longa'
  }
  if (message.includes('email_not_authenticated')) {
    return 'Email não autenticado'
  }
  if (message.includes('rate limit')) {
    return 'Muitas tentativas. Tente novamente mais tarde.'
  }
  if (message.includes('different from the old password') || message.includes('same password')) {
    return 'Nova senha deve ser diferente da senha atual.'
  }

  const fallbacks = {
    login: 'Erro ao fazer login',
    signup: 'Erro ao criar conta',
    reset: 'Erro ao atualizar senha',
    send_reset: 'Erro ao enviar email de recuperação',
  }
  return fallbacks[context] || authError.message || 'Erro inesperado'
}

/**
 * Realiza login com email e senha
 */
export async function signInWithEmail(email, password) {
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
      return { success: false, error: translateAuthError(authError, 'login') }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Erro inesperado ao fazer login' }
  }
}

/**
 * Cria nova conta com email e senha
 * Supabase envia email de confirmação após cadastro bem-sucedido
 */
export async function signUpWithEmail(email, password, confirmPassword) {
  const validation = signupCredentialsSchema.safeParse({ email, password, confirmPassword })

  if (!validation.success) {
    const errorMessage = validation.error.issues[0]?.message || 'Dados inválidos'
    return { success: false, error: errorMessage }
  }

  try {
    const { error: authError } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
    })

    if (authError) {
      return { success: false, error: translateAuthError(authError, 'signup') }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Erro inesperado ao criar conta' }
  }
}

/**
 * Envia email de recuperação de senha
 * Supabase não revela se o email existe (resposta sempre "success" por segurança)
 */
export async function sendPasswordReset(email) {
  const validation = emailSchema.safeParse({ email })

  if (!validation.success) {
    const errorMessage = validation.error.issues[0]?.message || 'Email inválido'
    return { success: false, error: errorMessage }
  }

  try {
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      validation.data.email,
      { redirectTo: 'dosiq://auth/callback' }
    )

    if (authError) {
      return { success: false, error: translateAuthError(authError, 'send_reset') }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Erro inesperado ao enviar email de recuperação' }
  }
}

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

/**
 * Atualiza a senha do usuário autenticado via link de recuperação
 */
export async function updatePassword(newPassword, confirmPassword) {
  const validation = updatePasswordSchema.safeParse({
    password: newPassword,
    confirmPassword,
  })

  if (!validation.success) {
    const errorMessage = validation.error.issues[0]?.message || 'Dados inválidos'
    return { success: false, error: errorMessage }
  }

  try {
    const { error: authError } = await supabase.auth.updateUser({
      password: validation.data.password,
    })

    if (authError) {
      return { success: false, error: translateAuthError(authError, 'reset') }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Erro inesperado ao atualizar senha' }
  }
}

/**
 * Faz logout do usuário
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

export default { signInWithEmail, signUpWithEmail, sendPasswordReset, updatePassword, signOut }
