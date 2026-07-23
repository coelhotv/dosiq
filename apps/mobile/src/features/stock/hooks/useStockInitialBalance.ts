// useStockInitialBalance — máquina de estados da tela "Estoque inicial" (spec 044, F4b / T017).
//
// PO-3 — sem retro-consumo: este hook NUNCA lê/escreve medicine_logs ou dose_instances. A
// ÚNICA escrita é `activateStockWithInitialBalance` (stockPreferenceService), que grava os
// saldos e liga a preferência atomicamente (saldos primeiro, preferência depois).
//
// SEMÂNTICA (AP-285):
//   - Pular = não incluir o item no array `entries` (não existe flag "skipped" persistida).
//   - Campo vazio = pulado; zero DIGITADO explicitamente é saldo real (envia 0).
//   - Digitar/pular NÃO escreve nada — só "Ativar estoque" chama o serviço.
//   - "Cancelar"/voltar chamam `onDone` diretamente, sem tocar no serviço.
//
// AP-171: vírgula decimal PT-BR — normaliza `,`→`.` antes de Number(); nunca toLocaleString.
// R-010: States → Memos → Effects → Handlers.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatConcentration,
  formatActiveIngredientShort,
  formatStockDoses,
  stockUnitLabel,
} from '@dosiq/core'
import { stockService } from '../services/stockService'
import {
  activateStockWithInitialBalance,
  type StockPreferenceSource,
} from '@profile/services/stockPreferenceService'
import { useStockTracking } from '@shared/hooks/useStockTracking'

export interface StockInitialBalanceMedicine {
  id: string
  name: string
  /** Pill de dosagem já formatada (ex.: "50 mg") — null se o medicamento não tiver dosagem. */
  dosePill: string | null
  /**
   * Unidade em que o SALDO é contado — a MESMA que o cadastro de compra pede
   * (`PurchaseFormScreen`: líquido → frascos × volume, persistido em **ml**; sólido → unidades).
   *
   * ⚠️ NÃO é o `dosage_unit` do medicamento: `mg/ml` é CONCENTRAÇÃO (quanto de ativo cabe em 1 ml),
   * não unidade de estoque. Derivar por `stockUnitLabel` (core) é o que impede a tela de pedir
   * "un." para um Ozempic cujo saldo vive em ml — pedir a quantidade numa unidade e gravá-la em
   * outra corrompe o FIFO silenciosamente.
   */
  stockUnit: 'mL' | 'un.'
  /** Medicamento cru — insumo dos formatadores do core (não formatar aqui). */
  raw: {
    dosage_unit?: string | null
    dosage_per_pill?: number | string | null
    units_per_ml?: number | string | null
    concentration_volume_ml?: number | string | null
    presentation?: string | null
  }
  /** Protocolo ATIVO (dose por tomada) — sem ele não há como contar doses. */
  protocol: { dosage_per_intake?: number | string | null; intake_unit?: string | null } | null
}

interface ItemState {
  /** Texto bruto digitado, PT-BR (vírgula) — '' = nada digitado. */
  value: string
  skipped: boolean
}

const EMPTY_ITEM: ItemState = { value: '', skipped: false }

/**
 * Hint sob o input. A pergunta que ele responde é "quanto tempo de tratamento eu tenho na mão?"
 * — e a resposta útil é a contagem de DOSES, não a de princípio ativo.
 *
 * Por que mudou (smoke do PO): o hint de ativo era REDUNDANTE no líquido (repetia a concentração
 * já exibida no pill ao lado do nome — Mounjaro mostrava "2,5 mg / 0,5 mL" nos dois lugares) e
 * pouco acionável no sólido ("15.000 mg" não diz nada a ninguém).
 *
 * Injetável conta "aplicações"; o resto conta "doses". Sempre FLOOR: meia dose não é dose
 * disponível.
 *
 * Fallback: sem protocolo ativo (ou sem dose por tomada) não há como contar doses — aí o sólido
 * cai no hint de princípio ativo, que é melhor que nada. Líquido sem protocolo fica sem hint: o
 * pill ao lado do nome já diz a concentração, e repetir seria o problema que estamos corrigindo.
 */
export function balanceHint(
  medicine: StockInitialBalanceMedicine,
  rawValue: string,
): string {
  if (!rawValue) return ''

  const doses = formatStockDoses(rawValue.replace(',', '.'), medicine.raw, medicine.protocol)
  if (doses) return `Equivale a ${doses.replace('≈ ', '')}`

  if (medicine.stockUnit === 'mL') return ''
  const short = formatActiveIngredientShort(
    rawValue.replace(',', '.'),
    medicine.raw.dosage_per_pill,
    medicine.raw.dosage_unit,
  )
  return short ? `Equivale a ${short} no total` : ''
}

// Mantém no MÁXIMO uma vírgula, para QUALQUER número de vírgulas (digitadas ou coladas).
// O regex anterior (`/(,.*),/g`) só removia UMA: com 4+ vírgulas ("1,2,3,4") sobrava a
// segunda ("1,2,34"), e `Number('1,2,34'.replace(',','.'))` é NaN — o saldo do item sumia
// de `entries` sem erro visível, e o medicamento entrava no FIFO sem o saldo que o usuário
// digitou. Descartar a vírgula excedente (e não os dígitos) é o comportamento de campo
// decimal: digitar "1,2," e depois "3" resulta em "1,23".
function sanitizeDecimal(raw: string): string {
  const clean = String(raw ?? '')
    .replace('.', ',')
    .replace(/[^0-9,]/g, '')
  const [head, ...rest] = clean.split(',')
  return rest.length > 0 ? `${head},${rest.join('')}` : clean
}

export interface UseStockInitialBalance {
  medicines: StockInitialBalanceMedicine[] | null
  getItem: (medicineId: string) => ItemState
  loading: boolean
  loadError: string | null
  submitting: boolean
  submitError: string | null
  setValue: (medicineId: string, raw: string) => void
  skip: (medicineId: string) => void
  unskip: (medicineId: string) => void
  activate: () => Promise<void>
  cancel: () => void
  reload: () => Promise<void>
}

export function useStockInitialBalance(
  source: StockPreferenceSource,
  onDone: () => void,
): UseStockInitialBalance {
  // States
  const { refresh } = useStockTracking()
  const [medicines, setMedicines] = useState<StockInitialBalanceMedicine[] | null>(null)
  const [items, setItems] = useState<Record<string, ItemState>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Memos
  const entries = useMemo(() => {
    return Object.entries(items)
      .filter(([, item]) => !item.skipped && item.value !== '')
      .map(([medicineId, item]) => ({
        medicineId,
        quantity: Number(item.value.replace(',', '.')),
      }))
      .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity >= 0)
  }, [items])

  // Effects
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const raw = await stockService.getMedicinesWithStockOrActiveProtocol()
      const list: StockInitialBalanceMedicine[] = (raw || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        dosePill:
          formatConcentration(m.dosage_per_pill, m.dosage_unit, m.concentration_volume_ml) || null,
        // A unidade do saldo vem do medicamento, nunca de um literal: é o que mantém esta tela
        // falando a MESMA língua do cadastro de compra (ml para líquido, un. para sólido).
        stockUnit: stockUnitLabel(m),
        raw: {
          dosage_unit: m.dosage_unit ?? null,
          dosage_per_pill: m.dosage_per_pill ?? null,
          units_per_ml: m.units_per_ml ?? null,
          concentration_volume_ml: m.concentration_volume_ml ?? null,
          presentation: m.presentation ?? null,
        },
        // Protocolo ATIVO: é ele que dá a dose por tomada — sem isso não há como contar doses.
        // O repositório já filtra o medicamento por protocolo ativo, mas a LISTA vem inteira
        // (inclui protocolos encerrados), então o ativo tem que ser escolhido aqui.
        protocol: (m.protocols || []).find((p: any) => p?.active) ?? null,
      }))
      setMedicines(list)
    } catch (err) {
      setLoadError((err as Error)?.message ?? 'Não foi possível carregar seus medicamentos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Handlers
  const getItem = useCallback((medicineId: string) => items[medicineId] ?? EMPTY_ITEM, [items])

  const setValue = useCallback((medicineId: string, raw: string) => {
    setItems((prev) => ({ ...prev, [medicineId]: { value: sanitizeDecimal(raw), skipped: false } }))
  }, [])

  const skip = useCallback((medicineId: string) => {
    setItems((prev) => ({ ...prev, [medicineId]: { value: '', skipped: true } }))
  }, [])

  const unskip = useCallback((medicineId: string) => {
    setItems((prev) => ({ ...prev, [medicineId]: { value: '', skipped: false } }))
  }, [])

  const activate = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await activateStockWithInitialBalance(entries, source)
      await refresh() // AP-281 — sem isso a UI contradiz a escolha até o reload
      onDone()
    } catch (err) {
      setSubmitError((err as Error)?.message ?? 'Não foi possível ativar o controle de estoque')
    } finally {
      setSubmitting(false)
    }
  }, [entries, source, refresh, onDone])

  const cancel = useCallback(() => {
    // AP-285: cancelar/voltar NUNCA escreve — só chama onDone.
    onDone()
  }, [onDone])

  return {
    medicines,
    getItem,
    loading,
    loadError,
    submitting,
    submitError,
    setValue,
    skip,
    unskip,
    activate,
    cancel,
    reload: load,
  }
}
