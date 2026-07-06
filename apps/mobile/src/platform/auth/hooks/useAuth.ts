import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/nativeSupabaseClient'

/**
 * Hook para acessar autenticação e dados do usuário (H6)
 * Retorna: { supabase, user, session, loading, error }
 */
export function useAuth() {
  const [state, setState] = useState({
    supabase,
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function loadAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) throw error

        setState(prev => ({
          ...prev,
          session: session ?? null,
          user: session?.user ?? null,
          loading: false,
          error: null,
        }))
      } catch (err) {
        if (__DEV__) console.error('[useAuth] erro ao carregar autenticação:', err)
        setState(prev => ({
          ...prev,
          loading: false,
          error: err.message,
        }))
      }
    }

    loadAuth()

    // Inscrever-se a mudanças de autenticação (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState(prev => ({
        ...prev,
        session: session ?? null,
        user: session?.user ?? null,
      }))
    })

    return () => subscription?.unsubscribe()
  }, [])

  return state
}
