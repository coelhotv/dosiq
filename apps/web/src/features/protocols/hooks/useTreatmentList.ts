import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { adherenceService } from '@services/api/adherenceService'
import { stockService } from '@shared/services'
import {
  computeGroups,
  transformProtocolToItem
} from './_treatmentListUtils'

export function useTreatmentList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const activeItems = useMemo(() => items.filter((i) => i.tabStatus === 'ativo'), [items])
  const pausedItems = useMemo(() => items.filter((i) => i.tabStatus === 'pausado'), [items])
  const finishedItems = useMemo(() => items.filter((i) => i.tabStatus === 'finalizado'), [items])

  const activeGroups = useMemo(() => computeGroups(activeItems), [activeItems])
  const pausedGroups = useMemo(() => computeGroups(pausedItems), [pausedItems])
  const finishedGroups = useMemo(() => computeGroups(finishedItems), [finishedItems])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = await getUserId()

      const { data: protocols, error: pErr } = await supabase
        .from('protocols')
        .select('*, medicine:medicines(*), treatment_plan:treatment_plans(id, name, emoji, color)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (pErr) throw pErr

      const adherenceList = await adherenceService.calculateAllProtocolsAdherence('7d', userId)
      const adherenceMap = Object.fromEntries(
        (adherenceList || []).map((a) => [a.protocolId, a.score ?? 0])
      )

      const uniqueMedicineIds = [...new Set(protocols.map((p) => p.medicine_id))]
      const stockSummaries = await Promise.all(
        uniqueMedicineIds.map((id) => stockService.getStockSummary(id))
      )
      const stockMap = Object.fromEntries(
        stockSummaries.map((s) => [s.medicine_id, s.total_quantity || 0])
      )

      const allItems = protocols.map((p) => transformProtocolToItem(p, adherenceMap, stockMap))
      setItems(allItems)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      fetchAll()
    })
  }, [fetchAll])


  return {
    items,
    activeItems,
    pausedItems,
    finishedItems,
    activeGroups,
    pausedGroups,
    finishedGroups,
    loading,
    error,
    refetch: fetchAll,
  }
}
