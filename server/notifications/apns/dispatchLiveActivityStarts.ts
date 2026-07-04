// Spec 041 — Dispara o push-to-start da Live Activity (iOS) no loop de minuto do reminder.
//
// Roda DENTRO do mesmo cron que já alimenta checkReminders (api/notify.js, 1×/min). Best-effort
// (NC-2): o alarme T0 é o canal garantido; isto é só a antecipação visual pré-dose. Fail-open
// total (FR-008): qualquer falha loga e segue — NUNCA propaga, NUNCA toca o alarme.
//
// Fluxo (ADR-076, start-only): para cada dose CRÍTICA pendente entrando na janela `upcoming`
// (scheduled_for ≈ now + LEAD min) ainda sem start disparado (la_push_started_at IS NULL):
//   selectActiveDoseActivity (CON-029, dose ativa única por paciente)
//   → guard object-level dose.user_id == device.user_id (S-1; service_role bypassa RLS, R-042)
//   → buildLiveActivityStartPayload (EXPLÍCITO — iOS não redige a LA, decisão PO 2026-06-29; estado recomputado no disparo, NC-1)
//   → APNs raw (sendLiveActivityStart)
//   → sucesso: marca la_push_started_at (idempotência, F-5); 410: desativa token (S-6)

import { selectActiveDoseActivity, createCriticalAuditService } from '@dosiq/core'
import { getServerTimestamp, parseISO, addMinutes } from '../../utils/dateUtils.js'
import { sendLiveActivityStart, getApnsConfig, type ApnsResult } from './liveActivityPush.js'
import { buildLiveActivityStartPayload } from './buildLiveActivityPayload.js'

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
  protocol?: {
    name?: string
    treatment_plan_id?: string | null
    medicine?: { name?: string }
  }
}

type SendFn = (params: { pushToStartToken: string; attributes: Record<string, unknown>; contentState: Record<string, unknown>; staleEpochSec: number }) => Promise<ApnsResult>
type BuildFn = typeof buildLiveActivityStartPayload

const DEFAULT_LEAD_MINUTES = 60 // = SURFACE_WINDOWS.upcomingMinutes (later→upcoming, início do countdown)

const SELECT_FIELDS = `
  id, user_id, scheduled_for, critical_alarm,
  protocol:protocols(
    id, name, dosage_per_intake, intake_unit, treatment_plan_id, medicine_id,
    medicine:medicines(name, dosage_unit, dosage_per_pill),
    treatment_plan:treatment_plans(id, name)
  )
`

/** Mapeia dose_instance → shape CON-029 (espelha mapInstanceToDose do reminder). @private */
function mapInstance(inst: DoseInstanceRow) {
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

interface DispatchForUserParams {
  supabase: any
  logger?: Logger
  userId: string
  instances: DoseInstanceRow[]
  now: Date
  buildFn: BuildFn
  sendFn: SendFn
  audit: ReturnType<typeof createCriticalAuditService>
}

/** Envia o start p/ os devices de UM usuário (IDOR guard + 410 + idempotência). @private */
async function _dispatchForUser({ supabase, logger, userId, instances, now, buildFn, sendFn, audit }: DispatchForUserParams): Promise<'skipped' | 'failed' | 'sent'> {
  const items = instances.map(mapInstance)
  const active = selectActiveDoseActivity(items, now)
  if (!active || !active.instanceId) return 'skipped'
  // Auditoria (spec 042): userId é o dono da dose (SEC-2 — derivado da instância, não de sessão).
  // detail sem PII (sem nome de medicamento/token) — só status HTTP/APNs quando útil.
  const emitAudit = (event: string, detail: Record<string, unknown> | null = null) =>
    audit?.emit({ userId, doseInstanceId: active.instanceId, event, platform: 'server', actor: 'server', detail })

  // Token push-to-start do device (por-provider). RLS bypassada (service_role) → guard explícito.
  const { data: devices, error: devErr } = await supabase
    .from('notification_devices')
    .select('id, user_id, push_token, is_active')
    .eq('user_id', userId)
    .eq('provider', 'apns_liveactivity')
    .eq('is_active', true)
  if (devErr) {
    logger?.error?.('Falha ao buscar dispositivos apns_liveactivity (fail-open)', devErr, { userId })
    return 'skipped'
  }
  if (!devices || devices.length === 0) {
    await emitAudit('push_skipped_no_token')
    return 'skipped'
  }

  const sourceItem = items.find((it) => String(it.instanceId) === String(active.instanceId))
  if (!sourceItem) return 'skipped'
  // Explícito (mostra nome) — iOS não redige a LA (decisão PO 2026-06-29; paridade com a 039/foreground).
  const payload = buildFn(sourceItem, { discreet: false, now })
  if (!payload) return 'skipped'

  let anySent = false
  for (const device of devices) {
    // S-1 IDOR: o token DEVE pertencer ao dono da dose. Query já escopa por userId; reconfirma.
    if (device.user_id !== userId) {
      logger?.warn?.('push-to-start owner mismatch — pulado', { userId, deviceUser: device.user_id })
      continue
    }
    const res = await sendFn({
      pushToStartToken: device.push_token,
      attributes: payload.attributes,
      contentState: payload.contentState,
      staleEpochSec: payload.staleEpochSec,
    })
    if (res.ok) {
      anySent = true
      logger?.info?.('push_start enviado', { userId, instanceId: active.instanceId, status: res.status })
    } else if (res.deactivate) {
      const { error: updErr } = await supabase.from('notification_devices').update({ is_active: false }).eq('id', device.id)
      if (updErr) {
        // Se a desativação falhar silenciosamente, o token morto seguiria recebendo pushes nas
        // próximas janelas. Loga p/ observabilidade (fail-open: não propaga).
        logger?.error?.('Falha ao desativar token apns_liveactivity', updErr, { userId, deviceId: device.id })
      } else {
        logger?.warn?.('token apns_liveactivity desativado (410/bad token)', { userId, deviceId: device.id })
      }
    } else {
      logger?.warn?.('push_start falhou (fail-open)', { userId, reason: res.reason, status: res.status })
    }
  }

  if (!anySent) {
    await emitAudit('push_failed')
    return 'failed'
  }
  await emitAudit('push_sent')
  // Idempotência: marca a ocorrência ativa (não re-dispara nas próximas janelas da `upcoming`).
  // UPDATE condicional (.is null) + .select('id'): trava otimista contra corrida (2 crons no mesmo
  // minuto). PostgREST não erra em no-op (0 linhas) — validar o retorno confirma que a trava foi
  // adquirida por ESTE disparo (AP: elos órfãos / dupla marcação sob corrida).
  const { data: locked, error: updErr } = await supabase
    .from('dose_instances')
    .update({ la_push_started_at: now.toISOString() })
    .eq('id', active.instanceId)
    .is('la_push_started_at', null)
    .select('id')
  if (updErr) {
    logger?.error?.('Falha ao marcar la_push_started_at (fail-open)', updErr, { instanceId: active.instanceId })
    return 'failed'
  }
  if (!locked || locked.length === 0) {
    logger?.warn?.('Trava de idempotência já ativa (push iniciado por outro processo)', { instanceId: active.instanceId })
    return 'skipped'
  }
  return 'sent'
}

interface DispatchLiveActivityStartsParams {
  supabase: any
  logger?: Logger
  now?: Date
  leadMinutes?: number
  sendFn?: SendFn
  buildFn?: BuildFn
}

interface DispatchLiveActivityStartsResult {
  processed: number
  sent: number
  skipped: number
  failed: number
}

/** Dispara o push-to-start (event=start) para doses críticas entrando na janela `upcoming`. */
export async function dispatchLiveActivityStarts({ supabase, logger, now = parseISO(getServerTimestamp()), leadMinutes, sendFn = sendLiveActivityStart, buildFn = buildLiveActivityStartPayload }: DispatchLiveActivityStartsParams): Promise<DispatchLiveActivityStartsResult> {
  const result: DispatchLiveActivityStartsResult = { processed: 0, sent: 0, skipped: 0, failed: 0 }

  // Fail-closed na config (R-088): sem credencial APNs, não dispara (alarme intacto). NÃO é erro.
  if (!getApnsConfig()) {
    logger?.info?.('APNs não configurado — push-to-start ignorado (degrada p/ 039 foreground)')
    return result
  }

  const lead = leadMinutes ?? (Number(process.env.LA_PUSH_LEAD_MINUTES) || DEFAULT_LEAD_MINUTES)
  // Janela = [now, now+lead]: QUALQUER dose crítica pendente entrando no horizonte de `lead`, ainda
  // sem start disparado. Antes era uma fatia de 1min em T−lead exato — que perdia toda dose criada/
  // editada para <lead min (o instante T−lead dela já passou) e também um minuto de cron pulado.
  // A trava `la_push_started_at IS NULL` garante idempotência (não re-dispara nas próximas janelas).
  const windowStart = now.toISOString()
  const windowEnd = addMinutes(lead, now).toISOString()

  let instances: DoseInstanceRow[]
  try {
    const { data, error } = await supabase
      .from('dose_instances')
      .select(SELECT_FIELDS)
      .eq('status', 'pending')
      .eq('critical_alarm', true)
      .is('la_push_started_at', null)
      .gte('scheduled_for', windowStart)
      .lte('scheduled_for', windowEnd)
    if (error) throw error
    instances = data || []
  } catch (err) {
    logger?.error?.('Falha ao buscar instâncias p/ push-to-start (fail-open)', err)
    return result // fail-open: nunca propaga
  }

  if (instances.length === 0) return result

  // Agrupa por usuário → dose ativa única (CON-029)
  const byUser: Record<string, DoseInstanceRow[]> = {}
  for (const inst of instances) {
    ;(byUser[inst.user_id] ||= []).push(inst)
  }

  // Auditoria de dose crítica (spec 042). Server: sem sessão → cada emit passa userId explícito.
  const audit = createCriticalAuditService({ client: supabase })

  for (const userId of Object.keys(byUser)) {
    result.processed += 1
    try {
      const outcome = await _dispatchForUser({ supabase, logger, userId, instances: byUser[userId], now, buildFn, sendFn, audit })
      result[outcome] += 1
    } catch (err) {
      result.failed += 1
      logger?.error?.('Erro no push-to-start do usuário (fail-open)', err, { userId })
    }
  }

  return result
}
