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

import { deriveDoseActivityState, createCriticalAuditService, resolveInstanceMedicine, SNOOZE_RETURN_LEAD_MS } from '@dosiq/core'
import { getServerTimestamp, parseISO, addMinutes } from '../../utils/dateUtils.js'
import { sendLiveActivityUpdate, sendLiveActivityEnd, getApnsConfig, type ApnsResult } from './liveActivityPush.js'
import { isSnoozeLiveActivityCapable } from './dispatchLiveActivityStarts.js'
import { toActivityDateSec } from './buildLiveActivityPayload.js'

interface Logger {
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

interface DoseInstanceRow {
  id: string
  user_id: string
  scheduled_for: string
  critical_alarm?: boolean
  status?: string
  la_push_token?: string | null
  la_push_state?: string | null
  // Spec 101: soneca vigente, claim (âncora pós-claim, ADR-110) e tolerância da ocorrência.
  snoozed_until?: string | null
  notified_at?: string | null
  tolerance_minutes?: number | null
  // 052 Slice B: identidade CONGELADA na ocorrência (embed direto pela FK própria).
  medicine_id?: string | null
  medicine?: { name?: string } | null
  protocol?: {
    name?: string
    treatment_plan_id?: string | null
    medicine_id?: string | null
  }
}

type UpdateFn = (params: { pushToken: string | null | undefined; contentState: Record<string, unknown> }) => Promise<ApnsResult>
type EndFn = (params: { pushToken: string | null | undefined; contentState: Record<string, unknown>; dismissEpochSec?: number }) => Promise<ApnsResult>
type IsCapableFn = (supabase: any, logger: Logger | undefined, userId: string) => Promise<boolean>

// Status que encerram a LA (dose saiu de pendente).
// Spec 101 C-29: valores REAIS do banco (`dose_instances.status`: pending · taken · missed · skipped_user ·
// skipped_paused — conferido em 2026-10-10). O conjunto antigo tinha 'skipped'/'completed'/'done', que não
// existem: "Pular" deixava a LA viva e o lifecycle ainda a atualizava como `now`.
const RESOLVED_STATUSES = new Set(['taken', 'missed', 'skipped_user', 'skipped_paused'])

// 052 Slice B: `medicine:medicines(...)` pendura na ocorrência (FK própria), não no protocolo —
// o join pelo protocolo exibia o medicamento ATUAL do tratamento numa dose já materializada.
const SELECT_FIELDS = `
  id, user_id, scheduled_for, critical_alarm, status, la_push_token, la_push_state, medicine_id,
  snoozed_until, notified_at, tolerance_minutes,
  medicine:medicines(name),
  protocol:protocols(
    id, name, treatment_plan_id, medicine_id
  )
`

// Spec 101 (ADR-110 · C-5): o claim zera `snoozed_until` e carimba `notified_at`. Claim normal cai no
// próprio minuto do horário (segundos depois); soneca é ≥ +5 min (FR-002). +2 min separa os dois.
const SNOOZE_CLAIM_MIN_DELAY_MS = 2 * 60000

/** Instante (ms) de uma coluna timestamptz; ausente/inválido → null. @private */
function _ms(v: string | null | undefined): number | null {
  if (!v) return null
  const ms = parseISO(v).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Âncora da soneca da ocorrência (Spec 101): `snoozed_until` vigente, ou — depois do claim — o
 * `notified_at` de um claim de soneca. null = sem soneca (relógio original). @private
 */
function snoozeAnchorOf(inst: DoseInstanceRow): string | null {
  if (inst.snoozed_until) return inst.snoozed_until
  const notified = _ms(inst.notified_at)
  const scheduled = _ms(inst.scheduled_for)
  if (notified === null || scheduled === null) return null
  return notified >= scheduled + SNOOZE_CLAIM_MIN_DELAY_MS ? inst.notified_at ?? null : null
}

/** dose_instance → shape CON-029 (mínimo p/ deriveDoseActivityState). @private */
function mapInstance(inst: DoseInstanceRow, snoozedUntil: string | null = null) {
  const protocol = inst.protocol || {}
  const medicine = resolveInstanceMedicine(inst, { protocol }).medicine || {}
  return {
    instanceId: inst.id,
    scheduledFor: inst.scheduled_for,
    critical_alarm: inst.critical_alarm ?? false,
    medicineName: medicine.name || protocol.name || 'Dose',
    treatmentPlanId: protocol.treatment_plan_id ?? null,
    toleranceMinutes: inst.tolerance_minutes ?? null,
    snoozedUntil,
  }
}

/**
 * `scheduledAt` do content-state (R-020: parseISO, nunca Date cru), no referencial de `Date` do
 * ActivityKit — segundos desde 2001 (Spec 101 C-15). @private
 */
function scheduledEpochSec(inst: DoseInstanceRow, now: Date): number {
  const d = inst.scheduled_for ? parseISO(inst.scheduled_for) : null
  const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : now.getTime()
  return toActivityDateSec(ms)
}

/** Limpa o token+estado da LA da ocorrência (encerrada ou token morto). @private */
async function _clearToken(supabase: any, logger: Logger | undefined, instanceId: string): Promise<void> {
  const { error } = await supabase
    .from('dose_instances')
    .update({ la_push_token: null, la_push_state: null })
    .eq('id', instanceId)
  if (error) logger?.error?.('Falha ao limpar la_push_token (fail-open)', error, { instanceId })
}

/**
 * Aplica o resultado de um `endFn` (encerramento de LA): ok → limpa token + audita transição;
 * token morto (deactivate) → limpa token + audita falha, mas ainda conta como 'ended' (o backstop
 * de dismissal do device cobre o encerramento visual); qualquer outra falha → audita e conta 'failed'.
 * Extraído de _driveInstance (usado nos ramos "resolvida" e "missed pendente") p/ reduzir complexity (R-122).
 */
async function _handleEndOutcome(
  res: ApnsResult,
  ctx: {
    supabase: any
    logger?: Logger
    inst: DoseInstanceRow
    toState: string
    emitTransition: (to: string) => Promise<unknown>
    emitFailed: (phase: string, res: ApnsResult) => Promise<unknown>
    onSuccessLog?: () => void
    onFailLog?: () => void
  },
): Promise<'ended' | 'failed'> {
  const { supabase, logger, inst, toState, emitTransition, emitFailed, onSuccessLog, onFailLog } = ctx
  if (res.ok) {
    await _clearToken(supabase, logger, inst.id)
    await emitTransition(toState)
    onSuccessLog?.()
    return 'ended'
  }
  // Token morto (BadDeviceToken/410): a LA já não existe → limpa o token, MAS audita como falha
  // (não foi um `end` bem-sucedido).
  if (res.deactivate) {
    await _clearToken(supabase, logger, inst.id)
    await emitFailed('end', res)
    return 'ended'
  }
  onFailLog?.()
  await emitFailed('end', res)
  return 'failed'
}

interface DriveInstanceParams {
  supabase: any
  logger?: Logger
  inst: DoseInstanceRow
  now: Date
  updateFn: UpdateFn
  endFn: EndFn
  audit: ReturnType<typeof createCriticalAuditService>
  /** Spec 101 (FR-011): o app do usuário entende a soneca na LA (≥ MIN_APP_VERSION_FOR_SNOOZE_LIVE_ACTIVITY). false = lifecycle de hoje. */
  snoozeCapable?: boolean
}

// Spec 101 C-19: o widget só troca o contador por "agora" quando é redesenhado; o stale-date já está no
// `late` e T0 não é troca de estado. `now_due` = `now` depois do horário (sem soneca) — força UM update
// em T0. Só existe em `la_push_state`; o widget recebe `now`.
const NOW_DUE = 'now_due'

/** Chave de idempotência do update: o estado derivado, ou `now_due` a partir de T0. @private */
function _pushStateKey(derived: { state: string, nowUntil: number | null }, inst: DoseInstanceRow, now: Date): string {
  if (derived.state !== 'now' || derived.nowUntil != null) return derived.state
  const scheduled = _ms(inst.scheduled_for)
  return scheduled !== null && now.getTime() >= scheduled ? NOW_DUE : derived.state
}

/** `la_push_state` → estado do widget (`now_due` é só chave do servidor). @private */
function _widgetState(pushState: string | null | undefined): string {
  return !pushState || pushState === NOW_DUE ? 'now' : pushState
}

/** Processa UMA ocorrência com LA ativa: end se resolvida, update se o estado mudou. @private */
async function _driveInstance({ supabase, logger, inst, now, updateFn, endFn, audit, snoozeCapable = false }: DriveInstanceParams): Promise<'ended' | 'failed' | 'skipped' | 'updated'> {
  // Auditoria (spec 042): surface_transitioned. userId = dono da instância (SEC-2). detail só
  // estados derivados (from/to) — sem PII (nome de medicamento/token nunca entram no trail).
  const emitTransition = (to: string) =>
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
  const emitFailed = (phase: string, res: ApnsResult) =>
    audit?.emit({
      userId: inst.user_id,
      doseInstanceId: inst.id,
      event: 'push_failed',
      platform: 'server',
      actor: 'server',
      detail: { phase, status: res?.status ?? null, reason: res?.reason ?? null },
    })

  // Resolvida (dose registrada/pulada) → encerra a LA (card done p/ taken; dismiss p/ resto).
  if (RESOLVED_STATUSES.has(inst.status ?? '')) {
    const finalState = inst.status === 'taken' ? 'done' : 'missed'
    const res = await endFn({
      pushToken: inst.la_push_token,
      contentState: { state: finalState, scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
    })
    return _handleEndOutcome(res, {
      supabase, logger, inst, toState: finalState, emitTransition, emitFailed,
      onSuccessLog: () => logger?.info?.('LA encerrada por push (end)', { instanceId: inst.id, status: inst.status, apns: res.status }),
      // O backstop de dismissal do device cobre o encerramento visual mesmo na falha.
      onFailLog: () => logger?.warn?.('push end falhou (fail-open; backstop dismissal cobre)', { instanceId: inst.id, reason: res.reason }),
    })
  }

  // Spec 101 (C-6): dose ADIADA com LA viva → encerra já e limpa o token; o claim da soneca a recria em
  // `now` (FR-008). Sem isto a LA seguiria com o contador antigo e, com token, bloquearia a recriação.
  const snoozedMs = _ms(inst.snoozed_until)
  // C-20: dentro da folga da âncora a dose já está de volta — não encerra a LA que app/claim acabam de criar.
  if (snoozeCapable && snoozedMs !== null && snoozedMs - SNOOZE_RETURN_LEAD_MS > now.getTime()) {
    const res = await endFn({
      pushToken: inst.la_push_token,
      contentState: { state: _widgetState(inst.la_push_state), scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
      dismissEpochSec: Math.floor(now.getTime() / 1000),
    })
    return _handleEndOutcome(res, { supabase, logger, inst, toState: 'snoozed', emitTransition, emitFailed })
  }

  // Pendente → estado derivado no instante (dose pode ter sido editada). Idempotência por la_push_state.
  // Spec 101 (FR-009): com app capaz, deriva com a âncora da soneca (não empurra `late` sobre o `now`).
  const derived = deriveDoseActivityState(mapInstance(inst, snoozeCapable ? snoozeAnchorOf(inst) : null), now)
  if (!derived) return 'skipped' // inválido / fora de janela
  const pushKey = _pushStateKey(derived, inst, now)
  if (pushKey === inst.la_push_state) return 'skipped' // nada mudou → não spammar APNs

  // 'missed' num item pendente = passou a tolerância sem registro → encerra (paridade cancel/dismiss).
  if (derived.state === 'missed') {
    const res = await endFn({
      pushToken: inst.la_push_token,
      contentState: { state: 'missed', scheduledAt: scheduledEpochSec(inst, now), doneAtLabel: '' },
    })
    return _handleEndOutcome(res, { supabase, logger, inst, toState: 'missed', emitTransition, emitFailed })
  }

  const res = await updateFn({
    pushToken: inst.la_push_token,
    contentState: {
      state: derived.state,
      scheduledAt: scheduledEpochSec(inst, now),
      doneAtLabel: '',
      ...(derived.nowUntil != null ? { nowUntil: toActivityDateSec(derived.nowUntil) } : {}),
    },
  })
  return _handleUpdateOutcome(res, { supabase, logger, inst, derivedState: pushKey, emitTransition, emitFailed })
}

/**
 * Aplica o resultado de um `updateFn` (transição de estado da LA): ok → grava `la_push_state` +
 * audita; token morto (deactivate) → limpa token + audita falha (conta 'skipped', não 'failed' —
 * a LA já não existe no device); qualquer outra falha → audita e conta 'failed'.
 * Extraído de _driveInstance p/ reduzir complexity (R-122).
 */
async function _handleUpdateOutcome(
  res: ApnsResult,
  ctx: {
    supabase: any
    logger?: Logger
    inst: DoseInstanceRow
    derivedState: string
    emitTransition: (to: string) => Promise<unknown>
    emitFailed: (phase: string, res: ApnsResult) => Promise<unknown>
  },
): Promise<'updated' | 'skipped' | 'failed'> {
  const { supabase, logger, inst, derivedState, emitTransition, emitFailed } = ctx
  if (res.ok) {
    const { error } = await supabase
      .from('dose_instances')
      .update({ la_push_state: derivedState })
      .eq('id', inst.id)
    if (error) logger?.error?.('Falha ao marcar la_push_state (fail-open)', error, { instanceId: inst.id })
    await emitTransition(derivedState)
    logger?.info?.('LA atualizada por push (update)', { instanceId: inst.id, state: derivedState })
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

interface DispatchLiveActivityLifecycleParams {
  supabase: any
  logger?: Logger
  now?: Date
  updateFn?: UpdateFn
  endFn?: EndFn
  isCapableFn?: IsCapableFn
}

interface DispatchLiveActivityLifecycleResult {
  processed: number
  updated: number
  ended: number
  skipped: number
  failed: number
}

/**
 * FR-011 memorizado por usuário e consultado só quando a ocorrência tem soneca/âncora (as demais seguem
 * o lifecycle de hoje sem custo). Erro ⇒ false. @private
 */
async function _snoozeCapability(cache: Map<string, Promise<boolean>>, inst: DoseInstanceRow, check: () => Promise<boolean>): Promise<boolean> {
  if (!inst.snoozed_until && !snoozeAnchorOf(inst)) return false
  if (!cache.has(inst.user_id)) cache.set(inst.user_id, check().catch(() => false))
  return cache.get(inst.user_id) as Promise<boolean>
}

/** Empurra update/end para todas as LAs iOS ativas (la_push_token IS NOT NULL) no loop de minuto. */
export async function dispatchLiveActivityLifecycle({ supabase, logger, now = parseISO(getServerTimestamp()), updateFn = sendLiveActivityUpdate, endFn = sendLiveActivityEnd, isCapableFn = isSnoozeLiveActivityCapable }: DispatchLiveActivityLifecycleParams): Promise<DispatchLiveActivityLifecycleResult> {
  const result: DispatchLiveActivityLifecycleResult = { processed: 0, updated: 0, ended: 0, skipped: 0, failed: 0 }

  // Fail-closed na config (R-088): sem APNs, sem ciclo (LA degrada p/ foreground 039).
  if (!getApnsConfig()) return result

  let instances: DoseInstanceRow[]
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

  const capableByUser = new Map<string, Promise<boolean>>()
  for (const inst of instances) {
    result.processed += 1
    try {
      const snoozeCapable = await _snoozeCapability(capableByUser, inst, () => isCapableFn(supabase, logger, inst.user_id))
      const outcome = await _driveInstance({ supabase, logger, inst, now, updateFn, endFn, audit, snoozeCapable })
      result[outcome] += 1
    } catch (err) {
      result.failed += 1
      logger?.error?.('Erro no ciclo de LA da ocorrência (fail-open)', err, { instanceId: inst.id })
    }
  }

  return result
}
