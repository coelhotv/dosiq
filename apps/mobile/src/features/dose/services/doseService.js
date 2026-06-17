// doseService.js — serviço thin para registo de doses no mobile
// ADR-029: thin local service — Supabase directo via nativeSupabaseClient
// R5-008: online-first — escrita offline bloqueada com mensagem clara
// R-121: validação Zod antes de qualquer mutação

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { cancelAlarm } from '../../../platform/alarms/alarmService'
import { logSchema, createDoseInstanceRepository, parseISO } from '@dosiq/core'
import { logEvent } from '../../../platform/analytics/firebaseAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'
import { debugLog } from '@shared/utils/debugLog'

// Repo de instâncias para a âncora de log↔ocorrência (S3.6.2/AP-193). Usa o mesmo client
// da sessão (RLS escopa por user_id); snap e markTaken filtram por protocol_id (AP-A03).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

// Cancela o alarme local da instância resolvida (best-effort, R-245/246). Sem instanceId
// (PRN/avulso) não há alarme atrelado → no-op. NUNCA lança — o registro/estoque já estão
// commitados; um erro aqui não pode reverter a tomada. (036/AP-235)
async function _cancelAlarmBestEffort(instanceId) {
  if (!instanceId) return
  try {
    await cancelAlarm(instanceId)
  } catch (err) {
    if (__DEV__) console.warn('[doseService] cancelAlarm best-effort falhou:', instanceId, err?.message)
  }
}

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
async function _consumeStock(logEntry, userId) {
  const { error: stockError } = await supabase.rpc('consume_stock_fifo', {
    p_user_id: userId,
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

    const reverted = await doseInstanceRepo.revertToUnregistered(instanceId, newStatus)
    if (!reverted) {
      return { success: false, error: 'Não foi possível reverter o status da dose. O registro pode já ter sido alterado.' }
    }

    await logEvent(EVENTS.DOSE_LOGGED, { action: 'undo', medicine_id: instance.medicine_id })
    return { success: true }
  } catch (err) {
    if (__DEV__) console.error('[doseService] undoDose erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao desfazer dose.' }
  }
}

/**
 * Atualiza um log avulso/PRN (sem dose_instance ancorada) ajustando o estoque FIFO.
 * Espelha o web (`logService.update`): se `quantity_taken` ou `medicine_id` mudam,
 * restaura o estoque do log antigo (RPC restore_stock_for_log) e reconsome o novo
 * (RPC consume_stock_fifo). Sem isto o estoque dessincroniza (furos silenciosos).
 * @param {string} logId
 * @param {{ taken_at?: string, quantity_taken?: number, medicine_id?: string }} updates
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateOrphanLog(logId, updates) {
  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, error: sessionError }

    const { data: oldLog, error: fetchError } = await supabase
      .from('medicine_logs')
      .select('id, medicine_id, quantity_taken')
      .eq('id', logId)
      .eq('user_id', user.id)
      .single()
    if (fetchError || !oldLog) return { success: false, error: 'Registro não encontrado.' }

    const nextMedicineId = updates.medicine_id ?? oldLog.medicine_id
    const nextQty = updates.quantity_taken ?? oldLog.quantity_taken
    const stockAffectingChange =
      nextQty !== oldLog.quantity_taken || nextMedicineId !== oldLog.medicine_id

    // Sem mudança que afete estoque: update simples.
    if (!stockAffectingChange) {
      const { error: updError } = await supabase
        .from('medicine_logs')
        .update(updates)
        .eq('id', logId)
        .eq('user_id', user.id)
      if (updError) return { success: false, error: 'Erro ao atualizar registro. Tente novamente.' }
      return { success: true }
    }

    // 1. Restaura o estoque do consumo antigo (idempotente via stock_consumptions guard).
    const { error: restoreError } = await supabase.rpc('restore_stock_for_log', {
      p_medicine_log_id: logId,
      p_reason: 'dose_update_restore',
    })
    if (restoreError) {
      console.warn('[doseService] updateOrphanLog: restore falhou:', restoreError)
      return { success: false, error: 'Erro ao restaurar estoque antes da edição. Tente novamente.' }
    }

    // 2. Aplica o update no log.
    const { error: updError } = await supabase
      .from('medicine_logs')
      .update(updates)
      .eq('id', logId)
      .eq('user_id', user.id)
    if (updError) {
      // Reconsome com os valores antigos para não deixar estoque inflado.
      await supabase.rpc('consume_stock_fifo', {
        p_user_id: user.id,
        p_medicine_id: oldLog.medicine_id,
        p_quantity: oldLog.quantity_taken,
        p_medicine_log_id: logId,
      })
      return { success: false, error: 'Erro ao atualizar registro. Tente novamente.' }
    }

    // 3. Reconsome o estoque com os novos valores.
    const { error: consumeError } = await supabase.rpc('consume_stock_fifo', {
      p_user_id: user.id,
      p_medicine_id: nextMedicineId,
      p_quantity: nextQty,
      p_medicine_log_id: logId,
    })
    if (consumeError) {
      console.warn('[doseService] updateOrphanLog: reconsumo falhou:', consumeError)
      return { success: false, error: 'Registro atualizado, mas houve erro ao reaplicar o consumo de estoque.' }
    }

    await logEvent(EVENTS.DOSE_LOGGED, { action: 'update_orphan', medicine_id: nextMedicineId })
    return { success: true }
  } catch (err) {
    if (__DEV__) console.error('[doseService] updateOrphanLog erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao atualizar registro.' }
  }
}

/**
 * Exclui um log avulso/PRN (sem dose_instance ancorada) devolvendo o estoque ao inventário.
 * Espelha o web (`logService.delete`) e o `undoDose`: restaura o estoque (RPC
 * restore_stock_for_log) ANTES de deletar o log. Sem instância para reverter (avulso).
 * @param {string} logId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteOrphanLog(logId) {
  try {
    const { user, sessionError } = await _getAuthUser()
    if (sessionError) return { success: false, error: sessionError }

    // 1. Restaura o estoque antes de deletar (idempotente via stock_consumptions guard).
    const { error: restoreError } = await supabase.rpc('restore_stock_for_log', {
      p_medicine_log_id: logId,
      p_reason: 'dose_deleted_restore',
    })
    if (restoreError) {
      console.warn('[doseService] deleteOrphanLog: restore falhou:', restoreError)
      return { success: false, error: 'Erro ao devolver o remédio ao estoque. Tente novamente.' }
    }

    // 2. Deleta o log.
    const { error: deleteError } = await supabase
      .from('medicine_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)
    if (deleteError) {
      console.warn('[doseService] deleteOrphanLog: delete falhou:', deleteError)
      return { success: false, error: 'Erro ao remover registro. Tente novamente.' }
    }

    await logEvent(EVENTS.DOSE_LOGGED, { action: 'delete_orphan' })
    return { success: true }
  } catch (err) {
    if (__DEV__) console.error('[doseService] deleteOrphanLog erro:', err)
    return { success: false, error: err.message ?? 'Erro desconhecido ao excluir registro.' }
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
    const stockError = await _consumeStock(logEntry, user.id)
    if (stockError) return _rollbackLog(logEntry.id, stockError)

    debugLog('[doseService] stock consumido com sucesso')
    // Âncora best-effort (S3.6.2/AP-193) — após o estoque, antes do retorno.
    // F4.3c: âncora direta por instanceId quando a tomada parte da timeline.
    await _anchorLogToInstance(logEntry.protocol_id, logEntry.id, logEntry.taken_at, instanceId)
    // Cancel-on-resolve cross-superfície (036/AP-235): resolver a dose pela timeline/FAB
    // cancela o alarme local (trigger + nag + soneca) pra não reabrir numa dose já tomada.
    // Best-effort (R-245/246) — falha NUNCA bloqueia registro/estoque.
    await _cancelAlarmBestEffort(instanceId)
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
async function _consumeStockBatch(logEntry, userId) {
  const { error: stockError } = await supabase.rpc('consume_stock_fifo', {
    p_user_id: userId,
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
      const result = await _consumeStockBatch(logEntry, user.id)
      // Âncora best-effort só se o estoque pegou (log não foi rollbacked) — S3.6.2/AP-193.
      // F4.3d: direta por instance_id quando resolvido; senão snap por tolerância.
      if (result.success) {
        await _anchorLogToInstance(logEntry.protocol_id, logEntry.id, logEntry.taken_at, anchors[i])
        await _cancelAlarmBestEffort(anchors[i]) // 036/AP-235 — cancela alarme de cada instância resolvida
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
