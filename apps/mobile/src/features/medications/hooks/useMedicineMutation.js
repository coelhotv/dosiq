// useMedicineMutation.js — wrappers create/update/delete sobre useMutation
//
// Encapsula:
// - Toast feedback (success/error)
// - Cache invalidation (@dosiq/medicines-snapshot)
// - Navegação opcional pós-sucesso
//
// Uso:
//   const { create, update, remove, isLoading } = useMedicineMutation()
//   create(values, { goBack: true })

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@shared/hooks/useMutation'
import { useToast } from '@shared/components/feedback/Toast'
import { medicineService } from '../services/medicineService'

const MEDICINES_CACHE_KEY = '@dosiq/medicines-snapshot'

export function useMedicineMutation() {
  const navigation = useNavigation()
  const { show } = useToast()

  const mutationCreate = useMutation({
    invalidateKeys: [MEDICINES_CACHE_KEY],
    onSuccess: () => show('Medicamento criado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao criar medicamento', { variant: 'error' }),
  })

  const mutationUpdate = useMutation({
    invalidateKeys: [MEDICINES_CACHE_KEY],
    onSuccess: () => show('Medicamento atualizado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao atualizar medicamento', { variant: 'error' }),
  })

  const mutationDelete = useMutation({
    invalidateKeys: [MEDICINES_CACHE_KEY],
    onSuccess: () => show('Medicamento removido', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao remover medicamento', { variant: 'error' }),
  })

  const create = useCallback(
    async (payload, { goBack = false } = {}) => {
      const result = await mutationCreate.mutate(() => medicineService.create(payload))
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationCreate, navigation]
  )

  const update = useCallback(
    async (id, payload, { goBack = false } = {}) => {
      const result = await mutationUpdate.mutate(() => medicineService.update(id, payload))
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationUpdate, navigation]
  )

  const remove = useCallback(
    async (id, { goBack = false } = {}) => {
      const result = await mutationDelete.mutate(() => medicineService.delete(id))
      if (result !== undefined && goBack) navigation.goBack()
      return result
    },
    [mutationDelete, navigation]
  )

  return {
    create,
    update,
    remove,
    isLoading: mutationCreate.isLoading || mutationUpdate.isLoading || mutationDelete.isLoading,
  }
}
