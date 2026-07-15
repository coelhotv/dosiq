import { createClient } from '@supabase/supabase-js'
import { getDeviceTimezone, resolveSupportedTz, CURRENT_POLICY_VERSION } from '@dosiq/core'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas. Verifique o arquivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Cache em memória — evita roundtrips auth/user no primeiro load
let _cachedUserId = null
let _userIdPromise = null // Coalescência: múltiplas chamadas simultâneas compartilham a mesma promise
let _cachedUser = null
let _currentUserPromise = null

export const getUserId = async () => {
  if (_cachedUserId) return _cachedUserId

  // Coalescência: se já há uma chamada em voo, reutiliza a mesma promise
  if (_userIdPromise) return _userIdPromise

  _userIdPromise = supabase.auth
    .getUser()
    .then(({ data: { user } }) => {
      _userIdPromise = null
      if (!user) throw new Error('Usuário não autenticado')
      _cachedUserId = user.id
      return user.id
    })
    .catch((err) => {
      _userIdPromise = null
      throw err
    })

  return _userIdPromise
}

export const getCurrentUser = async () => {
  if (_cachedUser) return _cachedUser

  // Coalescência: múltiplas chamadas simultâneas compartilham a mesma promise
  if (_currentUserPromise) return _currentUserPromise

  _currentUserPromise = supabase.auth
    .getUser()
    .then(({ data: { user } }) => {
      _currentUserPromise = null
      _cachedUser = user
      // Aproveita para cachear userId também (evita roundtrip duplicado)
      if (user) _cachedUserId = user.id
      return user
    })
    .catch((err) => {
      _currentUserPromise = null
      throw err
    })

  return _currentUserPromise
}

// Invalida cache ao mudar estado de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // Limpa cache para forçar re-fetch com tokens atualizados
    _cachedUserId = null
    _userIdPromise = null
    _cachedUser = null
    _currentUserPromise = null
  }
  // Re-popula o cache imediatamente quando há sessão ativa (evita roundtrip extra)
  if (session?.user && event !== 'SIGNED_OUT') {
    _cachedUserId = session.user.id
    _cachedUser = session.user
  }
})

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Cadastro. `healthConsent` viaja no `user_metadata` (spec 046, T005).
 *
 * ⚠️ `user_metadata` é CLIENT-WRITABLE (`auth.updateUser`) — isto é CARONA da intenção, jamais
 * prova. Existe porque, com confirmação de e-mail ligada, não há sessão no momento do cadastro, e
 * sem sessão o RPC `SECURITY DEFINER` não tem `auth.uid()` para carimbar o evento. Quem grava a
 * trilha é `materializeSignupIntent` no 1º bootstrap autenticado, via RPC — o servidor deriva
 * titular, versão e hash. Nunca gravar o evento "confiando" neste metadata.
 */
export const signUp = async (email, password, options: { healthConsent?: boolean } = {}) => {
  // Consentimento como CONDIÇÃO DE USO (FR-002): a conta não nasce sem opt-in. O gate de UI já
  // barra o form, mas a trava vive TAMBÉM aqui — paridade com o mobile (authService), fechando o
  // caminho de qualquer caller chegar ao signUp sem consentimento.
  if (options.healthConsent !== true) {
    throw new Error('É necessário autorizar o tratamento dos dados de saúde para criar a conta.')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        health_consent: true,
        policy_version: CURRENT_POLICY_VERSION,
      },
    },
  })
  if (error) throw error
  return data
}

export const sendPasswordReset = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
}

export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
  return data
}

export const verifyOtp = async (email, token, type = 'signup') => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: token.trim(),
    type,
  })
  if (error) throw error
  return data
}

/**
 * F4.3f.0 — captura o fuso real do device logo após a confirmação de signup
 * (1º ponto determinístico da conta), ANTES do onboarding: cobre quem pula o
 * wizard e deixa o tz pronto p/ a geração do 1º tratamento. Best-effort (não
 * lança). GATE: chamar SÓ no fluxo de signup/confirmação — nunca em login de
 * conta existente, que sobrescreveria a escolha manual (R-253).
 */
export const captureDeviceTimezone = async () => {
  try {
    const timezone = resolveSupportedTz(getDeviceTimezone())
    const userId = await getUserId()
    // Supabase não lança em falha de DB/RLS — retorna { error }. Sem checar,
    // o catch nunca dispara e a falha some (AP-S01/S08).
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: userId, timezone },
      { onConflict: 'user_id' }
    )
    if (error) throw error
  } catch (error) {
    console.error('Erro ao capturar fuso do device:', error)
  }
}

export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'
