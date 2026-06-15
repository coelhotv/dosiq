import { useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerDose, undoDose, updateOrphanLog, deleteOrphanLog } from '../../dose/services/doseService'

const TODAY_CACHE_KEY = '@dosiq/today-snapshot'

/**
 * Hook para mutações de histórico (registrar retroativo e desfazer).
 * Gerencia loading/error durante operações e invalida cache após sucesso.
 *
 * @param {{onSuccess?: () => void | Promise<void>}} options
 * @returns {{
 *   registerRetro: (logData: any, instanceId: string) => Promise<void>,
 *   undo: (instanceId: string) => Promise<void>,
 *   loading: boolean,
 *   error: string | null
 * }}
 */
export function useHistoryMutation({ onSuccess } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const registerRetro = useCallback(
    async (logData, instanceId) => {
      try {
        setLoading(true)
        setError(null)

        const result = await registerDose(logData, { instanceId })

        if (result.success) {
          // Invalidar cache de snapshot do dia
          await AsyncStorage.removeItem(TODAY_CACHE_KEY)

          if (onSuccess) {
            await onSuccess()
          }
        } else {
          setError(result.error || 'Erro ao registrar dose')
          console.error('[useHistoryMutation] registerRetro failed:', result.error)
        }
      } catch (err) {
        const errorMsg = err?.message || 'Erro ao registrar dose'
        setError(errorMsg)
        console.error('[useHistoryMutation] registerRetro exception:', err)
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const undo = useCallback(
    async (instanceId) => {
      try {
        setLoading(true)
        setError(null)

        const result = await undoDose(instanceId)

        if (result.success) {
          // Invalidar cache de snapshot do dia
          await AsyncStorage.removeItem(TODAY_CACHE_KEY)

          if (onSuccess) {
            await onSuccess()
          }
        } else {
          setError(result.error || 'Erro ao desfazer dose')
          console.error('[useHistoryMutation] undo failed:', result.error)
        }
      } catch (err) {
        const errorMsg = err?.message || 'Erro ao desfazer dose'
        setError(errorMsg)
        console.error('[useHistoryMutation] undo exception:', err)
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const updateLog = useCallback(
    async (logId, logData) => {
      try {
        setLoading(true)
        setError(null)
        // Mutação stock-aware no service (restaura/reconsome estoque FIFO) — não tocar
        // medicine_logs direto, senão o estoque dessincroniza (furos silenciosos).
        const result = await updateOrphanLog(logId, logData)
        if (!result.success) {
          setError(result.error || 'Erro ao atualizar registro')
          console.error('[useHistoryMutation] updateLog failed:', result.error)
          return
        }
        await AsyncStorage.removeItem(TODAY_CACHE_KEY)
        if (onSuccess) await onSuccess()
      } catch (err) {
        const errorMsg = err?.message || 'Erro ao atualizar registro'
        setError(errorMsg)
        console.error('[useHistoryMutation] updateLog exception:', err)
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const deleteLog = useCallback(
    async (logId) => {
      try {
        setLoading(true)
        setError(null)
        // Mutação stock-aware no service (devolve estoque ao inventário antes de deletar).
        const result = await deleteOrphanLog(logId)
        if (!result.success) {
          setError(result.error || 'Erro ao excluir registro')
          console.error('[useHistoryMutation] deleteLog failed:', result.error)
          return
        }
        await AsyncStorage.removeItem(TODAY_CACHE_KEY)
        if (onSuccess) await onSuccess()
      } catch (err) {
        const errorMsg = err?.message || 'Erro ao excluir registro'
        setError(errorMsg)
        console.error('[useHistoryMutation] deleteLog exception:', err)
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  return {
    registerRetro,
    undo,
    updateLog,
    deleteLog,
    loading,
    error,
  }
}
