import { useState, useCallback } from 'react'
import { updateProfile, updateComplexity, deleteAccount } from '../services/profileService'

/**
 * Hook de mutações de perfil (Fase 4). Encapsula loading/error e delega ao
 * profileService (que adota createProfileRepository de @dosiq/core).
 *
 * Retorno padronizado por ação: { success: boolean, data?, error? } — UI decide
 * toast/navegação. Não faz optimistic update (telas recarregam via useProfile.refresh).
 */
export function useProfileMutation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (fn) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fn()
      if (res.error) {
        setError(res.error)
        return { success: false, error: res.error }
      }
      return { success: true, data: res.data }
    } catch (err) {
      const message = err?.message || 'Erro ao processar pedido.'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  /** Salva dados de perfil (display_name obrigatório). */
  const saveProfile = useCallback((input) => run(() => updateProfile(input)), [run])

  /** Densidade da interface → complexity_override ('simple'|'complex'|null). */
  const setComplexity = useCallback((value) => run(() => updateComplexity(value)), [run])

  /** Exclui a conta (bloqueia se tratamentos ativos). */
  const removeAccount = useCallback(
    () => run(async () => {
      const res = await deleteAccount()
      // deleteAccount retorna { success, error }; normalizar pro shape do run.
      return res.success ? { data: true, error: null } : { data: null, error: res.error }
    }),
    [run],
  )

  return { saveProfile, setComplexity, removeAccount, loading, error }
}
