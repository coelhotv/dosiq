// useMedicineSearchFlow — miolo da busca 2C (spec 066 Slice C): passo 1 = nome na base ANVISA; ao tocar
// um nome com mais de uma concentração na CMED, passo 2 = `CmedPresentationStep`. Uma escolha só pula o
// passo 2. Sem índice (offline, falha, versão) ou nome sem embalagem: devolve só o item (INV-3).
//
// Extraído do `MedicineAnvisaSheet` na Slice E: o sheet (cadastro completo) e a tela de busca do
// onboarding usam o MESMO fluxo, cada um com o seu layout (reuso obrigatório, nunca cópia).
// O índice só carrega DEPOIS do 1º toque num nome (C-C5: carregar ao abrir travava a digitação no
// LG K8) e sai da memória quando `active` desliga (FR-023).
// onSelect recebe { anvisaItem, cmedDraft? }. Eventos: TRACKING_PLAN §5.3 (sem nome/texto, R-042).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  rowsForAnvisaItem,
  groupByConcentration,
  countConcentrationChoices,
  medicineDraftFromRow,
  type CmedIndex,
  type CmedMedicineDraft,
  type PickerConcentration,
} from '@dosiq/core'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import { useCmedIndex } from '@shared/hooks/useCmedIndex'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { selectionTap } from '@shared/utils/haptics'

export interface AnvisaSheetSelection {
  anvisaItem: any
  cmedDraft?: CmedMedicineDraft
}

type PresentationOutcome = 'single' | 'picked' | 'not_listed' | 'back' | 'unavailable'

function optionsForItem(index: CmedIndex | null, item: any): PickerConcentration[] {
  if (!index || !item) return []
  const rows = rowsForAnvisaItem(index, item)
  return rows.length > 0 ? groupByConcentration(index, rows) : []
}

// Única escolha possível (1 concentração sem 2º nível de laboratório) ⇒ a linha dela.
function singleChoiceRow(options: PickerConcentration[]): number | undefined {
  return countConcentrationChoices(options) === 1 ? options[0].rowIdx : undefined
}

interface SearchFlowOptions {
  /** Busca visível (sheet aberto / tela montada). Desligar solta o índice da memória (FR-023). */
  active: boolean
  onSelect?: (selection: AnvisaSheetSelection) => void
}

export function useMedicineSearchFlow({ active, onSelect }: SearchFlowOptions) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<any>(null)
  const [needIndex, setNeedIndex] = useState(false)
  // Toque duplo num resultado (C-C9, LG): o 2º toque chega antes do re-render e duplicava a escolha.
  const selectingRef = useRef(false)
  const { search, isReady } = useMedicineDatabase()
  const cmed = useCmedIndex({
    enabled: active && needIndex,
    onLoaded: (info) =>
      logEvent(EVENTS.MEDICINE_INDEX_LOADED, {
        surface: SURFACES.MOBILE,
        source: info.source,
        duration_ms: info.durationMs,
        status: info.status,
        row_count: info.rowCount,
      }),
  })

  // Memos
  const pickedOptions = useMemo(() => optionsForItem(cmed.index, picked), [cmed.index, picked])

  const trimmed = query.trim()
  const results = useMemo(() => {
    if (!isReady || trimmed.length < 2) return []
    return search(trimmed, 40)
  }, [search, trimmed, isReady])

  const hint = useMemo(() => {
    if (trimmed.length < 2) return 'Digite ao menos 2 caracteres'
    if (results.length === 0) return 'Nenhum resultado'
    return results.length === 1 ? '1 resultado' : `${results.length} resultados`
  }, [trimmed, results.length])

  // Effects
  // Nome tocado antes do índice ficar pronto: decide quando ele chega.
  useEffect(() => {
    if (!picked || cmed.status === 'idle' || cmed.status === 'preparing') return
    if (cmed.status !== 'ready' || pickedOptions.length === 0) finish(picked, 'unavailable')
    else {
      const single = singleChoiceRow(pickedOptions)
      if (single !== undefined) finish(picked, 'single', single)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, cmed.status, pickedOptions])

  // Handlers
  function finish(item, outcome: PresentationOutcome, rowIdx?: number) {
    const row = rowIdx !== undefined ? cmed.index?.rows[rowIdx] : undefined
    if (outcome === 'unavailable' && cmed.status === 'ready') {
      // SSOT CMED (2026-10-12): nome sem embalagem não deveria existir — rastro p/ investigar.
      console.warn('[useMedicineSearchFlow] item sem embalagem CMED:', item?.name)
    }
    const draft = row ? medicineDraftFromRow(row) : undefined
    logEvent(EVENTS.MEDICINE_PRESENTATION_SELECTED, {
      surface: SURFACES.MOBILE,
      outcome,
      presentation_count: countConcentrationChoices(optionsForItem(cmed.index, item)),
      dose_ambiguous: draft?.doseAmbiguous ?? false,
    })
    onSelect?.(draft ? { anvisaItem: item, cmedDraft: draft } : { anvisaItem: item })
    selectingRef.current = false
    setPicked(null)
    setQuery('')
  }

  // Volta ao estado inicial (fechar o sheet / sair da tela): solta o índice.
  function reset() {
    setQuery('')
    selectingRef.current = false
    setPicked(null)
    setNeedIndex(false)
  }

  // "‹" e voltar do Android no passo 2: volta ao passo 1 (C-C9).
  function handleBack() {
    logEvent(EVENTS.MEDICINE_PRESENTATION_SELECTED, {
      surface: SURFACES.MOBILE,
      outcome: 'back',
      presentation_count: countConcentrationChoices(pickedOptions),
      dose_ambiguous: false,
    })
    selectingRef.current = false
    setPicked(null)
  }

  function handleSelect(item, index: number) {
    if (selectingRef.current) return
    selectingRef.current = true
    selectionTap()
    logEvent(EVENTS.MEDICINE_SEARCH_RESULT_SELECTED, {
      surface: SURFACES.MOBILE,
      result_rank: index + 1,
      query_length: trimmed.length,
      item_kind: item.laboratory ? 'brand' : 'substance',
    })
    setNeedIndex(true)
    if (cmed.status === 'ready') {
      const options = optionsForItem(cmed.index, item)
      if (options.length === 0) return finish(item, 'unavailable')
      const single = singleChoiceRow(options)
      if (single !== undefined) return finish(item, 'single', single)
    }
    setPicked(item)
  }

  // Props do passo 2 prontos para o `CmedPresentationStep`.
  // `presentationKey` remonta o passo quando o índice chega: o atalho "concentração única ⇒
  // laboratório" é do 1º render.
  const presentationKey = cmed.status === 'ready' ? 'ready' : 'preparing'
  const presentationStep = picked
    ? {
        title: picked.name,
        options: pickedOptions,
        preparing: cmed.status === 'idle' || cmed.status === 'preparing',
        onPick: (rowIdx: number) => finish(picked, 'picked', rowIdx),
        onSkip: () => finish(picked, 'not_listed'),
        onBack: handleBack,
      }
    : null

  return { query, setQuery, trimmed, results, hint, picked, presentationStep, presentationKey, handleSelect, handleBack, reset }
}
