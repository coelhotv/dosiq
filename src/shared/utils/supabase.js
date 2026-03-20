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

// Cache de userId em memória — evita 13+ roundtrips auth/user no primeiro load
let _cachedUserId = null
let _userIdPromise = null // Coalescência: múltiplas chamadas simultâneas compartilham a mesma promise

export const getUserId = async () => {
  if (_cachedUserId) return _cachedUserId

  // Coalescência: se já há uma chamada em voo, reutiliza a mesma promise
  if (_userIdPromise) return _userIdPromise

  _userIdPromise = supabase.auth.getUser().then(({ data: { user } }) => {
    _userIdPromise = null
    if (!user) throw new Error('Usuário não autenticado')
    _cachedUserId = user.id
    return user.id
  }).catch((err) => {
    _userIdPromise = null
    throw err
  })

  return _userIdPromise
}

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Invalida cache ao mudar estado de autenticação
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    _cachedUserId = null
    _userIdPromise = null
  } else if (event === 'SIGNED_IN') {
    // Força re-fetch no próximo getUserId (novo usuário pode ter ID diferente)
    _cachedUserId = null
    _userIdPromise = null
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
