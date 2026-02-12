import { supabase, getUserId } from '@shared/utils/supabase'
import {
  validateStockCreate,
  validateStockDecrease,
  validateStockIncrease
} from '@shared/constants/stockSchema'

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
        newest_entry_date: null
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
    const { data, error } = await supabase
      .rpc('get_low_stock_medicines', {
        p_user_id: userId,
        p_threshold: threshold
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
    // Validação Zod (substitui validações manuais anteriores)
    const validation = validateStockCreate(stock)
    if (!validation.success) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    try {
      const { data, error } = await supabase
        .from('stock')
        .insert([{ ...validation.data, user_id: await getUserId() }])
        .select()
        .single()

      if (error) {
        // Parse Supabase error for better messaging
        const errorMsg = error.message || error.details || 'Erro desconhecido ao adicionar estoque'
        throw new Error(errorMsg)
      }
      return data
    } catch (err) {
      // Re-throw with context
      throw new Error(err.message || 'Falha ao conectar com o servidor')
    }
  },

  /**
   * Decrease stock (when medicine is taken)
   * This finds the oldest stock entry and decrements it
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de processar
   * @throws {Error} Se os dados forem inválidos
   */
  async decrease(medicineId, quantity) {
    // Validação Zod
    const validation = validateStockDecrease({ medicine_id: medicineId, quantity })
    if (!validation.success) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    // Get oldest stock entries first
    const { data: stockEntries, error: fetchError } = await supabase
      .from('stock')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
      .gt('quantity', 0)
      .order('purchase_date', { ascending: true })
    
    if (fetchError) throw fetchError
    
    let remaining = quantity
    
    for (const entry of stockEntries) {
      if (remaining <= 0) break
      
      const toDecrease = Math.min(entry.quantity, remaining)
      const newQuantity = entry.quantity - toDecrease
      
      const { error: updateError } = await supabase
        .from('stock')
        .update({ quantity: newQuantity })
        .eq('id', entry.id)
      
      if (updateError) throw updateError
      
      remaining -= toDecrease
    }
    
    if (remaining > 0) {
      throw new Error('Estoque insuficiente')
    }
  },

  /**
   * Increase stock (when a log is deleted or quantity decreased)
   * It creates a special "adjustment" entry to maintain history integrity
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de processar
   * @throws {Error} Se os dados forem inválidos
   */
  async increase(medicineId, quantity, reason = 'Estorno de dose') {
    // Validação Zod
    const validation = validateStockIncrease({ medicine_id: medicineId, quantity, reason })
    if (!validation.success) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const { data, error } = await supabase
      .from('stock')
      .insert([{ 
        medicine_id: medicineId, 
        quantity: quantity,
        purchase_date: new Date().toISOString().split('T')[0],
        unit_price: 0,
        user_id: await getUserId(),
        notes: reason
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Delete a stock entry
   */
  async delete(id) {
    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  }
}
