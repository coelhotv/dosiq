// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { Platform } from 'react-native'
import { supabase as supabaseImport } from '@platform/supabase/nativeSupabaseClient'

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// root — duplicata de instalação quebra nominal typing do client (protected member
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseImport as any
import { cancelAlarm } from '@platform/alarms/alarmService'
import { endDoseActivity, showDoseDone, readSurfaceLabel } from '@platform/doseActivity/doseActivitySurfaceService'
import { triggerDoseActivityRefresh } from '@platform/doseActivity/doseActivityRefreshBus'
import { logSchema, createDoseInstanceRepository, createDoseLogService, getRawNow } from '@dosiq/core'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS } from '@platform/analytics/analyticsEvents'
import { debugLog } from '@shared/utils/debugLog'

// Repo de instâncias para a âncora de log e leituras locais
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

// Obtém usuário autenticado ou retorna erro de sessão
async function _getAuthUser() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
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
// `platform` habilita o emit de auditoria de dose crítica (spec 042). Platform.OS é
// 'ios'|'android' no mobile — casa com o enum CRITICAL_AUDIT_PLATFORMS.
const doseLogCore = createDoseLogService({
  client: supabase,
  getUserId: _getAuthUserId,
  platform: Platform.OS,
})

// Cancela o alarme local + a superfície de estado contínuo (039) da instância resolvida
// (best-effort, R-245/246; cancel-on-resolve AP-235 / PO-2.2). Sem instanceId (PRN/avulso)
// não há nada atrelado → no-op. NUNCA lança. A superfície usa id=instanceId (cancelAlarm já a
// encerraria por coincidência de id); endDoseActivity torna a intenção explícita e robusta a
// uma futura divergência de id.
async function _handleAndroidSurfaceBestEffort(instanceId: string) {
  let doneLabel: string | null = null
  try {
    doneLabel = await readSurfaceLabel(instanceId)
  } catch (err: any) {
    if (__DEV__) console.warn('[doseService] readSurfaceLabel falhou:', instanceId, err?.message)
  }
  try {
    await endDoseActivity(instanceId)
  } catch (err: any) {
    if (__DEV__) console.warn('[doseService] endDoseActivity best-effort falhou:', instanceId, err?.message)
  }
  if (doneLabel != null) {
    try {
      await showDoseDone({ instanceId, medicineLabel: doneLabel, takenAt: getRawNow() })
    } catch (err: any) {
      if (__DEV__) console.warn('[doseService] showDoseDone best-effort falhou:', instanceId, err?.message)
    }
  }
}

async function _cancelAlarmBestEffort(instanceId: string | null) {
  if (!instanceId) return
  if (Platform.OS === 'android') {
    await _handleAndroidSurfaceBestEffort(instanceId)
  }
  try {
    await cancelAlarm(instanceId)
  } catch (err: any) {
    if (__DEV__) console.warn('[doseService] cancelAlarm best-effort falhou:', instanceId, err?.message)
  }
  triggerDoseActivityRefresh({ instanceId, takenAt: getRawNow() })
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

// Ocorrência já tomada/editada ou fora de janela → register_dose_atomic aborta com P0001
// ('Ocorrência já registrada ou indisponível'). NÃO é crash: é uma superfície/alarme VELHO (ex.: dose
// de ontem que ficou na tela) ou double-tap. A dose já está resolvida → tratar como no-op idempotente
// (limpar a superfície, sem erro vermelho na UI). O erro do Supabase preserva `.code`.
function _isAlreadyResolved(err) {
  return err?.code === 'P0001' || /já registrada|ocorrência já registrada ou indispon[íi]vel/i.test(err?.message || '')
}

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

    // Dose já resolvida (superfície velha / double-tap) → não é erro. Limpa a superfície+alarme
    // remanescentes (idempotente) e retorna no-op silencioso, sem logar catastrófico nem alertar a UI.
    if (_isAlreadyResolved(err)) {
      if (__DEV__) console.warn('[doseService] dose já registrada/indisponível — no-op (superfície velha)')
      await _cancelAlarmBestEffort(instanceId)
      return { success: true, alreadyResolved: true }
    }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await logEvent(EVENTS.DOSE_LOGGED, { action: 'undo', medicine_id: (instance as any).medicine_id })
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await logEvent(EVENTS.DOSE_LOGGED, { action: 'update_orphan', medicine_id: (logEntry as any).medicine_id })
    return { success: true }
  } catch (err) {
    if (_isNetworkError(err)) return _ERR_OFFLINE
    if (__DEV__) console.error('[doseService] updateOrphanLog erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao atualizar registro.' }
  }
}

/**
 * Último sítio de injeção GLOBAL do usuário (cross-medicamento, mais recente por
 * `taken_at`) — alimenta "última aplicação" + alerta de repetição (031/US2,US3).
 * Best-effort: erro NUNCA bloqueia o registro → retorna null.
 *
 * @returns {Promise<string|null>}
 */
export async function getLastInjectionSite() {
  try {
    return await doseLogCore.getLastInjectionSite()
  } catch (err) {
    if (__DEV__) console.error('[doseService] getLastInjectionSite erro:', err)
    return null
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

  const { validatedLogs, error: validationError } = _validateManyLogs(logsData)
  if (validationError) return { success: false, results: [], error: validationError }

  // Mapeia sobre os dados já coeridos pelo Zod; instanceId vem do array original por índice
  // (instance_id é metadado de ancoragem, removido pelo schema). Gemini #3444467545.
  const coreLogs = validatedLogs.map((log, index) => ({
    protocol_id: log.protocol_id,
    medicine_id: log.medicine_id,
    taken_at: log.taken_at,
    quantity_taken: log.quantity_taken,
    notes: log.notes,
    injection_site: log.injection_site ?? null,
    instanceId: logsData[index].instance_id ?? logsData[index].instanceId ?? null,
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
