import { createClient } from '@supabase/supabase-js'

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

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
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

export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'
