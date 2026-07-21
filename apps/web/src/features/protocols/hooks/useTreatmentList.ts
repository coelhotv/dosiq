import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { attachFullLadders } from '@dosiq/core'
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

      // 029 F6: a escada de titulação passou a alimentar o badge/timeline da WEB (decisão do
      // PO 2026-07-17: mobile e web têm que contar a mesma história sobre o mesmo tratamento).
      // Busca separada, e NÃO um embed `titration_steps(...)` no select acima: o embed resolve
      // pela FK `protocol_id`, que só marca o executor vigente — a etapa `current` costuma ficar
      // de fora e o badge diria "Estável" sobre um tratamento em evolução (AP-311). A escada é
      // identificada pela `titration_id`; a derivação é do core, igual à do mobile.
      // R-295: colunas conferidas em `information_schema` 2026-07-21; select executado via curl.
      const { data: steps, error: sErr } = await supabase
        .from('titration_steps')
        .select('id, titration_id, protocol_id, position, dose, intake_unit, duration_days, status, started_at, medicine_id')
        .eq('user_id', userId)
        .order('position', { ascending: true })

      // Best-effort (R-245): sem escada a listagem ainda é útil — degrada para "Estável",
      // não para tela de erro. Mas o erro não some: sem log, o badge mente em silêncio.
      if (sErr) console.error('Escada de titulação indisponível (listagem segue sem ela):', sErr)

      const { protocols: protocolsWithLadders, orphanTitrationIds } = attachFullLadders(
        protocols,
        sErr ? [] : steps
      )
      for (const titrationId of orphanTitrationIds) {
        console.error(
          `Titulação órfã ${titrationId}: nenhuma etapa carrega protocol_id — o tratamento fica sem escada na listagem e o badge pode subestimar a evolução (AP-311)`
        )
      }

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

      const allItems = protocolsWithLadders.map((p) =>
        transformProtocolToItem(p, adherenceMap, stockMap)
      )
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
