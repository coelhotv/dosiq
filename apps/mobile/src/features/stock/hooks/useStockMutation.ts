// useStockMutation.js — wrappers createPurchase/updatePurchase/adjustBalance sobre useMutation
//
// Encapsula:
// - Toast feedback (success/error em PT-BR)
// - Cache invalidation (matrix R-236 — ver bloco por método abaixo)
// - Navegação opcional pós-sucesso (goBack)
//
// Uso:
//   const { createPurchase, updatePurchase, adjustBalance, isLoading } = useStockMutation()
//   createPurchase(input, { goBack: true })
//
// ────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION MATRIX (R-236) — todo mutation deve listar TODOS
// snapshots afetados. Esquecer um cache adjacente = bug latente (D11 Fase 2.5).
// ────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@shared/hooks/useMutation'
import { useToast } from '@shared/components/feedback/Toast'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { stockService } from '../services/stockService'

const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'
const PURCHASES_CACHE_KEY = '@dosiq/purchases-snapshot'
const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'
const TODAY_CACHE_KEY = '@dosiq/today-snapshot'

export function useStockMutation() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const { show } = useToast()
  const { user } = useAuth()

  /**
   * createPurchase — registra compra + atualiza saldo via RPC.
   * Caches invalidados:
   *   - @dosiq/stock-snapshot (saldo, status, listagem hub)
   *   - @dosiq/purchases-snapshot (histórico do medicamento)
   *   - @dosiq/treatments-snapshot (daysRemaining recalculado — cross-domain)
   *   - @dosiq/today-snapshot (dashboard pode mostrar status atualizado)
   */
  const mutationCreate = useMutation({
    invalidateKeys: [
      STOCK_CACHE_KEY,
      PURCHASES_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
    ],
    onSuccess: () => show('Compra registrada', { variant: 'success' }),
    onError: (err: any) => show(err?.message ?? 'Erro ao registrar compra', { variant: 'error' }),
  })

  /**
   * updatePurchase — edita compra existente (quantidade, preço, datas, etc).
   * Caches invalidados:
   *   - @dosiq/stock-snapshot (quantidade editada afeta saldo/status)
   *   - @dosiq/purchases-snapshot (histórico precisa refletir edição)
   *   - @dosiq/treatments-snapshot (daysRemaining recalculado — cross-domain)
   *   - @dosiq/today-snapshot (dashboard pode mostrar status atualizado)
   */
  const mutationUpdate = useMutation({
    invalidateKeys: [
      STOCK_CACHE_KEY,
      PURCHASES_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
    ],
    onSuccess: () => show('Compra atualizada', { variant: 'success' }),
    onError: (err: any) => show(err?.message ?? 'Erro ao atualizar compra', { variant: 'error' }),
  })

  const createPurchase = useCallback(
    async (input, { goBack = false } = {}) => {
      // Guard early: hook pode renderizar com auth ainda carregando.
      // Optional chaining no service call defende contra user null adicional.
      if (!user?.id) throw new Error('Usuário não autenticado')
      const result = await mutationCreate.mutate(() =>
        stockService.createPurchase(input),
      )
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationCreate, navigation, user],
  )

  // 012 B4 (ADR-068/022): compra de líquido com X frascos → X lotes (split via core).
  // Reusa o wrapper de create (mesmos toasts/cache invalidation).
  const createLiquidPurchase = useCallback(
    async (input, { goBack = false } = {}) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const result = await mutationCreate.mutate(() =>
        stockService.createLiquidPurchase(input),
      )
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationCreate, navigation, user],
  )

  const updatePurchase = useCallback(
    async (id, input, { goBack = false } = {}) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const result = await mutationUpdate.mutate(() =>
        stockService.updatePurchase(id, input),
      )
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationUpdate, navigation, user],
  )

  /**
   * adjustBalance — acerta saldo para um valor desejado (PO-6).
   * Caches invalidados:
   *   - @dosiq/stock-snapshot (saldo, status, listagem hub)
   *   - @dosiq/treatments-snapshot (daysRemaining recalculado — cross-domain)
   *   - @dosiq/today-snapshot (dashboard pode mostrar status atualizado)
   *
   * NÃO invalida @dosiq/purchases-snapshot — ajuste de saldo não cria/edita
   * registro de compra; é operação de correção independente do histórico.
   *
   * Não usa wrapper useMutation pois tem fluxo de retorno custom (delta, before, after)
   * e validações internas no service (adjustToBalance calcula delta → increase/decrease).
   */
  const adjustBalance = useCallback(
    async (medicineId, newBalance, reason, notes) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      try {
        const result = await stockService.adjustToBalance(
          medicineId,
          newBalance,
          reason,
          notes,
        )
        // multiRemove = 1 chamada à ponte nativa (vs N concorrentes) — atômico.
        // Log falha em __DEV__ pra diagnóstico (cache stale survives next refresh).
        await AsyncStorage.multiRemove([
          STOCK_CACHE_KEY,
          TREATMENTS_CACHE_KEY,
          TODAY_CACHE_KEY,
        ]).catch((err) => {
          if (__DEV__) console.warn('[useStockMutation] multiRemove failed:', err)
        })
        show('Saldo ajustado', { variant: 'success' })
        return result
      } catch (err) {
        show(err?.message ?? 'Erro ao ajustar saldo', { variant: 'error' })
        throw err
      }
    },
    [show, user],
  )

  return {
    createPurchase,
    createLiquidPurchase,
    updatePurchase,
    adjustBalance,
    isLoading: mutationCreate.isLoading || mutationUpdate.isLoading,
  }
}
