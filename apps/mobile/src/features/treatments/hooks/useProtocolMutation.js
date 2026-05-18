// useProtocolMutation.js — wrappers create/update sobre useMutation
//
// Encapsula:
// - Toast feedback (success/error)
// - Cache invalidation (@dosiq/protocols-snapshot)
// - Navegação opcional pós-sucesso
//
// Uso:
//   const { create, update, isLoading } = useProtocolMutation()
//   create(values, { goBack: true })

import { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@shared/hooks/useMutation'
import { useToast } from '@shared/components/feedback/Toast'
import { protocolService } from '../services/protocolService'

const PROTOCOLS_CACHE_KEY = '@dosiq/protocols-snapshot'
// useTreatments (listagem) usa cache key próprio — toggleActive precisa
// invalidar AMBOS pra que a listagem reflita a mudança de tab (Ativos↔Pausados)
// mesmo se a rede falhar no refresh seguinte.
const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'

export function useProtocolMutation() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const { show } = useToast()

  const mutationCreate = useMutation({
    invalidateKeys: [PROTOCOLS_CACHE_KEY],
    onSuccess: () => show('Tratamento criado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao criar tratamento', { variant: 'error' }),
  })

  const mutationUpdate = useMutation({
    invalidateKeys: [PROTOCOLS_CACHE_KEY],
    onSuccess: () => show('Tratamento atualizado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao atualizar tratamento', { variant: 'error' }),
  })

  const create = useCallback(
    async (payload, { goBack = false } = {}) => {
      const result = await mutationCreate.mutate(() => protocolService.create(payload))
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationCreate, navigation]
  )

  const update = useCallback(
    async (id, payload, { goBack = false } = {}) => {
      const result = await mutationUpdate.mutate(() => protocolService.update(id, payload))
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationUpdate, navigation]
  )

  const toggleActive = useCallback(
    async (id, nextValue) => {
      try {
        const result = await protocolService.update(id, { active: nextValue })
        // Invalida AMBOS snapshots locais (best-effort): protocols-snapshot
        // (detail/useProtocol) + treatments-snapshot (listagem/useTreatments).
        // Sem este 2º removeItem, a listagem serviria cache stale com o item
        // ainda na tab antiga caso o refresh on focus falhe.
        await Promise.all([
          AsyncStorage.removeItem(PROTOCOLS_CACHE_KEY),
          AsyncStorage.removeItem(TREATMENTS_CACHE_KEY),
        ]).catch(() => {})
        show(nextValue ? 'Tratamento ativo' : 'Tratamento pausado', { variant: 'success' })
        return result
      } catch (err) {
        show(err?.message ?? 'Erro ao alterar status do tratamento', { variant: 'error' })
        throw err
      }
    },
    [show]
  )

  return {
    create,
    update,
    toggleActive,
    isLoading: mutationCreate.isLoading || mutationUpdate.isLoading,
    error: mutationCreate.error ?? mutationUpdate.error ?? null,
  }
}
