import { z } from 'zod'
import { supabase, getUserId } from '@shared/utils/supabase'
import { stockService } from '@stock/services/stockService'
import { validateLogCreate, validateLogUpdate, validateLogBulkArray } from '@schemas/logSchema'
import { parseLocalDate } from '@utils/dateUtils'

// Schemas de validação para todos os métodos de leitura
const limitSchema = z.number().int().positive().max(5000).default(50)
const offsetSchema = z.number().int().min(0).default(0)

const paginationSchema = z.object({
  limit: limitSchema,
  offset: offsetSchema,
})

const protocolIdSchema = z.object({
  protocolId: z.string().uuid('protocolId deve ser UUID válido'),
  limit: limitSchema,
})

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate deve ser YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate deve ser YYYY-MM-DD'),
  limit: limitSchema,
  offset: offsetSchema,
})

const monthSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(0).max(11),
})

/**
 * Normaliza timestamps Supabase para formato Zod-compatível
 * Converte '+00:00' para 'Z' para passar validação z.string().datetime()
 */
function normalizeTimestamps(logs) {
  if (!logs) return logs
  if (!Array.isArray(logs)) return logs

  return logs.map((log) => ({
    ...log,
    taken_at: log.taken_at ? log.taken_at.replace(/\+00:00$/, 'Z') : log.taken_at,
  }))
}

/**
 * Log Service - Medicine intake logging
 *
 * VALIDAÇÃO ZOD:
 * - Todos os dados de entrada são validados antes de enviar ao Supabase
 * - Erros de validação retornam mensagens em português
 * - Nenhum payload inválido é enviado ao backend
 * - Timestamps Supabase são normalizados de '+00:00' para 'Z' (R-120)
 */
export const logService = {
  /**
   * Get all logs
   */
  async getAll(limit = 50) {
    const v = limitSchema.safeParse(limit)
    if (!v.success) {
      console.error('[logService.getAll] Validação falhou:', v.error.format())
      return []
    }

    const { data, error } = await supabase
      .from('medicine_logs')
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `
      )
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return normalizeTimestamps(data)
  },

  /**
   * Get logs for a specific protocol
   */
  async getByProtocol(protocolId, limit = 50) {
    const v = protocolIdSchema.safeParse({ protocolId, limit })
    if (!v.success) {
      console.error('[logService.getByProtocol] Validação falhou:', v.error.format())
      return []
    }

    const { data, error } = await supabase
      .from('medicine_logs')
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `
      )
      .eq('protocol_id', protocolId)
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return normalizeTimestamps(data)
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
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const validatedLog = validation.data

    // First, create the log entry
    const { data, error } = await supabase
      .from('medicine_logs')
      .insert([{ ...validatedLog, user_id: await getUserId() }])
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `
      )
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

    return normalizeTimestamps([data])[0]
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
      const errorMessages = validation.errors
        .map((e) =>
          e.index >= 0 ? `[${e.index + 1}] ${e.field}: ${e.message}` : `${e.field}: ${e.message}`
        )
        .join('; ')
      throw new Error(`Erro de validação em lote: ${errorMessages}`)
    }

    const validatedLogs = validation.data

    // 1. Create all logs
    const userId = await getUserId()
    const logsWithUser = validatedLogs.map((log) => ({ ...log, user_id: userId }))
    const { data, error } = await supabase.from('medicine_logs').insert(logsWithUser).select(`
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
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
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
          await stockService.increase(
            oldLog.medicine_id,
            Math.abs(delta),
            `Ajuste de dose (ID: ${id})`
          )
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
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `
      )
      .single()

    if (error) throw error

    return normalizeTimestamps([data])[0]
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
    const v = paginationSchema.safeParse({ limit, offset })
    if (!v.success) {
      console.error('[logService.getAllPaginated] Validação falhou:', v.error.format())
      return { data: [], total: 0, hasMore: false }
    }

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `,
        { count: 'exact' }
      )
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    }
  },

  /**
   * Timeline: dados mínimos para renderização (sem relações completas)
   * LogEntry usa: id, taken_at, quantity_taken, notes, medicine.name, protocol.name
   * LogForm (edição) usa: id, protocol_id, taken_at, quantity_taken, notes
   * ~120 bytes/log (vs ~500 bytes com select('*') + full relations)
   * @param {number} limit - Items per page
   * @param {number} offset - Starting position
   * @returns {Promise} { data: [], total, hasMore }
   */
  getAllPaginatedSlim: async (limit = 50, offset = 0) => {
    const v = paginationSchema.safeParse({ limit, offset })
    if (!v.success) {
      console.error('[logService.getAllPaginatedSlim] Validação falhou:', v.error.format())
      return { data: [], total: 0, hasMore: false }
    }

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(
        `
        id, taken_at, quantity_taken, notes, medicine_id, protocol_id,
        protocol:protocols(id, name),
        medicine:medicines(id, name)
      `,
        { count: 'exact' }
      )
      .eq('user_id', await getUserId())
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    }
  },

  /**
   * Get logs by date range
   * @param {string} startDate - ISO format YYYY-MM-DD (Brazil local date)
   * @param {string} endDate - ISO format YYYY-MM-DD (Brazil local date)
   * @returns {Promise}
   *
   * NOTE: Usa parseLocalDate() para conversão timezone-safe (R-020, AP-005).
   * parseLocalDate('YYYY-MM-DD') → Date local (meia-noite) → .toISOString() converte para UTC.
   */
  getByDateRange: async (startDate, endDate, limit = 50, offset = 0) => {
    const v = dateRangeSchema.safeParse({ startDate, endDate, limit, offset })
    if (!v.success) {
      console.error('[logService.getByDateRange] Validação falhou:', v.error.format())
      return { data: [], total: 0, hasMore: false }
    }

    // Converte datas locais (YYYY-MM-DD) para UTC via parseLocalDate (R-020, AP-005)
    const startUtc = parseLocalDate(startDate).toISOString()
    const endLocal = parseLocalDate(endDate)
    endLocal.setHours(23, 59, 59, 999)
    const endUtc = endLocal.toISOString()

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `,
        { count: 'exact' }
      )
      .eq('user_id', await getUserId())
      .gte('taken_at', startUtc)
      .lte('taken_at', endUtc)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    }
  },

  /**
   * Get logs for a specific month
   * @param {number} year - Year (e.g., 2024)
   * @param {number} month - Month (0-11, where 0 is January)
   * @returns {Promise} { data: [], total }
   */
  getByMonth: async (year, month) => {
    const v = monthSchema.safeParse({ year, month })
    if (!v.success) {
      console.error('[logService.getByMonth] Validação falhou:', v.error.format())
      return { data: [], total: 0 }
    }

    // Converte datas locais para UTC via parseLocalDate (R-020)
    const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const startUtc = parseLocalDate(startDateStr).toISOString()
    const endLocal = parseLocalDate(endDateStr)
    endLocal.setHours(23, 59, 59, 999)
    const endUtc = endLocal.toISOString()

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(
        `
        *,
        protocol:protocols(*),
        medicine:medicines(*)
      `,
        { count: 'exact' }
      )
      .eq('user_id', await getUserId())
      .gte('taken_at', startUtc)
      .lte('taken_at', endUtc)
      .order('taken_at', { ascending: false })

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
    }
  },

  /**
   * Logs por período com select mínimo (sem relações completas).
   * Consumidores: calculateAdherenceStats, LastDosesWidget, DoseCalendar, useDoseZones
   * Campos: id, taken_at, quantity_taken, protocol_id, medicine_id
   * ~60 bytes/log (vs ~315 bytes com select('*') + full relations)
   * @param {string} startDate - ISO YYYY-MM-DD (data local Brasil)
   * @param {string} endDate - ISO YYYY-MM-DD (data local Brasil)
   * @param {number} limit - Máximo de registros
   * @param {number} offset - Posição inicial
   * @returns {Promise} { data: [], total, hasMore }
   */
  getByDateRangeSlim: async (startDate, endDate, limit = 50, offset = 0) => {
    const validation = dateRangeSchema.safeParse({ startDate, endDate, limit, offset })
    if (!validation.success) {
      console.error('[logService.getByDateRangeSlim] Validação falhou:', validation.error.format())
      return { data: [], total: 0, hasMore: false }
    }

    // Converte datas locais (YYYY-MM-DD) para UTC via parseLocalDate (R-020, AP-005)
    const startUtc = parseLocalDate(startDate).toISOString()
    const endLocal = parseLocalDate(endDate)
    endLocal.setHours(23, 59, 59, 999)
    const endUtc = endLocal.toISOString()

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select('id, taken_at, quantity_taken, protocol_id, medicine_id', { count: 'exact' })
      .eq('user_id', await getUserId())
      .gte('taken_at', startUtc)
      .lte('taken_at', endUtc)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    }
  },

  /**
   * Logs do mês com select mínimo para calendário.
   * Campos: id, taken_at, quantity_taken, medicine_id, medicine.name
   * ~80 bytes/log (vs ~315 bytes com select('*') + full relations)
   * @param {number} year - Ano (ex: 2026)
   * @param {number} month - Mês (0-11)
   * @returns {Promise} { data: [], total }
   */
  getByMonthSlim: async (year, month) => {
    const validation = monthSchema.safeParse({ year, month })
    if (!validation.success) {
      console.error('[logService.getByMonthSlim] Validação falhou:', validation.error.format())
      return { data: [], total: 0 }
    }

    const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Converte datas locais para UTC via parseLocalDate (R-020)
    const startUtc = parseLocalDate(startDateStr).toISOString()
    const endLocal = parseLocalDate(endDateStr)
    endLocal.setHours(23, 59, 59, 999)
    const endUtc = endLocal.toISOString()

    const { data, error, count } = await supabase
      .from('medicine_logs')
      .select(
        `
        id, taken_at, quantity_taken, medicine_id,
        medicine:medicines(id, name)
      `,
        { count: 'exact' }
      )
      .eq('user_id', await getUserId())
      .gte('taken_at', startUtc)
      .lte('taken_at', endUtc)
      .order('taken_at', { ascending: false })

    if (error) throw error

    return {
      data: normalizeTimestamps(data) || [],
      total: count || 0,
    }
  },
}
