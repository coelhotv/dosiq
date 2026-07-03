// Spec 041 Fase 2 (fix-up) — dirige o CICLO DE VIDA da Live Activity iOS via push (update + end).
//
// A Fase 1 (push-to-start) só INICIA a LA. Sem JS vivo (app fechado) a LA não transiciona nem
// encerra — a máquina de estados iOS só recomputa em re-render (ADR-076 emendada 2026-07-02). Este
// dispatcher, no mesmo loop de minuto (checkReminders), empurra:
//   • update — quando o estado derivado (CON-029) da ocorrência ativa MUDA (upcoming→now→late);
//   • end    — quando a dose foi resolvida (taken/skipped) → card done + dismiss, app fechado.
//
// Token: PER-ACTIVITY (Activity.pushTokenUpdates), gravado em dose_instances.la_push_token pelo app.
// Vive na própria linha da ocorrência → SEM lookup cross-device, SEM IDOR (o token É da instância).
// Idempotência do update: dose_instances.la_push_state guarda o último estado empurrado.
// Fail-open total (FR-008): qualquer falha loga e segue — NUNCA propaga, NUNCA toca o alarme.

import { deriveDoseActivityState, createCriticalAuditService } from '@dosiq/core'
import { getServerTimestamp, parseISO, addMinutes } from '../../utils/dateUtils'
import { sendLiveActivityUpdate, sendLiveActivityEnd, getApnsConfig } from './liveActivityPush.js'

// Status que encerram a LA (dose saiu de pendente).
const RESOLVED_STATUSES = new Set(['taken', 'skipped', 'completed', 'done'])

const SELECT_FIELDS = `
  id, user_id, scheduled_for, critical_alarm, status, la_push_token, la_push_state,
  protocol:protocols(
    id, name, treatment_plan_id, medicine_id,
    medicine:medicines(name)
  )
`

/** dose_instance → shape CON-029 (mínimo p/ deriveDoseActivityState). @private */
function mapInstance(inst) {
  const protocol = inst.protocol || {}
  const medicine = protocol.medicine || {}
  return {
    instanceId: inst.id,
    scheduledFor: inst.scheduled_for,
    critical_alarm: inst.critical_alarm ?? false,
    medicineName: medicine.name || protocol.name || 'Dose',
    treatmentPlanId: protocol.treatment_plan_id ?? null,
  }
}

/** Epoch (s) do scheduled_for (R-020: parseISO, nunca Date cru). @private */
function scheduledEpochSec(inst, now) {
  const d = inst.scheduled_for ? parseISO(inst.scheduled_for) : null
  const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : now.getTime()
  return Math.floor(ms / 1000)
}

/** Limpa o token+estado da LA da ocorrência (encerrada ou token morto). @private */
async function _clearToken(supabase, logger, instanceId) {
  const { error } = await supabase
    .from('dose_instances')
    .update({ la_push_token: null, la_push_state: null })
    .eq('id', instanceId)
  if (error) logger?.error?.('Falha ao limpar la_push_token (fail-open)', error, { instanceId })
}

/** Processa UMA ocorrência com LA ativa: end se resolvida, update se o estado mudou. @private */
async function _driveInstance({ supabase, logger, inst, now, updateFn, endFn, audit }) {
  // Auditoria (spec 042): surface_transitioned. userId = dono da instância (SEC-2). detail só
  // estados derivados (from/to) — sem PII (nome de medicamento/token nunca entram no trail).
  const emitTransition = (to) =>
    audit?.emit({
      userId: inst.user_id,
      doseInstanceId: inst.id,
      event: 'surface_transitioned',
      platform: 'server',
      actor: 'server',
      detail: { from: inst.la_push_state ?? null, to },
    })
  // push_failed: torna VISÍVEL a falha de push da LA (ex.: token de simulador rejeitado pelo APNs) —
  // antes o lifecycle só auditava sucesso, então "a LA não transicionou" ficava silencioso. detail
  // só status/reason/fase do APNs (sem PII: nunca token/rótulo).
  const emitFailed = (phase, res) =>
    audit?.emit({
      userId: inst.user_id,
      doseInstanceId: inst.id,
      event: 'push_failed',
      platform: 'server',
      actor: 'server',
      detail: { phase, status: res?.status ?? null, reason: res?.reason ?? null },
    })

  // Resolvida (dose registrada/pulada) → encerra a LA (card done p/ taken; dismiss p/ resto).
  if (RESOLVED_STATUSES.has(inst.status)) {
    const finalState = inst.status === 'taken' ? 'done' : 'missed'
    const res = await endFn({
      pushToken: inst.la_push_token,
      contentState: { state: finalState, scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
    })
    if (res.ok) {
      await _clearToken(supabase, logger, inst.id)
      await emitTransition(finalState)
      logger?.info?.('LA encerrada por push (end)', { instanceId: inst.id, status: inst.status, apns: res.status })
      return 'ended'
    }
    // Token morto (BadDeviceToken/410): a LA já não existe → limpa o token, MAS audita como falha
    // (não foi um `end` bem-sucedido). O backstop de dismissal do device cobre o encerramento visual.
    if (res.deactivate) {
      await _clearToken(supabase, logger, inst.id)
      await emitFailed('end', res)
      return 'ended'
    }
    logger?.warn?.('push end falhou (fail-open; backstop dismissal cobre)', { instanceId: inst.id, reason: res.reason })
    await emitFailed('end', res)
    return 'failed'
  }

  // Pendente → estado derivado no instante (dose pode ter sido editada). Idempotência por la_push_state.
  const derived = deriveDoseActivityState(mapInstance(inst), now)
  if (!derived) return 'skipped' // inválido / fora de janela
  if (derived.state === inst.la_push_state) return 'skipped' // nada mudou → não spammar APNs

  // 'missed' num item pendente = passou a tolerância sem registro → encerra (paridade cancel/dismiss).
  if (derived.state === 'missed') {
    const res = await endFn({
      pushToken: inst.la_push_token,
      contentState: { state: 'missed', scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
    })
    if (res.ok) {
      await _clearToken(supabase, logger, inst.id)
      await emitTransition('missed')
      return 'ended'
    }
    if (res.deactivate) {
      await _clearToken(supabase, logger, inst.id)
      await emitFailed('end', res)
      return 'ended'
    }
    await emitFailed('end', res)
    return 'failed'
  }

  const res = await updateFn({
    pushToken: inst.la_push_token,
    contentState: { state: derived.state, scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
  })
  if (res.ok) {
    const { error } = await supabase
      .from('dose_instances')
      .update({ la_push_state: derived.state })
      .eq('id', inst.id)
    if (error) logger?.error?.('Falha ao marcar la_push_state (fail-open)', error, { instanceId: inst.id })
    await emitTransition(derived.state)
    logger?.info?.('LA atualizada por push (update)', { instanceId: inst.id, state: derived.state })
    return 'updated'
  }
  // Token morto (BadDeviceToken/Unregistered/410) — a causa MAIS comum de "a LA não atualiza".
  // Limpa o token E audita push_failed (antes retornava 'skipped' silencioso, escondendo a falha).
  if (res.deactivate) {
    await _clearToken(supabase, logger, inst.id)
    await emitFailed('update', res)
    return 'skipped'
  }
  logger?.warn?.('push update falhou (fail-open)', { instanceId: inst.id, reason: res.reason })
  await emitFailed('update', res)
  return 'failed'
}

/**
 * Empurra update/end para todas as LAs iOS ativas (la_push_token IS NOT NULL) no loop de minuto.
 * @param {object} deps
 * @param {object} deps.supabase - client service_role
 * @param {object} deps.logger
 * @param {Date}   [deps.now]
 * @param {Function} [deps.updateFn] - override (testes) do envio de update APNs
 * @param {Function} [deps.endFn] - override (testes) do envio de end APNs
 * @returns {Promise<{processed:number, updated:number, ended:number, skipped:number, failed:number}>}
 */
export async function dispatchLiveActivityLifecycle({ supabase, logger, now = parseISO(getServerTimestamp()), updateFn = sendLiveActivityUpdate, endFn = sendLiveActivityEnd } = {}) {
  const result = { processed: 0, updated: 0, ended: 0, skipped: 0, failed: 0 }

  // Fail-closed na config (R-088): sem APNs, sem ciclo (LA degrada p/ foreground 039).
  if (!getApnsConfig()) return result

  let instances
  try {
    // iOS limita a exibição de uma Live Activity a ~8h → tokens de ocorrências além de 24h atrás são
    // órfãos (limpeza falhou / app desinstalado). Restringe a janela p/ não varrer/processar lixo a
    // cada minuto (carga DB + chamadas APNs redundantes).
    const limitDate = addMinutes(-24 * 60, now).toISOString()
    const { data, error } = await supabase
      .from('dose_instances')
      .select(SELECT_FIELDS)
      .not('la_push_token', 'is', null)
      .gte('scheduled_for', limitDate)
    if (error) throw error
    instances = data || []
  } catch (err) {
    logger?.error?.('Falha ao buscar LAs ativas p/ ciclo (fail-open)', err)
    return result
  }

  // Auditoria de dose crítica (spec 042). Server sem sessão → userId explícito por emit.
  const audit = createCriticalAuditService({ client: supabase })

  for (const inst of instances) {
    result.processed += 1
    try {
      const outcome = await _driveInstance({ supabase, logger, inst, now, updateFn, endFn, audit })
      result[outcome] += 1
    } catch (err) {
      result.failed += 1
      logger?.error?.('Erro no ciclo de LA da ocorrência (fail-open)', err, { instanceId: inst.id })
    }
  }

  return result
}
