// stockService.js — Fase 3 CRUD Estoque mobile.
//
// Consolidação dos 2 services web (`stockService` + `purchaseService`) num
// único módulo mobile. Pattern thin local (ADR-029) — chama Supabase direto
// via nativeSupabaseClient. Validação Zod via @dosiq/core (R-125 + R-232).
//
// Diferenças vs web:
// - userId é param explícito (consistente com treatmentsService.js mobile)
// - Sem `delete` de purchase (PO-1 — escopo cortado; correção via Ajuste)
// - getStockData (legacy MVP read-only) preservado pra não quebrar useStock atual
//
// Refactor pra factory createStockRepository + createPurchaseRepository em S2
// (G2/G3). Por enquanto este service é a fonte mobile.

import { z } from 'zod'
import {
  getTodayLocal,
  isProtocolActiveOnDate,
  validateStockCreate,
  validateStockDecrease,
  validateStockIncrease,
} from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'
import { debugLog, errorLog } from '@shared/utils/debugLog'

// ───────────────────────────────────────────────────────────────────────────
// LEGACY — getStockData (MVP read-only, mantido pra useStock atual)
// ───────────────────────────────────────────────────────────────────────────

/**
 * @deprecated PO-9 §0.7 — filtra `protocols.active=true` no servidor e esconde
 * meds com estoque órfão. Substituído por
 * `stockService.getMedicinesWithStockOrActiveProtocol`. Remover em fix-pack
 * pós-Fase 3 (sem callers após Wave 4).
 *
 * Busca medicamentos com estoque + protocolos ativos pra cálculo de consumo.
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getStockData(userId) {
  try {
    z.string().uuid().parse(userId)
    debugLog('stockService', `getStockData: ${userId}`)

    const { data: rawData, error } = await nativeSupabaseClient
      .from('medicines')
      .select(`
        id,
        name,
        laboratory,
        dosage_unit,
        dosage_per_pill,
        medicine_stock_summary!left (
          total_quantity
        ),
        protocols (
          id,
          dosage_per_intake,
          time_schedule,
          frequency,
          active,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId)
      .eq('protocols.active', true)
      .order('name')

    if (error) {
      errorLog('stockService', 'getStockData query error', error)
      return { success: false, error: 'Erro ao carregar dados de estoque' }
    }

    const today = getTodayLocal()
    const validData = (rawData || []).filter((m) =>
      (m.protocols || []).some((p) => isProtocolActiveOnDate(p, today)),
    )

    return { success: true, data: validData }
  } catch (err) {
    errorLog('stockService', 'getStockData unexpected', err)
    return { success: false, error: err.message }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FASE 3 — stockService object (CRUD completo)
// ───────────────────────────────────────────────────────────────────────────

function fmtZodErr(errors) {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ')
}

export const stockService = {
  // === READS ===

  /**
   * Medicamentos do hub de estoque (PO-9 §0.7): lista quem tem protocolo ativo
   * HOJE OU saldo positivo. Corrige bug de produção do getStockData legacy, que
   * filtrava `protocols.active=true` no servidor e escondia meds com estoque
   * órfão (sem treatment / treatment finalizado / treatment pausado).
   *
   * NÃO filtra protocols.active no servidor — atividade é avaliada no client
   * via isProtocolActiveOnDate, e a inclusão considera também totalStock > 0.
   *
   * @returns {Promise<Array>} medicines crus (medicine_stock_summary + protocols)
   */
  async getMedicinesWithStockOrActiveProtocol(userId) {
    z.string().uuid().parse(userId)
    const { data, error } = await nativeSupabaseClient
      .from('medicines')
      .select(`
        id,
        name,
        laboratory,
        dosage_unit,
        dosage_per_pill,
        medicine_stock_summary!left (
          total_quantity
        ),
        protocols (
          id,
          dosage_per_intake,
          time_schedule,
          frequency,
          active,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error

    const today = getTodayLocal()
    return (data || []).filter((m) => {
      const hasActiveProtocol = (m.protocols || []).some(
        (p) => p.active && isProtocolActiveOnDate(p, today),
      )
      const totalStock = m.medicine_stock_summary?.[0]?.total_quantity ?? 0
      return hasActiveProtocol || totalStock > 0
    })
  },

  /**
   * Stock entries de um medicamento (FIFO order).
   */
  async getByMedicine(medicineId, userId) {
    const { data, error } = await nativeSupabaseClient
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Summary agregado (total_quantity, entries_count, datas).
   * Usa view medicine_stock_summary.
   */
  async getStockSummary(medicineId, userId) {
    const { data, error } = await nativeSupabaseClient
      .from('medicine_stock_summary')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return (
      data ?? {
        medicine_id: medicineId,
        user_id: userId,
        total_quantity: 0,
        stock_entries_count: 0,
        oldest_entry_date: null,
        newest_entry_date: null,
      }
    )
  },

  /**
   * Mapa medicineId → total_quantity de todos os meds do usuário (bulk).
   * Usado pelo PurchaseMedicineSheet pra exibir saldo sem N queries.
   * @returns {Promise<Record<string, number>>}
   */
  async getStockSummaryMap(userId) {
    z.string().uuid().parse(userId)
    const { data, error } = await nativeSupabaseClient
      .from('medicine_stock_summary')
      .select('medicine_id, total_quantity')
      .eq('user_id', userId)

    if (error) throw error
    return (data || []).reduce((map, row) => {
      map[row.medicine_id] = row.total_quantity ?? 0
      return map
    }, {})
  },

  /**
   * Total quantity (com fallback manual caso view não retorne).
   */
  async getTotalQuantity(medicineId, userId) {
    const { data: summary, error: summaryError } = await nativeSupabaseClient
      .from('medicine_stock_summary')
      .select('total_quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!summaryError && summary) return summary.total_quantity

    const { data, error } = await nativeSupabaseClient
      .from('stock')
      .select('quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)

    if (error) throw error
    return (data || []).reduce((acc, e) => acc + (e.quantity || 0), 0)
  },

  /**
   * Medicamentos com stock baixo. Usa RPC; fallback view direto.
   */
  async getLowStockMedicines(userId, threshold = 10) {
    const { data, error } = await nativeSupabaseClient.rpc('get_low_stock_medicines', {
      p_user_id: userId,
      p_threshold: threshold,
    })

    if (error) {
      const { data: fallback, error: fbErr } = await nativeSupabaseClient
        .from('medicine_stock_summary')
        .select('*')
        .eq('user_id', userId)
        .lte('total_quantity', threshold)
        .order('total_quantity', { ascending: true })

      if (fbErr) throw fbErr
      return fallback || []
    }
    return data || []
  },

  // === PURCHASES (read) ===

  /**
   * Histórico de compras de um medicamento.
   */
  async getPurchasesByMedicine(medicineId, userId) {
    // Embed do lote em `stock` (FK stock.purchase_id → purchases.id) pra expor o
    // saldo restante de cada compra. `remaining` = soma das entries do lote
    // (normalmente 1). Sem isso o PurchaseCard mostrava sempre "0 restantes".
    const { data, error } = await nativeSupabaseClient
      .from('purchases')
      .select('*, stock(quantity)')
      .eq('medicine_id', medicineId)
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((p) => ({
      ...p,
      remaining: (p.stock || []).reduce((acc, s) => acc + (Number(s.quantity) || 0), 0),
    }))
  },

  /**
   * Última compra de cada medicineId (mapa medicineId → purchase).
   */
  async getLatestPurchasesByMedicineIds(medicineIds, userId) {
    if (!medicineIds || medicineIds.length === 0) return {}
    const { data, error } = await nativeSupabaseClient
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .in('medicine_id', medicineIds)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).reduce((map, p) => {
      if (!map[p.medicine_id]) map[p.medicine_id] = p
      return map
    }, {})
  },

  // === WRITES ===

  /**
   * Cria compra + atualiza saldo (atômico via RPC).
   * @throws {Error} se validation Zod falhar
   */
  async createPurchase(input, userId) {
    const validation = validateStockCreate(input)
    if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
    const p = validation.data

    const { data, error } = await nativeSupabaseClient.rpc('create_purchase_with_stock', {
      p_medicine_id: p.medicine_id,
      p_quantity: p.quantity,
      p_unit_price: p.unit_price ?? 0,
      p_purchase_date: p.purchase_date,
      p_expiration_date: p.expiration_date,
      p_pharmacy: p.pharmacy,
      p_laboratory: p.laboratory,
      p_notes: p.notes,
    })

    if (error) throw error
    debugLog('stockService', `createPurchase OK medicineId=${p.medicine_id} userId=${userId}`)
    return data
  },

  /**
   * Edita uma purchase existente — APENAS metadados (preço, datas, farmácia,
   * lab, notas). NÃO altera `quantity_bought`: a quantidade está amarrada ao
   * lote em `stock` (saldo + FIFO) e qualquer correção de saldo passa pelo
   * fluxo dedicado "Acertar saldo" (PO-6). Editar quantidade aqui causaria
   * desync silencioso (sem trigger no DB que propague).
   */
  async updatePurchase(id, input, userId) {
    const validation = validateStockCreate(input)
    if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
    const p = validation.data

    const { data, error } = await nativeSupabaseClient
      .from('purchases')
      .update({
        unit_price: p.unit_price ?? 0,
        purchase_date: p.purchase_date,
        expiration_date: p.expiration_date,
        pharmacy: p.pharmacy,
        laboratory: p.laboratory,
        notes: p.notes,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Consumo FIFO (chamado quando dose é registrada).
   * @throws {Error} se medicineLogId ausente ou validation falhar
   */
  async decreaseStock(medicineId, quantity, medicineLogId, userId) {
    const validation = validateStockDecrease({ medicine_id: medicineId, quantity })
    if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
    if (!medicineLogId) throw new Error('medicineLogId é obrigatório para consumo FIFO rastreável')

    const { data, error } = await nativeSupabaseClient.rpc('consume_stock_fifo', {
      p_medicine_id: medicineId,
      p_quantity: quantity,
      p_medicine_log_id: medicineLogId,
    })

    if (error) throw error
    debugLog('stockService', `decreaseStock OK medicineId=${medicineId} userId=${userId}`)
    return data
  },

  /**
   * Estorna stock (delete de log) OU ajuste manual positivo.
   * Se `options.medicine_log_id` presente → restore_stock_for_log RPC.
   * Senão → apply_manual_stock_adjustment RPC.
   */
  async increaseStock(medicineId, quantity, options = {}, userId) {
    const normalized =
      typeof options === 'string'
        ? { reason: options, quantity }
        : { ...options, quantity }

    const validation = validateStockIncrease({
      medicine_id: medicineId,
      quantity,
      medicine_log_id: normalized.medicine_log_id ?? null,
      reason: normalized.reason ?? 'Ajuste de estoque',
      notes: normalized.notes ?? null,
    })

    if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
    const payload = validation.data

    if (payload.medicine_log_id) {
      const { data, error } = await nativeSupabaseClient.rpc('restore_stock_for_log', {
        p_medicine_log_id: payload.medicine_log_id,
        p_reason: payload.reason,
      })
      if (error) throw error
      return data
    }

    const { data, error } = await nativeSupabaseClient.rpc('apply_manual_stock_adjustment', {
      p_medicine_id: medicineId,
      p_quantity_delta: quantity,
      p_reason: payload.reason,
      p_notes: payload.notes,
    })

    if (error) throw error
    debugLog('stockService', `increaseStock OK medicineId=${medicineId} userId=${userId}`)
    return data
  },

  /**
   * Ajuste manual — modo único "Acertar saldo" (PO-6).
   * Calcula delta = newBalance - currentTotal e dispara increase/decrease.
   *
   * @param {string} medicineId
   * @param {number} newBalance - saldo final desejado (>=0)
   * @param {string} reason - motivo (obrigatório PO-6)
   * @param {string|null} notes
   * @param {string} userId
   */
  async adjustToBalance(medicineId, newBalance, reason, notes, userId) {
    if (!reason) throw new Error('Motivo é obrigatório para ajuste manual')
    if (newBalance < 0) throw new Error('Saldo final não pode ser negativo')

    // Usar stockService.* (não this.*) — adjustToBalance pode ser destructurado
    // em hooks (ex: const { adjustToBalance } = useStockMutation()), perdendo
    // referência a `this`.
    const current = await stockService.getTotalQuantity(medicineId, userId)
    const delta = newBalance - current

    if (delta === 0) {
      debugLog('stockService', `adjustToBalance: delta=0, no-op medicineId=${medicineId}`)
      return { delta: 0, before: current, after: newBalance }
    }

    if (delta > 0) {
      await stockService.increaseStock(medicineId, delta, { reason, notes }, userId)
    } else {
      // delta negativo — ajuste manual decrementa via RPC com quantity_delta negativo
      // (depende de migration S2.0 pendente — ver EXEC_SPEC_FASE3 §0.8)
      const { error } = await nativeSupabaseClient.rpc('apply_manual_stock_adjustment', {
        p_medicine_id: medicineId,
        p_quantity_delta: delta,
        p_reason: reason,
        p_notes: notes ?? null,
      })
      if (error) throw error
      debugLog('stockService', `adjustToBalance decrement OK medicineId=${medicineId} delta=${delta}`)
    }

    // Return padronizado nos 3 branches — API previsível
    return { delta, before: current, after: newBalance }
  },
}
