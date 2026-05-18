// useProtocolDelete.js — delete de Protocol (Fase 2 T2.10).
// Sem hard block (spec §3.7 — warning soft via ProtocolDeleteSheet com stats
// informativos do useProtocolStats). Aqui só o delete + cache invalidation
// + toast + haptic + navegação.

import { useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '@shared/components/feedback/Toast'
import { successHaptic, errorHaptic } from '@shared/utils/haptics'
import { protocolService } from '../services/protocolService'

const PROTOCOLS_CACHE_KEY = '@dosiq/protocols-snapshot'

export function useProtocolDelete(protocol) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const { show } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // Handlers
  const confirmDelete = useCallback(async () => {
    if (!protocol?.id) return false
    setIsLoading(true)
    try {
      await protocolService.delete(protocol.id)
      await AsyncStorage.removeItem(PROTOCOLS_CACHE_KEY).catch(() => {})
      successHaptic()
      show('Tratamento excluído', { variant: 'success' })
      navigation.goBack()
      return true
    } catch (err) {
      errorHaptic()
      show(err?.message ?? 'Erro ao excluir tratamento', { variant: 'error' })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [protocol, navigation, show])

  return {
    confirmDelete,
    isLoading,
  }
}
