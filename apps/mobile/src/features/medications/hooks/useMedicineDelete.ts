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
import { SURFACES } from '@platform/analytics/analyticsEvents'

// 094/CON-038: excluir medicamento ARQUIVA no banco. O banco recusa (DQ941) quando ainda há
// tratamento não arquivado ou etapa por vir de escada viva — mesma regra do precheck abaixo.
export const MEDICINE_IN_USE_CODE = 'DQ941'
export const MEDICINE_IN_USE_MESSAGE =
  'Este medicamento ainda tem tratamento ou evolução em andamento. Exclua o tratamento antes.'

// Escada viva = alguma etapa ligada a tratamento NÃO arquivado (espelha o trigger do banco).
function isLiveTitration(step) {
  const siblings = step?.titration?.titration_steps
  if (!Array.isArray(siblings)) return true // sem a escada carregada: conservador (bloqueia)
  return siblings.some((s) => s?.protocol_id != null && s?.protocol?.archived_at == null)
}

const MEDICINES_CACHE_KEY = '@dosiq/medicines-snapshot'
const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'

/**
 * Cache invalidation matrix (R-236) — useMedicineDelete:
 *
 * confirmDelete só dispara se preCheck.canDelete (hard block contra protocolos
 * e, com controle de estoque ligado, stock > 0). Quando passa o pre-check:
 *   - sem protocols → nada em treatments-snapshot/today-snapshot
 * MAS no modo dose-only (stockTrackingEnabled=false) o estoque deixa de bloquear:
 * o medicamento é arquivado (094) e seus lotes saem das telas vivas. Logo invalida:
 *   - @dosiq/medicines-snapshot
 *   - @dosiq/stock-snapshot
 *
 * Se algum dia o hard block de protocolos virar soft, ESTA matrix muda — adicionar
 * treatments-snapshot e today-snapshot ao Promise.all abaixo.
 */
export function useMedicineDelete(medicine, stockTrackingEnabled = true) {
  const navigation = useNavigation()
  const { show } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const preCheck = useMemo(() => {
    // 094: tratamento arquivado (excluído) nunca bloqueia — é histórico.
    const protocols = (Array.isArray(medicine?.protocols) ? medicine.protocols : [])
      .filter((p) => p?.archived_at == null)
    const stock = Array.isArray(medicine?.stock) ? medicine.stock : []

    const stockUnits = stock.reduce((acc, s) => acc + (Number(s?.quantity) || 0), 0)
    const stockLots = stock.filter((s) => (Number(s?.quantity) || 0) > 0).length

    // 029 F5 (T026 / §7.3): etapa da Evolução do tratamento também é dependência.
    // Uma etapa FUTURA de medicine_switch tem `protocol_id` NULL e pode não ter estoque ainda
    // (o usuário cadastra a escada antes de comprar) — então ela não aparecia nem em `protocols`
    // nem em `stock`, o precheck liberava, e a exclusão morria no FK
    // `titration_steps_medicine_id_fkey` (sem ON DELETE ⇒ RESTRICT) com `23503` cru na cara do
    // usuário. Bloquear ANTES é o §7.3: "nunca beco sem saída" (Constituição IX).
    // (Antes da 094 as `completed` também contavam porque o DELETE apagava a escada; arquivar não apaga.)
    // 094 (C1.5 G5a): etapa já concluída, ou de escada cujo tratamento foi excluído, é histórico —
    // não bloqueia (senão excluir o tratamento deixaria o medicamento num beco sem saída).
    const titrationSteps = (Array.isArray(medicine?.titration_steps) ? medicine.titration_steps : [])
      .filter((s) => s?.status !== 'completed' && isLiveTitration(s))

    // 044 F3: no modo dose-only o estoque é superfície invisível — o sheet de bloqueio
    // esconde o card de estoque, então bloquear por `stockUnits > 0` produzia um beco sem
    // saída (botão desabilitado, "dependências abaixo", lista vazia). O FK
    // `stock_medicine_id_fkey` é ON DELETE CASCADE: apagar o medicamento zera o estoque
    // no banco sem passo extra. Estoque só é dependência quando o controle está ligado.
    const stockBlocks = stockTrackingEnabled && stockUnits > 0

    const hasDependencies = protocols.length > 0 || stockBlocks || titrationSteps.length > 0

    return {
      canDelete: !hasDependencies,
      protocols,
      titrationSteps,
      stockUnits,
      stockLots,
      hasStock: stockUnits > 0,
    }
  }, [medicine, stockTrackingEnabled])

  const confirmDelete = useCallback(async () => {
    if (!medicine?.id) return false
    setIsLoading(true)
    try {
      await medicineService.delete(medicine.id, { surface: SURFACES.MOBILE })
      await AsyncStorage.multiRemove([MEDICINES_CACHE_KEY, STOCK_CACHE_KEY]).catch(() => {})
      successHaptic()
      show('Medicamento removido', { variant: 'success' })
      navigation.goBack()
      return true
    } catch (err) {
      errorHaptic()
      const inUse = err?.code === MEDICINE_IN_USE_CODE || err?.message === 'medicine_in_use'
      show(inUse ? MEDICINE_IN_USE_MESSAGE : (err?.message ?? 'Erro ao remover medicamento'), { variant: 'error' })
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
