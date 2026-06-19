// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { cancelAlarm } from '../../../platform/alarms/alarmService'
import { logSchema, createDoseInstanceRepository, createDoseLogService } from '@dosiq/core'
import { logEvent } from '../../../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'
import { debugLog } from '@shared/utils/debugLog'

// Repo de instâncias para a âncora de log e leituras locais
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

// Obtém usuário autenticado ou retorna erro de sessão
async function _getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, sessionError: 'Sessão expirada. Faça login novamente.' }
  return { user, sessionError: null }
}

// Helper para encapsular getUserId para a factory do core
async function _getAuthUserId() {
  const { user, sessionError } = await _getAuthUser()
  if (sessionError || !user) throw new Error(sessionError || 'Sessão expirada')
  return user.id
}

// Instancia o serviço unificado do core
const doseLogCore = createDoseLogService({
  client: supabase,
  getUserId: _getAuthUserId,
})

// Cancela o alarme local da instância resolvida (best-effort, R-245/246). Sem instanceId
// (PRN/avulso) não há alarme atrelado → no-op. NUNCA lança.
async function _cancelAlarmBestEffort(instanceId) {
  if (!instanceId) return
  try {
    await cancelAlarm(instanceId)
  } catch (err) {
    if (__DEV__) console.warn('[doseService] cancelAlarm best-effort falhou:', instanceId, err?.message)
  }
}

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

/**
 * Regista uma dose tomada.
 *
 * @param {Object} logData
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function registerDose(logData, { instanceId = null } = {}) {
  debugLog('[doseService] registerDose — input:', JSON.stringify(logData))
  const parsed = logSchema.safeParse(logData)
  if (!parsed.success) {
    if (__DEV__) console.warn('[doseService] Zod validation FAILED:', JSON.stringify(parsed.error.issues[0]))
    return { success: false, error: parsed.error.issues[0].message }
  }
  debugLog('[doseService] Zod OK — parsed:', JSON.stringify(parsed.data))

  try {
    const logEntry = await doseLogCore.registerDose(parsed.data, { instanceId })

    // Side-effects locais de plataforma
    await _cancelAlarmBestEffort(instanceId)
    await logEvent(EVENTS.DOSE_LOGGED, { medicine_id: logEntry.medicine_id })

    return { success: true, data: logEntry }
  } catch (err) {
    if (_isNetworkError(err)) return _ERR_OFFLINE
    if (__DEV__) console.error('[doseService] erro catastrófico:', err)

    if (err.message?.includes('Estoque insuficiente')) {
      return { success: false, error: 'Estoque insuficiente para registrar esta dose.' }
    }
    return { success: false, error: err.message ?? 'Erro desconhecido ao registrar dose.' }
  }
}

/**
 * Desfaz o registro de uma dose.
 *
 * @param {string} instanceId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function undoDose(instanceId) {
  try {
    const { sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, error: sessionError }

    const instance = await doseInstanceRepo.getById(instanceId)
    if (!instance) return { success: false, error: 'Registro não encontrado.' }

    await doseLogCore.undoDose(instanceId)

    await logEvent(EVENTS.DOSE_LOGGED, { action: 'undo', medicine_id: instance.medicine_id })
    return { success: true }
  } catch (err) {
    if (_isNetworkError(err)) return _ERR_OFFLINE
    if (__DEV__) console.error('[doseService] undoDose erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao desfazer dose.' }
  }
}

/**
 * Atualiza um log avulso/PRN ajustando o estoque FIFO.
 *
 * @param {string} logId
 * @param {Object} updates
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateOrphanLog(logId, updates) {
  try {
    const logEntry = await doseLogCore.updateOrphanLog(logId, updates)
    await logEvent(EVENTS.DOSE_LOGGED, { action: 'update_orphan', medicine_id: logEntry.medicine_id })
    return { success: true }
  } catch (err) {
    if (_isNetworkError(err)) return _ERR_OFFLINE
    if (__DEV__) console.error('[doseService] updateOrphanLog erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao atualizar registro.' }
  }
}

/**
 * Exclui um log avulso/PRN devolvendo o estoque ao inventário.
 *
 * @param {string} logId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteOrphanLog(logId) {
  try {
    await doseLogCore.deleteOrphanLog(logId)
    await logEvent(EVENTS.DOSE_LOGGED, { action: 'delete_orphan' })
    return { success: true }
  } catch (err) {
    if (_isNetworkError(err)) return _ERR_OFFLINE
    if (__DEV__) console.error('[doseService] deleteOrphanLog erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao excluir registro.' }
  }
}

// Valida lista de logs com Zod; retorna { validatedLogs } ou { error }
function _validateManyLogs(logsData) {
  const validatedLogs = []
  for (const logData of logsData) {
    const { instance_id: _omit, ...logForInsert } = logData
    const parsed = logSchema.safeParse(logForInsert)
    if (!parsed.success) {
      if (__DEV__) console.warn('[doseService] registerDoseMany Zod FAILED:', parsed.error.issues[0])
      return { validatedLogs: null, error: parsed.error.issues[0].message }
    }
    validatedLogs.push(parsed.data)
  }
  return { validatedLogs, error: null }
}

/**
 * Registra múltiplas doses em batch.
 *
 * @param {Array<Object>} logsData
 * @returns {Promise<{ success: boolean, results: Array<Object>, error?: string }>}
 */
export async function registerDoseMany(logsData) {
  if (!logsData || logsData.length === 0) {
    return { success: false, results: [], error: 'Nenhuma dose selecionada.' }
  }

  const { error: validationError } = _validateManyLogs(logsData)
  if (validationError) return { success: false, results: [], error: validationError }

  const coreLogs = logsData.map((log) => ({
    protocol_id: log.protocol_id,
    medicine_id: log.medicine_id,
    taken_at: log.taken_at,
    quantity_taken: log.quantity_taken,
    notes: log.notes,
    instanceId: log.instance_id ?? log.instanceId ?? null,
  }))

  try {
    const results = await doseLogCore.registerDoseMany(coreLogs)

    // Cancela alarmes dos itens de sucesso pelo instanceId ecoado em cada resultado
    // (sem acoplamento posicional results[i] ↔ logsData[i]).
    for (const res of results) {
      if (res.success && res.instanceId) {
        await _cancelAlarmBestEffort(res.instanceId)
      }
    }

    const successCount = results.filter((r) => r.success).length
    if (successCount > 0) {
      await logEvent(EVENTS.DOSE_LOGGED_BULK, { count: successCount })
    }

    return { success: successCount > 0, results }
  } catch (err) {
    if (_isNetworkError(err)) {
      return { success: false, results: [], error: _ERR_OFFLINE.error }
    }
    if (__DEV__) console.error('[doseService] registerDoseMany erro catastrófico:', err)
    return { success: false, results: [], error: err.message ?? 'Erro desconhecido ao registrar doses.' }
  }
}
