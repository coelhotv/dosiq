// useMedicineDelete.js — pre-check de dependências + delete
//
// v1: usa `protocols` (tratamentos) já carregados no medicine via getById.
// Bloqueia delete se houver tratamentos ativos. Estoque/logs históricos
// não são verificados no v1.
//
// Implementação direta (sem useMedicineMutation) p/ poder garantir navegação
// pós-sucesso real (delete não retorna value — wrapper genérico não distingue
// sucesso de falha pelo retorno).

import { useState, useMemo, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '@shared/components/feedback/Toast'
import { successHaptic, errorHaptic } from '@shared/utils/haptics'
import { medicineService } from '../services/medicineService'

const MEDICINES_CACHE_KEY = '@dosiq/medicines-snapshot'

export function useMedicineDelete(medicine) {
  const navigation = useNavigation()
  const { show } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const preCheck = useMemo(() => {
    const protocols = Array.isArray(medicine?.protocols) ? medicine.protocols : []
    const stock = Array.isArray(medicine?.stock) ? medicine.stock : []

    const stockUnits = stock.reduce((acc, s) => acc + (Number(s?.quantity) || 0), 0)
    const stockLots = stock.filter((s) => (Number(s?.quantity) || 0) > 0).length

    // Bloqueio hard: QUALQUER dependência (protocolo ativo/pausado OU estoque > 0).
    // Apagar medicamento com dependências deixaria órfãos no banco e na UX.
    const hasDependencies = protocols.length > 0 || stockUnits > 0

    return {
      canDelete: !hasDependencies,
      protocols,
      stockUnits,
      stockLots,
      hasStock: stockUnits > 0,
    }
  }, [medicine])

  const confirmDelete = useCallback(async () => {
    if (!medicine?.id) return false
    setIsLoading(true)
    try {
      await medicineService.delete(medicine.id)
      await AsyncStorage.removeItem(MEDICINES_CACHE_KEY).catch(() => {})
      successHaptic()
      show('Medicamento removido', { variant: 'success' })
      navigation.goBack()
      return true
    } catch (err) {
      errorHaptic()
      show(err?.message ?? 'Erro ao remover medicamento', { variant: 'error' })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [medicine, navigation, show])

  return {
    preCheck,
    confirmDelete,
    isLoading,
  }
}
