// doseLogService.js — Serviço unificado de tomada de dose e controle de estoque FIFO (CON-026)
// Orquestração de registro/undo/update/delete delegada a RPCs TRANSACIONAIS no Postgres
// (register_dose_atomic / update_dose_log_atomic / delete_dose_log_atomic — migração
// 20260619_atomic_dose_logging.sql). O JS mantém apenas validação Zod e a resolução de
// snap (findAnchorInstance) — a atomicidade estoque↔log vive 100% no banco (ADR-071).
//
// Referência de regras:
// - R-121 Zod: validação via validateLogCreate/validateLogUpdate antes de qualquer mutação
// - R-020 timezone: comparações temporais e snap ficam na camada já testada (dateUtils/repo)
// - AP-231: sem janela de log órfão — não há mais insert→delete compensatório em JS

import { createDoseInstanceRepository } from '../repositories/createDoseInstanceRepository.js'
import { validateLogCreate, validateLogUpdate } from '../schemas/logSchema.js'
import { parseISO } from '../utils/dateUtils.js'

/** Tolerância default (min) quando a ocorrência não define a sua. Casa com
 *  MAX_TOLERANCE_MINUTES do createDoseInstanceRepository (fonte única — resolve M1). */
export const DEFAULT_TOLERANCE_MINUTES = 120

/** Normaliza erros do validador Zod numa única string legível. */
function formatValidationError(errors) {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ')
}

/** Resolve a ocorrência a ancorar e se a ancoragem é estrita (tomada direta numa
 *  ocorrência → double-click deve abortar) ou best-effort (snap retroativo/avulsa). */
async function resolveAnchor(repo, validatedLog, instanceId) {
  if (instanceId) return { anchorId: instanceId, strict: true }
  if (validatedLog.protocol_id) {
    const inst = await repo.findAnchorInstance({
      protocolId: validatedLog.protocol_id,
      takenAt: validatedLog.taken_at,
    })
    return { anchorId: inst?.id ?? null, strict: false }
  }
  return { anchorId: null, strict: false }
}

/** Chama a RPC atômica de registro; lança em erro. Retorna o log persistido. */
async function callRegisterAtomic(client, userId, d, anchorId, strict) {
  const { data, error } = await client.rpc('register_dose_atomic', {
    p_user_id: userId,
    p_protocol_id: d.protocol_id ?? null,
    p_medicine_id: d.medicine_id,
    p_taken_at: d.taken_at,
    p_quantity_taken: d.quantity_taken,
    p_notes: d.notes ?? null,
    p_dose_instance_id: anchorId,
    p_strict_anchor: strict,
  })
  if (error) throw error
  return data
}

/**
 * Registra uma tomada de dose de forma atômica (estoque↔log↔ocorrência).
 * @param {Object} deps - { client, repo, getUserId }
 */
async function registerDose({ client, repo, getUserId }, logData, { instanceId = null } = {}) {
  const validation = validateLogCreate(logData)
  if (!validation.success) {
    throw new Error(`Erro de validação: ${formatValidationError(validation.errors)}`)
  }
  const userId = await getUserId()
  const d = validation.data
  const { anchorId, strict } = await resolveAnchor(repo, d, instanceId)
  return callRegisterAtomic(client, userId, d, anchorId, strict)
}

/**
 * Desfaz o registro de uma dose agendada (reverte estoque, remove log e devolve a
 * ocorrência para pending/missed — atômico no banco).
 */
async function undoDose({ client, repo, getUserId }, instanceId) {
  const instance = await repo.getById(instanceId)
  if (!instance) throw new Error('Registro não encontrado.')

  const userId = await getUserId()
  const logId = instance.medicine_log_id

  if (logId) {
    const { error } = await client.rpc('delete_dose_log_atomic', {
      p_user_id: userId,
      p_log_id: logId,
      p_default_tolerance_minutes: DEFAULT_TOLERANCE_MINUTES,
    })
    if (error) throw error
    return { success: true }
  }

  // Sem log atrelado (estado anômalo): apenas reverte o status da ocorrência.
  const now = Date.now()
  const scheduledMs = parseISO(instance.scheduled_for).getTime()
  const tolMs = (instance.tolerance_minutes ?? DEFAULT_TOLERANCE_MINUTES) * 60 * 1000
  const newStatus = now > scheduledMs + tolMs ? 'missed' : 'pending'
  const reverted = await repo.revertToUnregistered(instanceId, newStatus)
  if (!reverted) {
    throw new Error('Não foi possível reverter o status da dose. O registro pode já ter sido alterado.')
  }
  return { success: true }
}

/** Atualiza um log de dose reajustando o estoque FIFO de forma atômica. */
async function updateOrphanLog({ client, getUserId }, logId, updates) {
  const validation = validateLogUpdate(updates)
  if (!validation.success) {
    throw new Error(`Erro de validação: ${formatValidationError(validation.errors)}`)
  }
  const userId = await getUserId()
  const u = validation.data
  const has = (key) => Object.prototype.hasOwnProperty.call(u, key)

  const { data, error } = await client.rpc('update_dose_log_atomic', {
    p_user_id: userId,
    p_log_id: logId,
    p_protocol_id: u.protocol_id ?? null,
    p_medicine_id: u.medicine_id ?? null,
    p_taken_at: u.taken_at ?? null,
    p_quantity_taken: u.quantity_taken ?? null,
    p_notes: u.notes ?? null,
    // Flags de presença: distinguem "não enviado" de "enviado como NULL" (limpar campo).
    p_has_protocol: has('protocol_id'),
    p_has_notes: has('notes'),
  })
  if (error) throw error
  return data
}

/** Exclui um log devolvendo o estoque e revertendo a ocorrência (atômico). */
async function deleteOrphanLog({ client, getUserId }, logId) {
  const userId = await getUserId()
  const { error } = await client.rpc('delete_dose_log_atomic', {
    p_user_id: userId,
    p_log_id: logId,
    p_default_tolerance_minutes: DEFAULT_TOLERANCE_MINUTES,
  })
  if (error) throw error
  return { success: true }
}

/** Valida (Zod), resolve snap e registra uma dose do lote. Retorna { anchorId, data }. */
async function registerOneBulk({ client, repo }, userId, logData) {
  const explicitAnchor =
    logData.instanceId ?? logData.instance_id ?? logData.dose_instance_id ?? null
  const payload = { ...logData }
  delete payload.instanceId
  delete payload.instance_id
  delete payload.dose_instance_id

  const validation = validateLogCreate(payload)
  if (!validation.success) {
    throw new Error(`Erro de validação: ${formatValidationError(validation.errors)}`)
  }
  const d = validation.data
  // Âncora explícita do lote é best-effort (não-estrita); sem ela, snap por protocolo.
  const { anchorId, strict } = explicitAnchor
    ? { anchorId: explicitAnchor, strict: false }
    : await resolveAnchor(repo, d, null)
  const data = await callRegisterAtomic(client, userId, d, anchorId, strict)
  return { anchorId, data }
}

/**
 * Registra múltiplas doses em lote. Cada dose é uma transação atômica isolada: a falha
 * de uma (ex.: estoque) não reverte as demais. Ancoragem em lote é best-effort.
 */
async function registerDoseMany(deps, logsData) {
  if (!Array.isArray(logsData) || logsData.length === 0) {
    throw new Error('Nenhuma dose selecionada.')
  }
  const userId = await deps.getUserId()
  const results = []

  for (const logData of logsData) {
    const anchorEcho =
      logData.instanceId ?? logData.instance_id ?? logData.dose_instance_id ?? null
    try {
      const { anchorId, data } = await registerOneBulk(deps, userId, logData)
      results.push({ id: data.id, instanceId: anchorId, success: true, data })
    } catch (err) {
      results.push({
        id: null,
        instanceId: anchorEcho,
        success: false,
        error: err.message || 'Erro ao registrar dose.',
      })
    }
  }
  return results
}

/**
 * Factory do serviço de registro e controle de doses.
 *
 * @param {Object} deps
 * @param {Object} deps.client - Cliente Supabase.
 * @param {Function} deps.getUserId - Função async () => string (resolve user_id).
 */
export function createDoseLogService({ client, getUserId }) {
  if (!client) throw new Error('createDoseLogService: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createDoseLogService: getUserId deve ser função async')
  }

  const repo = createDoseInstanceRepository({ client })
  const deps = { client, repo, getUserId }

  return {
    registerDose: (logData, options) => registerDose(deps, logData, options),
    undoDose: (instanceId) => undoDose(deps, instanceId),
    updateOrphanLog: (logId, updates) => updateOrphanLog(deps, logId, updates),
    deleteOrphanLog: (logId) => deleteOrphanLog(deps, logId),
    registerDoseMany: (logsData) => registerDoseMany(deps, logsData),
  }
}
