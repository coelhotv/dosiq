// useMedicineMutation.js — wrappers create/update/delete sobre useMutation
//
// Encapsula:
// - Toast feedback (success/error)
// - Cache invalidation (matrix R-236 — ver bloco por método abaixo)
// - Navegação opcional pós-sucesso
//
// Uso:
//   const { create, update, remove, isLoading } = useMedicineMutation()
//   create(values, { goBack: true })
//
// ────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION MATRIX (R-236) — todo mutation deve listar TODOS
// snapshots afetados. Esquecer um cache adjacente = bug latente (D11 Fase 2.5).
// ────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@shared/hooks/useMutation'
import { useToast } from '@shared/components/feedback/Toast'
import { medicineService } from '../services/medicineService'

const MEDICINES_CACHE_KEY = '@dosiq/medicines-snapshot'
const PROTOCOLS_CACHE_KEY = '@dosiq/protocols-snapshot'
const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'
const TODAY_CACHE_KEY = '@dosiq/today-snapshot'
const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'

export function useMedicineMutation() {
  const navigation = useNavigation()
  const { show } = useToast()

  /**
   * create — cria medicamento novo.
   * Caches invalidados:
   *   - @dosiq/medicines-snapshot (listagem de medicamentos)
   * Caches NÃO invalidados (intencionalmente):
   *   - protocols/treatments/today/stock (novo medicamento sem treatment
   *     ativo e sem stock não aparece em nenhum dos derivados)
   */
  const mutationCreate = useMutation({
    invalidateKeys: [MEDICINES_CACHE_KEY],
    onSuccess: () => show('Medicamento criado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao criar medicamento', { variant: 'error' }),
  })

  /**
   * update — edita medicamento (nome, dose, etc).
   * Caches invalidados:
   *   - @dosiq/medicines-snapshot (listagem)
   *   - @dosiq/protocols-snapshot (detail mostra medicine joinado)
   *   - @dosiq/treatments-snapshot (listagem mostra nome do medicine)
   *   - @dosiq/today-snapshot (dashboard mostra nome em doses do dia)
   *   - @dosiq/stock-snapshot (entries de stock mostram nome do medicine)
   * Caches NÃO invalidados (intencionalmente): nenhum aplicável.
   */
  const mutationUpdate = useMutation({
    invalidateKeys: [
      MEDICINES_CACHE_KEY,
      PROTOCOLS_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
      STOCK_CACHE_KEY,
    ],
    onSuccess: () => show('Medicamento atualizado', { variant: 'success' }),
    onError: (err) => show(err?.message ?? 'Erro ao atualizar medicamento', { variant: 'error' }),
  })

  /**
   * remove — wrapper genérico de delete (sem pre-check). Pra fluxo com hard
   * block contra dependências, use `useMedicineDelete` (preCheck + delete).
   * Caches invalidados (defensivos — se chamado sem pre-check, deps órfãs):
   *   - @dosiq/medicines-snapshot
   *   - @dosiq/protocols-snapshot
   *   - @dosiq/treatments-snapshot
   *   - @dosiq/today-snapshot
   *   - @dosiq/stock-snapshot
   */
  const mutationDelete = useMutation({
    invalidateKeys: [
      MEDICINES_CACHE_KEY,
      PROTOCOLS_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
      STOCK_CACHE_KEY,
    ],
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
