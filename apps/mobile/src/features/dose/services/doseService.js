// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logSchema, createDoseInstanceRepository, parseISO } from '@dosiq/core'
import { logEvent } from '../../../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'
import { debugLog } from '@shared/utils/debugLog'

// Repo de instâncias para a âncora de log↔ocorrência (S3.6.2/AP-193). Usa o mesmo client
// da sessão (RLS escopa por user_id); snap e markTaken filtram por protocol_id (AP-A03).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

/**
 * Âncora de log → instância materializada (best-effort, R-245/R-246). Espelha o web
 * (`logService.anchorLogToInstance`) e o bot (`doseActions.anchorLogToInstance`): faz snap
 * por tolerância (escopo `protocol_id`, aceita `pending`/`missed`), marca a instância `taken`
 * e grava o elo bidirecional. NUNCA lança — o `medicine_log` é a fonte de verdade da tomada;
 * a falha deixa o log avulso (`dose_instance_id=null`), reconciliável por backfill.
 * Sem isto, todo registro mobile orfanava o log → instância seguia `pending` → sweep
 * diário marcava `missed` → falso missed corrompia streak/adesão (AP-193).
 * F4.3c — âncora DIRETA por `instanceId` (determinística, espelha web `logService`):
 * quando a tomada parte de uma ocorrência conhecida da timeline, marca exatamente aquela
 * instância. Se `markTaken` direto falhar (já `taken` / duplo-clique / id inválido) NÃO
 * cai no snap por tolerância — ancorar noutra pendente legítima (ex: dose do dia seguinte)
 * seria pior que ficar avulso. Sem `preferInstanceId` (PRN/avulso) → snap por tolerância.
 * @param {string} protocolId
 * @param {string} logId
 * @param {string} takenAt - mesmo timestamp usado no insert do log
 * @param {string|null} preferInstanceId - âncora direta (timeline) ou null (snap)
 */
async function _anchorLogToInstance(protocolId, logId, takenAt, preferInstanceId = null) {
  if (!protocolId) return
  try {
    // Âncora direta por id (F4.3c): determinística, sem snap-fallback se falhar.
    if (preferInstanceId) {
      const marked = await doseInstanceRepo.markTaken(preferInstanceId, logId)
      if (!marked) return
      const { error: linkError } = await supabase
        .from('medicine_logs')
        .update({ dose_instance_id: preferInstanceId })
        .eq('id', logId)
      if (linkError) throw linkError
      return
    }

    const instance = await doseInstanceRepo.findAnchorInstance({ protocolId, takenAt })
    if (!instance) return
    const marked = await doseInstanceRepo.markTaken(instance.id, logId)
    if (!marked) return
    // Desestrutura e lança o erro (paridade com web logService) — falha de DB/rede
    // cai no catch best-effort abaixo; sem isto o PostgREST não sinaliza no bloco try.
    const { error: linkError } = await supabase
      .from('medicine_logs')
      .update({ dose_instance_id: instance.id })
      .eq('id', logId)
    if (linkError) throw linkError
  } catch (anchorError) {
    if (__DEV__) console.warn('[doseService] âncora falhou (log segue avulso):', anchorError)
  }
}

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
    .select('id, taken_at, quantity_taken, medicine_id, protocol_id')
    .single()
  if (insertError) {
    if (__DEV__) console.error('[doseService] insert ERRO:', JSON.stringify(insertError))
    return { logEntry: null, err: _isNetworkError(insertError) ? _ERR_OFFLINE : { success: false, error: insertError.message } }
  }
  return { logEntry, err: null }
}

/**
 * Desfaz o registro de uma dose: reverte estoque (RPC restore_stock_for_log),
 * deleta o medicine_log ancorado e reverte a dose_instance para pending/missed.
 * Se a instância não tiver log ancorado (ex: skipped_user sem tomada), só reverte o status.
 * @param {string} instanceId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function undoDose(instanceId) {
  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, error: sessionError }

    const instance = await doseInstanceRepo.getById(instanceId)
    if (!instance) return { success: false, error: 'Registro não encontrado.' }

    const logId = instance.medicine_log_id

    if (logId) {
      // Reverte estoque via RPC (idempotente: repeated_at guard em stock_consumptions)
      const { error: restoreError } = await supabase.rpc('restore_stock_for_log', {
        p_medicine_log_id: logId,
        p_reason: 'dose_deleted_restore',
      })
      if (restoreError) {
        console.warn('[doseService] undoDose: restore_stock_for_log falhou:', restoreError)
        return { success: false, error: 'Erro ao restaurar estoque. Tente novamente.' }
      }

      const { error: deleteError } = await supabase
        .from('medicine_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id)
      if (deleteError) {
        console.warn('[doseService] undoDose: delete medicine_log falhou:', deleteError)
        return { success: false, error: 'Erro ao remover registro. Tente novamente.' }
      }
    }

    // Determinar novo status: missed se janela de tolerância encerrou, pending caso contrário
    const now = Date.now()
    const scheduledMs = parseISO(instance.scheduled_for).getTime()
    const tolMs = (instance.tolerance_minutes ?? 30) * 60 * 1000
    const newStatus = now > scheduledMs + tolMs ? 'missed' : 'pending'

    await doseInstanceRepo.revertToUnregistered(instanceId, newStatus)

    await logEvent(EVENTS.DOSE_LOGGED, { action: 'undo', medicine_id: instance.medicine_id })
    return { success: true }
  } catch (err) {
    if (__DEV__) console.error('[doseService] undoDose erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao desfazer dose.' }
  }
}

export async function registerDose(logData, { instanceId = null } = {}) {
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
    // Âncora best-effort (S3.6.2/AP-193) — após o estoque, antes do retorno.
    // F4.3c: âncora direta por instanceId quando a tomada parte da timeline.
    await _anchorLogToInstance(logEntry.protocol_id, logEntry.id, logEntry.taken_at, instanceId)
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
 * F4.3d: cada entrada aceita `instance_id` opcional → âncora DIRETA por ocorrência
 * (determinística, espelha web/F4.3c). Ausente → snap por tolerância (PRN/avulso).
 *
 * @param {Array<{ protocol_id: string|null, medicine_id: string, taken_at: string, quantity_taken: number, instance_id?: string|null }>} logsData
 * @returns {Promise<{ success: boolean, results: Array<{ id: string, success: boolean, error?: string }>, error?: string }>}
 */
// Valida lista de logs com Zod; retorna { validatedLogs } ou { error }
// `instance_id` é metadado de âncora — NÃO vai no insert do medicine_log (Zod o descarta);
// extraído à parte por índice antes da validação.
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
    .select('id, taken_at, quantity_taken, medicine_id, protocol_id')
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

  // Âncoras por índice (alinha com a ordem de insert/select do PostgREST). null → snap.
  const anchors = logsData.map((l) => l.instance_id ?? null)

  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, results: [], error: sessionError }

    // Batch insert — 1 roundtrip para N logs
    const { insertedLogs, errMsg } = await _insertBatchLogs(validatedLogs, user.id)
    if (errMsg) return { success: false, results: [], error: errMsg }

    // R-170: consume_stock_fifo por log — rollback individual se falhar
    const results = []
    for (let i = 0; i < insertedLogs.length; i++) {
      const logEntry = insertedLogs[i]
      const result = await _consumeStockBatch(logEntry)
      // Âncora best-effort só se o estoque pegou (log não foi rollbacked) — S3.6.2/AP-193.
      // F4.3d: direta por instance_id quando resolvido; senão snap por tolerância.
      if (result.success) {
        await _anchorLogToInstance(logEntry.protocol_id, logEntry.id, logEntry.taken_at, anchors[i])
      }
      results.push(result)
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
