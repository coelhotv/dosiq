import { supabase, getUserId } from '../lib/supabase'

/**
 * Medicine Service - CRUD operations for medicines
 */
export const medicineService = {
  /**
   * Get all medicines for the current user
   */
  async getAll() {
    const { data, error } = await supabase
      .from('medicines')
      .select(`
        *,
        stock(*)
      `)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Calcula o custo médio ponderado baseado no estoque disponível
    return data.map(medicine => {
      const activeStock = (medicine.stock || []).filter(s => s.quantity > 0)
      const totalQuantity = activeStock.reduce((sum, s) => sum + s.quantity, 0)
      const totalValue = activeStock.reduce((sum, s) => sum + ((s.unit_price || 0) * s.quantity), 0)
      
      const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : null
      
      return { 
        ...medicine, 
        avg_price: avgPrice 
      }
    })
  },

  /**
   * Get a single medicine by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('medicines')
      .select(`
        *,
        stock(*)
      `)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .single()
    
    if (error) throw error

    const activeStock = (data.stock || []).filter(s => s.quantity > 0)
    const totalQuantity = activeStock.reduce((sum, s) => sum + s.quantity, 0)
    const totalValue = activeStock.reduce((sum, s) => sum + ((s.unit_price || 0) * s.quantity), 0)
    const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : null
    
    return { ...data, avg_price: avgPrice }
  },

  /**
   * Create a new medicine
   */
  async create(medicine) {
    const { data, error } = await supabase
      .from('medicines')
      .insert([{ ...medicine, user_id: await getUserId() }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update an existing medicine
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('medicines')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Delete a medicine
   */
  async delete(id) {
    const { error } = await supabase
      .from('medicines')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  }
}

/**
 * Protocol Service - CRUD operations for protocols
 */
export const protocolService = {
  /**
   * Get all protocols with medicine info
   */
  async getAll() {
    const { data, error } = await supabase
      .from('protocols')
      .select(`
        *,
        medicine:medicines(*)
      `)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  /**
   * Get active protocols only
   */
  async getActive() {
    const { data, error } = await supabase
      .from('protocols')
      .select(`
        *,
        medicine:medicines(*)
      `)
      .eq('user_id', await getUserId())
      .eq('active', true)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  /**
   * Get a single protocol by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('protocols')
      .select(`
        *,
        medicine:medicines(*)
      `)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Create a new protocol
   */
  async create(protocol) {
    const { data, error } = await supabase
      .from('protocols')
      .insert([{ 
        ...protocol, 
        user_id: await getUserId(),
        // Ensure defaults for titration
        titration_schedule: protocol.titration_schedule || [],
        current_stage_index: protocol.current_stage_index || 0,
        stage_started_at: protocol.titration_schedule?.length > 0 ? new Date().toISOString() : null
      }])
      .select(`
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(*)
      `)
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update an existing protocol
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('protocols')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select(`
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(*)
      `)
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Delete a protocol
   */
  async delete(id) {
    const { error } = await supabase
      .from('protocols')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  },

  //  API method fetches all protocols associated with a given medicine IDs
  async getByMedicineId(medicineId) {
    const { data, error } = await supabase
      .from('protocols')
      .select(`*`)
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId());

    if (error) throw error;
    return data;
  },

  /**
   * Advance to the next titration stage
   * @param {string} id - Protocol ID
   * @param {boolean} markAsCompleted - If true, marks the protocol as completed (final stage reached)
   */
  async advanceTitrationStage(id, markAsCompleted = false) {
    // 1. Get current protocol
    const protocol = await this.getById(id)
    
    if (!protocol.titration_schedule || protocol.titration_schedule.length === 0) {
      throw new Error('Este protocolo não possui regime de titulação')
    }

    const currentStageIndex = protocol.current_stage_index || 0
    const nextStageIndex = currentStageIndex + 1

    // 2. Check if there's a next stage
    if (nextStageIndex >= protocol.titration_schedule.length) {
      // No more stages - mark as completed
      const { data, error } = await supabase
        .from('protocols')
        .update({
          titration_status: 'alvo_atingido',
          current_stage_index: protocol.titration_schedule.length - 1, // Keep at last stage
          stage_started_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', await getUserId())
        .select(`
          *,
          medicine:medicines(*),
          treatment_plan:treatment_plans(*)
        `)
        .single()
      
      if (error) throw error
      return data
    }

    // 3. Advance to next stage
    const nextStage = protocol.titration_schedule[nextStageIndex]
    
    const updates = {
      current_stage_index: nextStageIndex,
      stage_started_at: new Date().toISOString(),
      dosage_per_intake: nextStage.dosage,
      titration_status: markAsCompleted ? 'alvo_atingido' : 'titulando'
    }

    const { data, error } = await supabase
      .from('protocols')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select(`
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(*)
      `)
      .single()
    
    if (error) throw error
    return data
  }
}

/**
 * Treatment Plan Service - Manage groups of protocols (e.g. "Fantastic Four")
 */
export const treatmentPlanService = {
  /**
   * Get all plans with their protocols
   */
  async getAll() {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select(`
        *,
        protocols:protocols(
          *,
          medicine:medicines(*)
        )
      `)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  /**
   * Create a new treatment plan
   */
  async create(plan) {
    const { data, error } = await supabase
      .from('treatment_plans')
      .insert([{ ...plan, user_id: await getUserId() }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update a treatment plan
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('treatment_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Delete a treatment plan
   */
  async delete(id) {
    // Note: Protocols will have their treatment_plan_id set to NULL due to ON DELETE SET NULL
    const { error } = await supabase
      .from('treatment_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  }
}

/**
 * Stock Service - Manage medicine stock
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
   */
  async getTotalQuantity(medicineId) {
    const { data, error } = await supabase
      .from('stock')
      .select('quantity')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
    
    if (error) throw error
    
    return data.reduce((total, item) => total + item.quantity, 0)
  },

  /**
   * Add stock
   */
  async add(stock) {
    // Validate required fields
    if (!stock.medicine_id) {
      throw new Error('ID do medicamento é obrigatório')
    }
    if (stock.quantity === undefined || stock.quantity === null || stock.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero')
    }

    try {
      const { data, error } = await supabase
        .from('stock')
        .insert([{ ...stock, user_id: await getUserId() }])
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
   */
  async decrease(medicineId, quantity) {
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
   */
  async increase(medicineId, quantity, reason = 'Estorno de dose') {
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

/**
 * Log Service - Medicine intake logging
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
   */
  async create(log) {
    // First, create the log entry
    const { data, error } = await supabase
      .from('medicine_logs')
      .insert([{ ...log, user_id: await getUserId() }])
      .select(`
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `)
      .single()
    
    if (error) throw error
    
    // Then, decrease stock
    try {
      await stockService.decrease(log.medicine_id, log.quantity_taken)
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
   */
  async createBulk(logs) {
    // 1. Create all logs
    const userId = await getUserId()
    const logsWithUser = logs.map(log => ({ ...log, user_id: userId }))
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
    for (const log of logs) {
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
   */
  async update(id, updates) {
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

/**
 * Migration Service
 */
export const migrationService = {
  async migratePilotData() {
    const { error } = await supabase.rpc('migrate_pilot_data')
    if (error) throw error
  }
}

