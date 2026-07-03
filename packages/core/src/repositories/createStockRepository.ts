// createStockRepository.js — Factory CRUD canônico de estoque (Fase 3 S3.2 G2).
//
// Espelha o pattern de createProtocolRepository (Fase 2 G2).
// Web e mobile injetam: client Supabase, getUserId, e (opcional) transforms.
// Fonte de verdade do comportamento: stockService mobile consolidado (S3.1).
// Validação Zod decrease/increase é canônica (via @dosiq/core stockSchema).
//
// Métodos (nomes mobile — sem param userId, resolvido via getUserId injetado):
// - getMedicinesWithStockOrActiveProtocol()  → PO-9: ativos hoje OU saldo > 0 (filtro client-side)
// - getByMedicine(medicineId)                → stock entries, order created_at desc
// - getStockSummary(medicineId)              → view medicine_stock_summary maybeSingle + default
// - getStockSummaryMap()                     → mapa medicineId → total_quantity (bulk)
// - getTotalQuantity(medicineId)             → view first, fallback soma manual
// - getLowStockMedicines(threshold)          → RPC get_low_stock_medicines + fallback view
// - decreaseStock(medicineId, qty, logId)    → validateStockDecrease + RPC consume_stock_fifo
// - increaseStock(medicineId, qty, options)  → validateStockIncrease; restore vs ajuste manual
// - adjustToBalance(medId, newBalance, ...)  → PO-6: delta → increase/decrease
// - delete(id)                               → web-only (guarda contra apagar compra consumida); paridade

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import {
  validateStockDecrease,
  validateStockIncrease,
} from '../schemas/stockSchema'
import { z } from 'zod'
import { getTodayLocal, isProtocolActiveOnDate } from '../utils/dateUtils'
import { cleanFloat } from '../utils/formUtils'

interface ValidationError {
  field: string
  message: string
}

function fmtZodErr(errors: ValidationError[]) {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ')
}

interface CreateStockRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

/**
 * Cria um repositório CRUD de estoque parametrizado por plataforma.
 */
// NOTA: factory excede max-lines-per-function por agregar os métodos de estoque
// num único objeto (pattern canônico de createProtocolRepository). Warning aceito (R-221 SQP).
export function createStockRepository({ client, getUserId }: CreateStockRepositoryDeps) {
  if (!client) throw new Error('createStockRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createStockRepository: getUserId deve ser função async')
  }

  // Objeto construído numa const estável (repo) — métodos que chamam outros
  // métodos usam `repo.*` (não `this.*`) pra sobreviver a destructuring em hooks.
  const repo = {
    // === READS ===

    /**
     * Medicamentos do hub de estoque (PO-9 §0.7): lista quem tem protocolo ativo
     * HOJE OU saldo positivo. NÃO filtra protocols.active no servidor — atividade
     * é avaliada no client via isProtocolActiveOnDate, inclusão considera totalStock > 0.
     *
     * @returns {Promise<Array>} medicines crus (medicine_stock_summary + protocols)
     */
    async getMedicinesWithStockOrActiveProtocol() {
      const userId = await getUserId()
      z.string().uuid().parse(userId)
      const { data, error } = await client
        .from('medicines')
        .select(`
        id,
        name,
        laboratory,
        type,
        presentation,
        dosage_unit,
        dosage_per_pill,
        concentration_volume_ml,
        units_per_ml,
        shelf_life_days,
        medicine_stock_summary!left (
          total_quantity,
          stock_entries_count
        ),
        protocols (
          id,
          dosage_per_intake,
          intake_unit,
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
     * Stock entries de um medicamento (order created_at desc).
     */
    async getByMedicine(medicineId: string) {
      const userId = await getUserId()
      const { data, error } = await client
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
     * Usa view medicine_stock_summary; default object se ausente.
     */
    async getStockSummary(medicineId: string) {
      const userId = await getUserId()
      const { data, error } = await client
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
     * @returns {Promise<Record<string, number>>}
     */
    async getStockSummaryMap() {
      const userId = await getUserId()
      z.string().uuid().parse(userId)
      const { data, error } = await client
        .from('medicine_stock_summary')
        .select('medicine_id, total_quantity')
        .eq('user_id', userId)

      if (error) throw error
      return (data || []).reduce((map: Record<string, number>, row: any) => {
        map[row.medicine_id] = row.total_quantity ?? 0
        return map
      }, {})
    },

    /**
     * Total quantity (com fallback manual caso view não retorne).
     */
    async getTotalQuantity(medicineId: string) {
      const userId = await getUserId()
      const { data: summary, error: summaryError } = await client
        .from('medicine_stock_summary')
        .select('total_quantity')
        .eq('medicine_id', medicineId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!summaryError && summary) return summary.total_quantity

      const { data, error } = await client
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
    async getLowStockMedicines(threshold: number = 10) {
      const userId = await getUserId()
      const { data, error } = await client.rpc('get_low_stock_medicines', {
        p_user_id: userId,
        p_threshold: threshold,
      })

      if (error) {
        const { data: fallback, error: fbErr } = await client
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

    // === WRITES ===

    /**
     * Consumo FIFO (chamado quando dose é registrada).
     * @throws {Error} se medicineLogId ausente ou validation falhar
     */
    async decreaseStock(medicineId: string, quantity: number, medicineLogId: string) {
      const validation = validateStockDecrease({ medicine_id: medicineId, quantity })
      if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
      if (!medicineLogId) throw new Error('medicineLogId é obrigatório para consumo FIFO rastreável')

      const userId = await getUserId()
      const { data, error } = await client.rpc('consume_stock_fifo', {
        p_user_id: userId,
        p_medicine_id: medicineId,
        p_quantity: quantity,
        p_medicine_log_id: medicineLogId,
      })

      if (error) throw error
      return data
    },

    /**
     * Estorna stock (delete de log) OU ajuste manual positivo.
     * Se `options.medicine_log_id` presente → restore_stock_for_log RPC.
     * Senão → apply_manual_stock_adjustment RPC.
     */
    async increaseStock(
      medicineId: string,
      quantity: number,
      options:
        | string
        | { reason?: string; notes?: string | null; medicine_log_id?: string | null } = {},
    ) {
      const normalized: { reason?: string; notes?: string | null; medicine_log_id?: string | null; quantity: number } =
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
        const { data, error } = await client.rpc('restore_stock_for_log', {
          p_medicine_log_id: payload.medicine_log_id,
          p_reason: payload.reason,
        })
        if (error) throw error
        return data
      }

      const { data, error } = await client.rpc('apply_manual_stock_adjustment', {
        p_medicine_id: medicineId,
        p_quantity_delta: quantity,
        p_reason: payload.reason,
        p_notes: payload.notes,
      })

      if (error) throw error
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
     * @returns {Promise<{delta:number, before:number, after:number}>}
     */
    async adjustToBalance(medicineId: string, newBalance: number, reason: string, notes?: string | null) {
      if (!reason) throw new Error('Motivo é obrigatório para ajuste manual')
      if (newBalance < 0) throw new Error('Saldo final não pode ser negativo')

      // Usar repo.* (não this.*) — métodos podem ser destructurados em hooks
      // (ex: const { adjustToBalance } = useStockMutation()), perdendo `this`.
      const current = await repo.getTotalQuantity(medicineId)
      // cleanFloat: subtração de decimais vaza dízima (1,5−1,9 = -0,39999…) e o delta
      // sujo vira residue persistido na quantity do lote (R-277). Limpa antes do RPC.
      const delta = cleanFloat(newBalance - current)

      if (delta === 0) {
        return { delta: 0, before: current, after: newBalance }
      }

      if (delta > 0) {
        await repo.increaseStock(medicineId, delta, { reason, notes })
      } else {
        // delta negativo — ajuste manual decrementa via RPC com quantity_delta negativo
        const { error } = await client.rpc('apply_manual_stock_adjustment', {
          p_medicine_id: medicineId,
          p_quantity_delta: delta,
          p_reason: reason,
          p_notes: notes ?? null,
        })
        if (error) throw error
      }

      // Return padronizado nos 3 branches — API previsível
      return { delta, before: current, after: newBalance }
    },

    /**
     * Apaga uma stock entry. Web-only (mobile não expõe — mantido na factory pra
     * paridade). Guarda contra apagar compra com consumo associado.
     */
    async delete(id: string) {
      const userId = await getUserId()
      const { data: entry, error: fetchError } = await client
        .from('stock')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError) throw fetchError

      if (
        entry.entry_type === 'purchase' &&
        entry.original_quantity !== null &&
        entry.quantity !== entry.original_quantity
      ) {
        throw new Error(
          'Compras com consumo associado não podem ser removidas. Use ajuste manual positivo.',
        )
      }

      const { error } = await client
        .from('stock')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
  }

  return repo
}
