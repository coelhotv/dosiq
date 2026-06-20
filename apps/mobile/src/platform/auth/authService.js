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

  const errorMappings = [
    { key: 'invalid login credentials', value: 'Email ou senha inválidos' },
    { key: 'user not found', value: 'Usuário não encontrado' },
    { key: 'email not confirmed', value: 'Email não confirmado. Verifique sua caixa de entrada.' },
    { key: 'user already registered', value: 'Email já cadastrado. Faça login.' },
    { key: 'password should be at least', value: 'Senha muito fraca. Use no mínimo 8 caracteres.' },
    { key: 'weak password', value: 'Senha muito fraca. Use no mínimo 8 caracteres.' },
    { key: 'password too long', value: 'Senha muito longa' },
    { key: 'email_not_authenticated', value: 'Email não autenticado' },
    { key: 'rate limit', value: 'Muitas tentativas. Tente novamente mais tarde.' },
    { key: 'different from the old password', value: 'Nova senha deve ser diferente da senha atual.' },
    { key: 'same password', value: 'Nova senha deve ser diferente da senha atual.' },
  ]

  const matched = errorMappings.find((m) => message.includes(m.key))
  if (matched) return matched.value

  const fallbacks = {
    login: 'Erro ao fazer login',
    signup: 'Erro ao criar conta',
    reset: 'Erro ao atualizar senha',
    send_reset: 'Erro ao enviar email de recuperação',
    verify_otp: 'Código inválido ou expirado',
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
      options: {
        // Universal Link / App Link (UL-S2): em produção, https abre o app se
        // instalado (associatedDomains iOS; Android autoVerify), senão cai no web
        // /auth/callback (detectSessionInUrl auto-completa). Em dev (__DEV__),
        // mantém o scheme dosiq:// — abre o build de dev direto, sem mandar o
        // usuário pro web/banco de produção. dosiq:// segue no allow-list.
        emailRedirectTo: __DEV__
          ? 'dosiq://auth/callback'
          : 'https://dosiq.app/auth/callback',
      },
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
 * Revalida a senha do usuário autenticado (re-autenticação para ações
 * destrutivas, ex: excluir conta). Supabase não expõe "verificar senha" puro;
 * usamos signInWithPassword com o email da sessão atual — senha errada retorna
 * erro e nada muda; senha certa apenas renova a sessão do mesmo usuário.
 * @param {string} password
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function verifyPassword(password) {
  if (!password) {
    return { success: false, error: 'Digite sua senha' }
  }
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' }
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (authError) {
      // Mensagem genérica: não confirmar se o erro é senha vs outro motivo.
      return { success: false, error: 'Senha incorreta' }
    }
    return { success: true, error: null }
  } catch {
    return { success: false, error: 'Erro ao verificar senha' }
  }
}

/**
 * Faz logout do usuário
 */
export async function signOut() {
  try {
    // scope 'local': limpa sessão local na hora, dispara SIGNED_OUT sem rede
    // (global pode pendurar no simulador iOS — ver logoutUser).
    const { error } = await supabase.auth.signOut({ scope: 'local' })
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

/**
 * Valida o código OTP numérico enviado por e-mail
 */
export async function verifyOtpWithEmail(email, token, type = 'signup') {
  const tokenClean = token.trim()
  if ((tokenClean.length !== 6 && tokenClean.length !== 8) || isNaN(Number(tokenClean))) {
    return { success: false, error: 'O código deve conter 6 ou 8 dígitos numéricos' }
  }

  try {
    const { data, error: authError } = await supabase.auth.verifyOtp({
      email,
      token: tokenClean,
      type,
    })

    if (authError) {
      return { success: false, error: translateAuthError(authError, 'verify_otp') }
    }

    return { success: true, data }
  } catch {
    return { success: false, error: 'Erro inesperado ao validar código' }
  }
}

export default { signInWithEmail, signUpWithEmail, sendPasswordReset, updatePassword, verifyOtpWithEmail, signOut }
