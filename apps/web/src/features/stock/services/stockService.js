import { supabase, getUserId } from '@shared/utils/supabase'
import { validateStockDecrease, validateStockIncrease } from '@schemas/stockSchema'
import { purchaseService } from './purchaseService'

/**
 * Stock Service - Manage medicine stock
 *
 * PERFORMANCE OPTIMIZATION (v1.6):
 * - Uses medicine_stock_summary view for aggregated queries
 * - Optimized getTotalQuantity with single row lookup
 * - Added getStockSummary for complete stock metrics
 * - Added getLowStockMedicines for proactive alerts
 *
 * VALIDAÇÃO ZOD:
 * - Todos os dados de entrada são validados antes de enviar ao Supabase
 * - Erros de validação retornam mensagens em português
 * - Nenhum payload inválido é enviado ao backend
 */
export const stockService = {
  /**
   * Get stock for a specific medicine
   */
  async getByMedicine(medicineId) {
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  /**
   * Get total quantity for a medicine
   * OPTIMIZED: Uses medicine_stock_summary view for better performance
   * Falls back to manual calculation if view returns no data
   */
  async getTotalQuantity(medicineId) {
    // Try optimized view first
    const { data: summaryData, error: summaryError } = await supabase
      .from('medicine_stock_summary')
      .select('total_quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
      .maybeSingle()

    if (!summaryError && summaryData) {
      return summaryData.total_quantity
    }

    // Fallback to manual calculation (backward compatibility)
    const { data, error } = await supabase
      .from('stock')
      .select('quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())

    if (error) throw error

    return data.reduce((total, item) => total + item.quantity, 0)
  },

  /**
   * Get complete stock summary for a medicine
   * Uses medicine_stock_summary view for optimal performance
   *
   * @param {string} medicineId - The medicine ID
   * @returns {Promise<Object>} Stock summary with total_quantity, stock_entries_count, dates
   */
  async getStockSummary(medicineId) {
    const { data, error } = await supabase
      .from('medicine_stock_summary')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
      .maybeSingle()

    if (error) throw error

    // Return default summary if no data found
    if (!data) {
      return {
        medicine_id: medicineId,
        user_id: await getUserId(),
        total_quantity: 0,
        stock_entries_count: 0,
        oldest_entry_date: null,
        newest_entry_date: null,
      }
    }

    return data
  },

  /**
   * Get all medicines with low stock for alerts
   * Uses optimized view with threshold filter
   *
   * @param {number} threshold - Quantity threshold (default: 10)
   * @returns {Promise<Array>} List of medicines below threshold
   */
  async getLowStockMedicines(threshold = 10) {
    const userId = await getUserId()

    // Use the database function for efficient filtering
    const { data, error } = await supabase.rpc('get_low_stock_medicines', {
      p_user_id: userId,
      p_threshold: threshold,
    })

    if (error) {
      // Fallback: query the view directly if RPC fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('medicine_stock_summary')
        .select('*')
        .eq('user_id', userId)
        .lte('total_quantity', threshold)
        .order('total_quantity', { ascending: true })

      if (fallbackError) throw fallbackError
      return fallbackData || []
    }

    return data || []
  },

  /**
   * Add stock
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async add(stock) {
    return purchaseService.create(stock)
  },

  /**
   * Decrease stock (when medicine is taken)
   * This finds the oldest stock entry and decrements it
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de processar
   * @throws {Error} Se os dados forem inválidos
   */
  async decrease(medicineId, quantity, medicineLogId) {
    // Validação Zod
    const validation = validateStockDecrease({ medicine_id: medicineId, quantity })
    if (!validation.success) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    if (!medicineLogId) {
      throw new Error('medicineLogId é obrigatório para consumo FIFO rastreável')
    }

    const { data, error } = await supabase.rpc('consume_stock_fifo', {
      p_medicine_id: medicineId,
      p_quantity: quantity,
      p_medicine_log_id: medicineLogId,
    })

    if (error) throw error
    return data
  },

  /**
   * Increase stock (when a log is deleted or quantity decreased)
   * It creates a special "adjustment" entry to maintain history integrity
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de processar
   * @throws {Error} Se os dados forem inválidos
   */
  async increase(medicineId, quantity, options = {}) {
    const normalizedOptions =
      typeof options === 'string' ? { reason: options } : { ...options, quantity }

    const validation = validateStockIncrease({
      medicine_id: medicineId,
      quantity,
      medicine_log_id: normalizedOptions.medicine_log_id ?? null,
      reason: normalizedOptions.reason ?? 'Ajuste de estoque',
      notes: normalizedOptions.notes ?? null,
    })

    if (!validation.success) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const payload = validation.data

    if (payload.medicine_log_id) {
      const { data, error } = await supabase.rpc('restore_stock_for_log', {
        p_medicine_log_id: payload.medicine_log_id,
        p_reason: payload.reason,
      })

      if (error) throw error
      return data
    }

    const { data, error } = await supabase.rpc('apply_manual_stock_adjustment', {
      p_medicine_id: medicineId,
      p_quantity_delta: quantity,
      p_reason: payload.reason,
      p_notes: payload.notes,
    })

    if (error) throw error
    return data
  },

  /**
   * Delete a stock entry
   */
  async delete(id) {
    const { data: entry, error: fetchError } = await supabase
      .from('stock')
      .select('*')
      .eq('id', id)
      .eq('user_id', await getUserId())
      .single()

    if (fetchError) throw fetchError

    if (
      entry.entry_type === 'purchase' &&
      entry.original_quantity !== null &&
      entry.quantity !== entry.original_quantity
    ) {
      throw new Error(
        'Compras com consumo associado não podem ser removidas. Use ajuste manual positivo.'
      )
    }

    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())

    if (error) throw error
  },
}
