// useProtocolMutation.js — wrappers create/update/toggleActive sobre useMutation
//
// Encapsula:
// - Toast feedback (success/error)
// - Cache invalidation (matrix R-236 — ver bloco por método abaixo)
// - Navegação opcional pós-sucesso
//
// Uso:
//   const { create, update, toggleActive, isLoading } = useProtocolMutation()
//   create(values, { goBack: true })
//
// ────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION MATRIX (R-236) — todo mutation deve listar TODOS
// snapshots afetados. Esquecer um cache adjacente = bug latente (D11 Fase 2.5).
// ────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react'
import { getNextOccurrence, describeNextOccurrence } from '@dosiq/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from '@shared/hooks/useMutation'
import { SURFACES, ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { useToast } from '@shared/components/feedback/Toast'
import { triggerAlarmResync } from '@platform/alarms/alarmResyncBus'
import { protocolService } from '../services/protocolService'

const PROTOCOLS_CACHE_KEY = '@dosiq/protocols-snapshot'
const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'
const TODAY_CACHE_KEY = '@dosiq/today-snapshot'
const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'

// 085 (FR-008a): retomar diz QUANDO é a próxima dose. Em dias alternados a âncora é o início do
// tratamento (D-1), então retomar num dia sem dose deixaria o app calado — a cópia paga esse custo.
function resumeMessage(protocol) {
  const next = getNextOccurrence(protocol)
  return next ? `Tratamento ativo · próxima dose ${describeNextOccurrence(next)}` : 'Tratamento ativo'
}

export function useProtocolMutation() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const { show } = useToast()

  /**
   * create — cria tratamento (protocol) novo.
   * Caches invalidados:
   *   - @dosiq/protocols-snapshot (detail/useProtocol)
   *   - @dosiq/treatments-snapshot (listagem/useTreatments — contagem +
   *     grouping precisam refletir o novo item)
   *   - @dosiq/today-snapshot (dashboard pode mostrar nova dose hoje)
   *   - @dosiq/stock-snapshot (consumo diário aumenta → daysRemaining recalcula)
   */
  const mutationCreate = useMutation({
    invalidateKeys: [
      PROTOCOLS_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
      STOCK_CACHE_KEY,
    ],
    onSuccess: () => {
      show('Tratamento criado', { variant: 'success' })
      triggerAlarmResync() // FR-006: reagenda alarmes c/ a nova agenda
    },
    onError: (err: any) => show(err?.message ?? 'Erro ao criar tratamento', { variant: 'error' }),
  })

  /**
   * update — edita tratamento (dose, horários, período, etc).
   * Caches invalidados:
   *   - @dosiq/protocols-snapshot
   *   - @dosiq/treatments-snapshot (listagem mostra dose/freq)
   *   - @dosiq/today-snapshot (horários podem ter mudado)
   *   - @dosiq/stock-snapshot (mudança em dosage_per_intake ou time_schedule
   *     altera consumo diário → daysRemaining recalcula)
   */
  const mutationUpdate = useMutation({
    invalidateKeys: [
      PROTOCOLS_CACHE_KEY,
      TREATMENTS_CACHE_KEY,
      TODAY_CACHE_KEY,
      STOCK_CACHE_KEY,
    ],
    onSuccess: () => {
      show('Tratamento atualizado', { variant: 'success' })
      triggerAlarmResync() // FR-006: horários/dose podem ter mudado
    },
    onError: (err: any) => show(err?.message ?? 'Erro ao atualizar tratamento', { variant: 'error' }),
  })

  const create = useCallback(
    async (payload, { goBack = false } = {}) => {
      const result = await mutationCreate.mutate(() =>
        protocolService.create(payload, { surface: SURFACES.MOBILE, entryPoint: ENTRY_POINTS.TREATMENT_FORM })
      )
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationCreate, navigation]
  )

  const update = useCallback(
    async (id, payload, { goBack = false, previous = null } = {}) => {
      const result = await mutationUpdate.mutate(() =>
        protocolService.update(id, payload, { surface: SURFACES.MOBILE, previous })
      )
      if (result && goBack) navigation.goBack()
      return result
    },
    [mutationUpdate, navigation]
  )

  /**
   * toggleActive — alterna flag `active` do tratamento (pausar/retomar).
   * Caches invalidados:
   *   - @dosiq/protocols-snapshot (detail)
   *   - @dosiq/treatments-snapshot (listagem — tab Ativos↔Pausados)
   *   - @dosiq/today-snapshot (pause = some da agenda do dia)
   *   - @dosiq/stock-snapshot (pause = consumo daily cai → daysRemaining sobe)
   *
   * Não usa wrapper useMutation pq toggleActive é direto (sem optimistic
   * via useMutation; UI faz override local em ProtocolDetailScreen).
   */
  const toggleActive = useCallback(
    async (id, nextValue) => {
      try {
        const result = await protocolService.update(id, { active: nextValue }, { surface: SURFACES.MOBILE })
        // multiRemove = 1 chamada à ponte nativa (vs N concorrentes) — atômico.
        await AsyncStorage.multiRemove([
          PROTOCOLS_CACHE_KEY,
          TREATMENTS_CACHE_KEY,
          TODAY_CACHE_KEY,
          STOCK_CACHE_KEY,
        ]).catch(() => {})
        triggerAlarmResync() // FR-006: pausar/retomar muda os alarmes futuros
        show(nextValue ? resumeMessage(result) : 'Tratamento pausado', { variant: 'success' })
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
