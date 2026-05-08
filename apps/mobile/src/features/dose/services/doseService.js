// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logSchema } from '@dosiq/core'
import { logEvent } from '../../../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'
import { debugLog } from '@shared/utils/debugLog'

/**
 * Regista uma dose tomada.
 * Falha de forma clara se o dispositivo estiver offline.
 *
 * @param {{
 *   protocol_id: string|null,
 *   medicine_id: string,
 *   taken_at: string,       — ISO 8601 (ex: "2026-04-14T08:30:00")
 *   quantity_taken: number,
 *   notes?: string|null
 * }} logData
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
// Detecta erro de rede pelo conteúdo da mensagem ou código PGRST
function _isNetworkError(err) {
  return (
    err?.message?.includes('fetch') ||
    err?.message?.includes('network') ||
    err?.code === 'PGRST301'
  )
}

// Retorno padronizado para erro de conectividade
const _ERR_OFFLINE = { success: false, error: 'Sem ligação à internet. O registo de dose requer conexão.' }

// Obtém usuário autenticado ou retorna erro de sessão
async function _getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, sessionError: 'Sessão expirada. Faça login novamente.' }
  return { user, sessionError: null }
}

// Faz rollback de um log inserido e retorna resultado de erro
async function _rollbackLog(logId, stockError) {
  const { error: rollbackError } = await supabase.from('medicine_logs').delete().eq('id', logId)
  if (rollbackError) {
    console.error('[doseService] erro crítico no rollback:', rollbackError)
    return { success: false, error: 'Erro crítico: falha ao atualizar estoque pós-registro. Contacte o suporte.' }
  }
  if (stockError.message?.includes('Estoque insuficiente')) {
    return { success: false, error: 'Estoque insuficiente para registrar esta dose.' }
  }
  return { success: false, error: 'Não foi possível registrar a dose: erro ao processar estoque.' }
}

// Consome stock via RPC transacional; em caso de falha faz rollback
async function _consumeStock(logEntry) {
  const { error: stockError } = await supabase.rpc('consume_stock_fifo', {
    p_medicine_id: logEntry.medicine_id,
    p_quantity: logEntry.quantity_taken,
    p_medicine_log_id: logEntry.id,
  })
  if (!stockError) return null
  console.warn('[doseService] erro ao consumir stock:', stockError)
  return stockError
}

// Insere um log de dose e trata erros de rede/insert
async function _insertDoseLog(parsedData, userId) {
  const { data: logEntry, error: insertError } = await supabase
    .from('medicine_logs')
    .insert({ ...parsedData, user_id: userId })
    .select('id, taken_at, quantity_taken, medicine_id')
    .single()
  if (insertError) {
    if (__DEV__) console.error('[doseService] insert ERRO:', JSON.stringify(insertError))
    return { logEntry: null, err: _isNetworkError(insertError) ? _ERR_OFFLINE : { success: false, error: insertError.message } }
  }
  return { logEntry, err: null }
}

export async function registerDose(logData) {
  // R-121: validar com Zod antes de enviar ao Supabase
  debugLog('[doseService] registerDose — input:', JSON.stringify(logData))
  const parsed = logSchema.safeParse(logData)
  if (!parsed.success) {
    if (__DEV__) console.warn('[doseService] Zod validation FAILED:', JSON.stringify(parsed.error.issues[0]))
    return { success: false, error: parsed.error.issues[0].message }
  }
  debugLog('[doseService] Zod OK — parsed:', JSON.stringify(parsed.data))

  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, error: sessionError }

    debugLog('[doseService] insert start — user:', user.id)
    const { logEntry, err } = await _insertDoseLog(parsed.data, user.id)
    if (err) return err

    debugLog('[doseService] insert OK — id:', logEntry?.id, 'A consumir stock...')
    const stockError = await _consumeStock(logEntry)
    if (stockError) return _rollbackLog(logEntry.id, stockError)

    debugLog('[doseService] stock consumido com sucesso')
    await logEvent(EVENTS.DOSE_LOGGED, { medicine_id: logEntry.medicine_id })
    return { success: true, data: logEntry }
  } catch (err) {
    if (__DEV__) console.error('[doseService] erro catastrófico:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao registrar dose.' }
  }
}

/**
 * Registra múltiplas doses em batch.
 * Insert batch via Supabase (1 roundtrip) → consume_stock_fifo por log (sequencial).
 * Rollback individual por log se stock falhar — não aborta o batch inteiro.
 *
 * @param {Array<{ protocol_id: string|null, medicine_id: string, taken_at: string, quantity_taken: number }>} logsData
 * @returns {Promise<{ success: boolean, results: Array<{ id: string, success: boolean, error?: string }>, error?: string }>}
 */
// Valida lista de logs com Zod; retorna { validatedLogs } ou { error }
function _validateManyLogs(logsData) {
  const validatedLogs = []
  for (const logData of logsData) {
    const parsed = logSchema.safeParse(logData)
    if (!parsed.success) {
      if (__DEV__) console.warn('[doseService] registerDoseMany Zod FAILED:', parsed.error.issues[0])
      return { validatedLogs: null, error: parsed.error.issues[0].message }
    }
    validatedLogs.push(parsed.data)
  }
  return { validatedLogs, error: null }
}

// Consome stock e trata rollback individual por log em batch
async function _consumeStockBatch(logEntry) {
  const { error: stockError } = await supabase.rpc('consume_stock_fifo', {
    p_medicine_id: logEntry.medicine_id,
    p_quantity: logEntry.quantity_taken,
    p_medicine_log_id: logEntry.id,
  })
  if (!stockError) return { id: logEntry.id, success: true }

  console.warn('[doseService] registerDoseMany stock ERRO para', logEntry.id, stockError)
  const { error: rollbackError } = await supabase.from('medicine_logs').delete().eq('id', logEntry.id)
  if (rollbackError && __DEV__) console.error('[doseService] Erro crítico no rollback do batch:', rollbackError)
  const errMsg = stockError.message?.includes('Estoque insuficiente')
    ? 'Estoque insuficiente.'
    : 'Erro ao processar estoque.'
  return { id: logEntry.id, success: false, error: errMsg }
}

// Insere batch de logs e trata erros de rede/insert
async function _insertBatchLogs(validatedLogs, userId) {
  const { data: insertedLogs, error: insertError } = await supabase
    .from('medicine_logs')
    .insert(validatedLogs.map(l => ({ ...l, user_id: userId })))
    .select('id, taken_at, quantity_taken, medicine_id')
  if (insertError) {
    if (__DEV__) console.error('[doseService] registerDoseMany insert ERRO:', insertError)
    const errMsg = _isNetworkError(insertError) ? _ERR_OFFLINE.error : insertError.message
    return { insertedLogs: null, errMsg }
  }
  return { insertedLogs, errMsg: null }
}

export async function registerDoseMany(logsData) {
  if (!logsData || logsData.length === 0) {
    return { success: false, results: [], error: 'Nenhuma dose selecionada.' }
  }

  // R-121: validar cada log com Zod antes de qualquer mutação
  const { validatedLogs, error: validationError } = _validateManyLogs(logsData)
  if (validationError) return { success: false, results: [], error: validationError }

  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, results: [], error: sessionError }

    // Batch insert — 1 roundtrip para N logs
    const { insertedLogs, errMsg } = await _insertBatchLogs(validatedLogs, user.id)
    if (errMsg) return { success: false, results: [], error: errMsg }

    // R-170: consume_stock_fifo por log — rollback individual se falhar
    const results = []
    for (const logEntry of insertedLogs) {
      results.push(await _consumeStockBatch(logEntry))
    }

    const successCount = results.filter(r => r.success).length
    if (successCount > 0) await logEvent(EVENTS.DOSE_LOGGED_BULK, { count: successCount })
    debugLog('[doseService] registerDoseMany concluído — sucesso:', successCount, '/', results.length)
    return { success: successCount > 0, results }
  } catch (err) {
    if (__DEV__) console.error('[doseService] registerDoseMany erro catastrófico:', err)
    return { success: false, results: [], error: err.message ?? 'Erro desconhecido ao registrar doses.' }
  }
}
