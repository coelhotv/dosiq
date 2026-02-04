import { supabase, getUserId } from '../../lib/supabase'
import { stockService } from './stockService'
import { validateLogCreate, validateLogUpdate, validateLogBulkArray } from '../../schemas/logSchema'

/**
 * Log Service - Medicine intake logging
 *
 * VALIDAÇÃO ZOD:
 * - Todos os dados de entrada são validados antes de enviar ao Supabase
 * - Erros de validação retornam mensagens em português
 * - Nenhum payload inválido é enviado ao backend
 */
export const logService = {
  /**
   * Get all logs
   */
  async getAll(limit = 50) {
    const { data, error } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data
  },

  /**
   * Get logs for a specific protocol
   */
  async getByProtocol(protocolId, limit = 50) {
    const { data, error } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
      .eq('protocol_id', protocolId)
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data
  },

  /**
   * Log medicine taken
   * This also decrements the stock automatically
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async create(log) {
    // Validação Zod
    const validation = validateLogCreate(log)
    if (!validation.success) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const validatedLog = validation.data

    // First, create the log entry
    const { data, error } = await supabase
      .from('medicine_logs')
      .insert([{ ...validatedLog, user_id: await getUserId() }])
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
      .single()
    
    if (error) throw error
    
    // Then, decrease stock
    try {
      await stockService.decrease(validatedLog.medicine_id, validatedLog.quantity_taken)
    } catch (stockError) {
      // If stock decrease fails, we should ideally rollback the log
      // For now, we'll just throw the error
      console.error('Erro ao decrementar estoque:', stockError)
      throw new Error('Remédio registrado, mas erro ao atualizar estoque: ' + stockError.message)
    }
    
    return data
  },

  /**
   * Create multiple log entries at once
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async createBulk(logs) {
    // Validação Zod em lote
    const validation = validateLogBulkArray(logs)
    if (!validation.success) {
      const errorMessages = validation.errors.map(e =>
        e.index >= 0 ? `[${e.index + 1}] ${e.field}: ${e.message}` : `${e.field}: ${e.message}`
      ).join('; ')
      throw new Error(`Erro de validação em lote: ${errorMessages}`)
    }

    const validatedLogs = validation.data

    // 1. Create all logs
    const userId = await getUserId()
    const logsWithUser = validatedLogs.map(log => ({ ...log, user_id: userId }))
    const { data, error } = await supabase
      .from('medicine_logs')
      .insert(logsWithUser)
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
    
    if (error) throw error
    
    // 2. Decrease stock for each
    const errors = []
    for (const log of validatedLogs) {
      try {
        await stockService.decrease(log.medicine_id, log.quantity_taken)
      } catch (stockError) {
        errors.push(`${log.medicine_id}: ${stockError.message}`)
      }
    }
    
    if (errors.length > 0) {
      console.error('Erros ao decrementar estoque no lote:', errors)
      // We don't throw here to avoid partial failure confusion, 
      // but ideally we'd handle this better
    }
    
    return data
  },

  /**
   * Update a log entry and adjust stock
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async update(id, updates) {
    // Validação Zod (parcial, pois é update)
    const validation = validateLogUpdate(updates)
    if (!validation.success) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    // 1. Get original log to calculate stock delta
    const { data: oldLog, error: fetchError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError) throw fetchError

    // 2. Adjust stock if quantity changed BEFORE updating the log
    // This ensures that if stock logic fails (e.g. schema error), the original log is preserved
    if (updates.quantity_taken !== undefined && updates.quantity_taken !== oldLog.quantity_taken) {
      const delta = updates.quantity_taken - oldLog.quantity_taken
      try {
        if (delta > 0) {
          // More medicine taken -> decrease stock
          await stockService.decrease(oldLog.medicine_id, delta)
        } else if (delta < 0) {
          // Less medicine taken -> increase (refund) stock
          await stockService.increase(oldLog.medicine_id, Math.abs(delta), `Ajuste de dose (ID: ${id})`)
        }
      } catch (stockError) {
        console.error('Erro ao ajustar estoque no update:', stockError)
        throw new Error('Não foi possível atualizar o estoque: ' + stockError.message)
      }
    }

    // 3. Perform update
    const { data, error } = await supabase
      .from('medicine_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
      .single()
    
    if (error) throw error
    
    return data
  },

  /**
   * Delete a log entry
   * Now restores stock!
   */
  async delete(id) {
    // 1. Get log info before deleting
    const { data: log, error: fetchError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError) throw fetchError

    // 2. Restore stock FIRST (it's the most likely to fail due to schema/logic)
    // If it fails, the log is still there and the process stops.
    try {
      await stockService.increase(log.medicine_id, log.quantity_taken, `Dose excluída (ID: ${id})`)
    } catch (stockError) {
      console.error('Erro ao restaurar estoque na exclusão:', stockError)
      throw new Error('Não foi possível devolver o remédio ao estoque: ' + stockError.message)
    }

    // 3. Delete log
    const { error } = await supabase
      .from('medicine_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  },

  /**
   * Get logs with pagination support
   * @param {number} limit - Items per page
   * @param {number} offset - Starting position
   * @returns {Promise} { data: [], total, hasMore }
   */
  getAllPaginated: async (limit = 50, offset = 0) => {
    // 1. Get paginated data
    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `, { count: 'exact' })
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    
    return {
      data: data || [],
      total: count || 0,
      hasMore: (offset + limit) < (count || 0)
    }
  },

  /**
   * Get logs by date range
   * @param {string} startDate - ISO format YYYY-MM-DD
   * @param {string} endDate - ISO format YYYY-MM-DD
   * @returns {Promise}
   */
  getByDateRange: async (startDate, endDate, limit = 50, offset = 0) => {
    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `, { count: 'exact' })
      .eq('user_id', await getUserId())
      .gte('taken_at', `${startDate}T00:00:00`)
      .lte('taken_at', `${endDate}T23:59:59`)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    
    return {
      data: data || [],
      total: count || 0,
      hasMore: (offset + limit) < (count || 0)
    }
  },

  /**
   * Get logs for a specific month
   * @param {number} year - Year (e.g., 2024)
   * @param {number} month - Month (0-11, where 0 is January)
   * @returns {Promise} { data: [], total }
   */
  getByMonth: async (year, month) => {
    // Use UTC-safe date construction to avoid timezone edge cases
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    
    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `, { count: 'exact' })
      .eq('user_id', await getUserId())
      .gte('taken_at', `${startDate}T00:00:00.000Z`)
      .lte('taken_at', `${endDate}T23:59:59.999Z`)
      .order('taken_at', { ascending: false })
    
    if (error) throw error
    
    return {
      data: data || [],
      total: count || 0
    }
  }
}
