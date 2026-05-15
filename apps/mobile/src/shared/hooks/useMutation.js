import { useCallback, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { successHaptic, errorHaptic } from '@shared/utils/haptics'

// Hook para mutations C/U/D (create/update/delete) com:
// - guard contra double-submit
// - timeout configurável (R-168 Hermes safety)
// - haptic feedback automático (TODO: extrair p/ utils/haptics.js na P3.3)
// - invalidação de snapshots AsyncStorage para forçar re-fetch
//
// Uso:
//   const { mutate, isLoading, error, reset } = useMutation({
//     onSuccess: (data) => navigation.goBack(),
//     onError: (err) => Alert.alert('Erro', err.message),
//     invalidateKeys: ['@dosiq/treatments-snapshot'],
//   })
//   const handleSubmit = () => mutate(() => medicineService.create(values))

const DEFAULT_TIMEOUT_MS = 15_000

// Promise que rejeita após N ms (Hermes-safe; sem AbortController em fn arbitrária)
function withTimeout(promise, ms) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Timeout: operação excedeu ${ms / 1000}s`)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

export function useMutation({
  onSuccess,
  onError,
  invalidateKeys = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  // Ref para guard de double-submit (sincrono, antes do re-render de isLoading)
  const inFlightRef = useRef(false)

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const mutate = useCallback(
    async (asyncFn) => {
      if (inFlightRef.current) return undefined
      inFlightRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const result = await withTimeout(
          Promise.resolve().then(() => asyncFn()),
          timeoutMs,
        )

        // Invalida snapshots locais (best-effort — falha aqui não derruba a operação)
        if (invalidateKeys.length > 0) {
          try {
            await AsyncStorage.multiRemove(invalidateKeys)
          } catch (cacheErr) {
            // Falha em cache não invalida sucesso da mutation
            console.warn('[useMutation] invalidateKeys falhou:', cacheErr?.message)
          }
        }

        successHaptic()

        setIsLoading(false)
        inFlightRef.current = false
        onSuccess?.(result)
        return result
      } catch (err) {
        errorHaptic()
        setError(err)
        setIsLoading(false)
        inFlightRef.current = false
        onError?.(err)
        return undefined
      }
    },
    [onSuccess, onError, invalidateKeys, timeoutMs],
  )

  return { mutate, isLoading, error, reset }
}

export default useMutation
