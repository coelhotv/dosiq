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

import { selectActiveDoseActivity, createCriticalAuditService, resolveInstanceMedicine } from '@dosiq/core'
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
  // 052 Slice B: identidade CONGELADA na ocorrência (embed direto pela FK própria).
  medicine_id?: string | null
  medicine?: { name?: string } | null
  protocol?: {
    name?: string
    treatment_plan_id?: string | null
    medicine_id?: string | null
  }
}

type SendFn = (params: { pushToStartToken: string; attributes: Record<string, unknown>; contentState: Record<string, unknown>; staleEpochSec: number }) => Promise<ApnsResult>
type BuildFn = typeof buildLiveActivityStartPayload

const DEFAULT_LEAD_MINUTES = 60 // = SURFACE_WINDOWS.upcomingMinutes (later→upcoming, início do countdown)

// 052 Slice B: `medicine:medicines(...)` pendura na ocorrência (FK própria), não no protocolo —
// o join pelo protocolo exibia o medicamento ATUAL do tratamento numa dose já materializada.
const SELECT_FIELDS = `
  id, user_id, scheduled_for, critical_alarm, medicine_id,
  medicine:medicines(name, dosage_unit, dosage_per_pill),
  protocol:protocols(
    id, name, dosage_per_intake, intake_unit, treatment_plan_id, medicine_id,
    treatment_plan:treatment_plans(id, name)
  )
`

/** Mapeia dose_instance → shape CON-029 (espelha mapInstanceToDose do reminder). @private */
function mapInstance(inst: DoseInstanceRow) {
  const protocol = inst.protocol || {}
  const medicine = resolveInstanceMedicine(inst, { protocol }).medicine || {}
  return {
    instanceId: inst.id,
    scheduledFor: inst.scheduled_for,
    critical_alarm: inst.critical_alarm ?? false,
    medicineName: medicine.name || protocol.name || 'Dose',
    treatmentPlanId: protocol.treatment_plan_id ?? null,
  }
}

/**
 * O usuário é CANDIDATO ao sinal `push_skipped_no_token`? (067 C.1 / FR-040, Decisão 23)
 *
 * Candidato := tem device `platform='ios'` — de QUALQUER provider e INCLUSIVE `is_active=false`.
 * O teste NÃO é "tem apns_liveactivity ativo": iPhone com token expo inativo e sem linha de LA é
 * exatamente o caso que o evento existe p/ diagnosticar (usuário iOS cujo push parou de funcionar).
 * Usuário sem NENHUM device iOS não tem o recurso no aparelho — ausência de recurso inexistente não
 * é evento clínico, e emiti-la custava ~60 linhas por dose, para sempre (medido: 1079 linhas/7d de
 * um único usuário Android-only).
 *
 * Fail-open PRESERVANDO O SINAL: erro de consulta ⇒ trata como candidato (emite). O ruído é
 * bounded (60 linhas/dose) e reversível; perder o diagnóstico de um iPhone real, não.
 * @private
 */
async function _isAppleCandidate(supabase: any, logger: Logger | undefined, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('notification_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'ios')
      .limit(1)
    if (error) {
      logger?.warn?.('Falha ao checar candidatura iOS (fail-open: emite o sinal)', error, { userId })
      return true
    }
    return Boolean(data && data.length > 0)
  } catch (err) {
    // A auditoria é BEST-EFFORT e não pode alterar o desfecho do dispatch: um throw aqui subiria
    // até o catch do loop e transformaria um `skipped` legítimo em `failed` — falseando a métrica
    // do próprio dispatcher por causa de um evento de diagnóstico.
    logger?.warn?.('Erro ao checar candidatura iOS (fail-open: emite o sinal)', err, { userId })
    return true
  }
}

/**
 * O sinal já foi registrado p/ ESTA ocorrência? (067 C.1 / FR-040)
 *
 * O ramo "sem token" repetia a linha a cada minuto pelos 60 min da janela. Aqui a própria trilha
 * serve de referência (nenhuma coluna nova): o evento é diagnóstico de ESTADO, e um estado
 * registrado uma vez já diz tudo o que a linha número 60 diria.
 *
 * ⚠️ **De-duplicação BEST-EFFORT, não trava de idempotência** (RC6 do PR #798). É um
 * read-check-write sem constraint por trás: dois crons sobrepostos no mesmo minuto podem passar
 * pela checagem antes de qualquer um inserir, e sair 2 linhas. O limite superior é 2 por ocorrência,
 * contra as ~60 de hoje — o objetivo da FR-040 é atingido, mas o nome honesto é este.
 *
 * Por que não há constraint: o índice único parcial que tornaria isto uma trava de verdade
 * (`UNIQUE (dose_instance_id) WHERE event='push_skipped_no_token'`) **não pode ser criado** — a
 * tabela já tem 190 ocorrências com duplicata (pior caso 60 linhas), e limpá-las é reescrever
 * trilha clínica, o que o PO recusou por decisão explícita. Se um dia o histórico expirar pelo
 * prune de 90 dias, o índice passa a ser viável e esta função vira redundante.
 *
 * Fail-open PRESERVANDO O SINAL: erro de consulta ⇒ emite (mesmo racional de `_isAppleCandidate`).
 * @private
 */
async function _alreadySignaledNoToken(supabase: any, logger: Logger | undefined, instanceId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('dose_critical_events')
      .select('id')
      .eq('dose_instance_id', instanceId)
      .eq('event', 'push_skipped_no_token')
      .limit(1)
    if (error) {
      logger?.warn?.('Falha ao checar idempotência do sinal (fail-open: emite)', error, { instanceId })
      return false
    }
    return Boolean(data && data.length > 0)
  } catch (err) {
    logger?.warn?.('Erro ao checar idempotência do sinal (fail-open: emite)', err, { instanceId })
    return false
  }
}

/** Dispositivos push-to-start ativos do usuário (por-provider). RLS bypassada — guard explícito no caller. */
async function _fetchLiveActivityDevices(supabase: any, userId: string) {
  return supabase
    .from('notification_devices')
    .select('id, user_id, push_token, is_active')
    .eq('user_id', userId)
    .eq('provider', 'apns_liveactivity')
    .eq('is_active', true)
}

/**
 * Envia o push-to-start p/ cada device do usuário (IDOR guard S-1 + desativação de token morto).
 * Extraído de _dispatchForUser p/ reduzir complexity (R-122). Retorna true se ALGUM device recebeu.
 */
interface StartDeviceCtx {
  supabase: any
  logger?: Logger
  userId: string
  instanceId: string
  payload: NonNullable<Awaited<ReturnType<BuildFn>>>
  sendFn: SendFn
}

/** Envia (ou desativa token morto) p/ UM device. Retorna true se o push chegou. */
async function _sendToOneDevice(ctx: StartDeviceCtx, device: { id: string; user_id: string; push_token: string }): Promise<boolean> {
  const { supabase, logger, userId, instanceId, payload, sendFn } = ctx
  // S-1 IDOR: o token DEVE pertencer ao dono da dose. Query já escopa por userId; reconfirma.
  if (device.user_id !== userId) {
    logger?.warn?.('push-to-start owner mismatch — pulado', { userId, deviceUser: device.user_id })
    return false
  }
  const res = await sendFn({
    pushToStartToken: device.push_token,
    attributes: payload.attributes,
    contentState: payload.contentState,
    staleEpochSec: payload.staleEpochSec,
  })
  if (res.ok) {
    logger?.info?.('push_start enviado', { userId, instanceId, status: res.status })
    return true
  }
  if (res.deactivate) {
    const { error: updErr } = await supabase.from('notification_devices').update({ is_active: false }).eq('id', device.id)
    if (updErr) {
      // Se a desativação falhar silenciosamente, o token morto seguiria recebendo pushes nas
      // próximas janelas. Loga p/ observabilidade (fail-open: não propaga).
      logger?.error?.('Falha ao desativar token apns_liveactivity', updErr, { userId, deviceId: device.id })
    } else {
      logger?.warn?.('token apns_liveactivity desativado (410/bad token)', { userId, deviceId: device.id })
    }
    return false
  }
  logger?.warn?.('push_start falhou (fail-open)', { userId, reason: res.reason, status: res.status })
  return false
}

/**
 * Envia o push-to-start p/ cada device do usuário (IDOR guard S-1 + desativação de token morto).
 * Extraído de _dispatchForUser p/ reduzir complexity (R-122). Retorna true se ALGUM device recebeu.
 */
async function _sendStartToDevices(
  ctx: StartDeviceCtx & { devices: Array<{ id: string; user_id: string; push_token: string }> },
): Promise<boolean> {
  let anySent = false
  for (const device of ctx.devices) {
    const sent = await _sendToOneDevice(ctx, device)
    if (sent) anySent = true
  }
  return anySent
}

/**
 * Idempotência: marca a ocorrência ativa (não re-dispara nas próximas janelas da `upcoming`).
 * UPDATE condicional (.is null) + .select('id'): trava otimista contra corrida (2 crons no mesmo
 * minuto). PostgREST não erra em no-op (0 linhas) — validar o retorno confirma que a trava foi
 * adquirida por ESTE disparo (AP: elos órfãos / dupla marcação sob corrida).
 * Extraído de _dispatchForUser p/ reduzir complexity (R-122).
 */
async function _lockInstanceStarted({
  supabase,
  logger,
  instanceId,
  now,
}: {
  supabase: any
  logger?: Logger
  instanceId: string
  now: Date
}): Promise<'sent' | 'skipped' | 'failed'> {
  const { data: locked, error: updErr } = await supabase
    .from('dose_instances')
    .update({ la_push_started_at: now.toISOString() })
    .eq('id', instanceId)
    .is('la_push_started_at', null)
    .select('id')
  if (updErr) {
    logger?.error?.('Falha ao marcar la_push_started_at (fail-open)', updErr, { instanceId })
    return 'failed'
  }
  if (!locked || locked.length === 0) {
    logger?.warn?.('Trava de idempotência já ativa (push iniciado por outro processo)', { instanceId })
    return 'skipped'
  }
  return 'sent'
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
  const { data: devices, error: devErr } = await _fetchLiveActivityDevices(supabase, userId)
  if (devErr) {
    logger?.error?.('Falha ao buscar dispositivos apns_liveactivity (fail-open)', devErr, { userId })
    return 'skipped'
  }
  if (!devices || devices.length === 0) {
    // FR-040 (Decisão 23): só emite p/ quem é CANDIDATO ao recurso (tem device iOS, mesmo inativo)
    // e uma vez por ocorrência (best-effort — ver `_alreadySignaledNoToken`); antes eram ~60
    // linhas/dose, para sempre, em usuário Android-only.
    const candidate = await _isAppleCandidate(supabase, logger, userId)
    if (candidate && !(await _alreadySignaledNoToken(supabase, logger, active.instanceId))) {
      await emitAudit('push_skipped_no_token')
    }
    return 'skipped'
  }

  const sourceItem = items.find((it) => String(it.instanceId) === String(active.instanceId))
  if (!sourceItem) return 'skipped'
  // Explícito (mostra nome) — iOS não redige a LA (decisão PO 2026-06-29; paridade com a 039/foreground).
  const payload = buildFn(sourceItem, { discreet: false, now })
  if (!payload) return 'skipped'

  const anySent = await _sendStartToDevices({ supabase, logger, userId, instanceId: active.instanceId, devices, payload, sendFn })

  if (!anySent) {
    await emitAudit('push_failed')
    return 'failed'
  }
  await emitAudit('push_sent')
  return _lockInstanceStarted({ supabase, logger, instanceId: active.instanceId, now })
}

/** Busca instâncias pendentes críticas na janela [windowStart, windowEnd] sem start disparado. */
async function _fetchPendingCriticalInstances(
  supabase: any,
  logger: Logger | undefined,
  windowStart: string,
  windowEnd: string,
): Promise<DoseInstanceRow[] | null> {
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
    return data || []
  } catch (err) {
    logger?.error?.('Falha ao buscar instâncias p/ push-to-start (fail-open)', err)
    return null // fail-open: nunca propaga
  }
}

/** Agrupa instâncias por usuário — dose ativa única por paciente (CON-029). */
function _groupByUser(instances: DoseInstanceRow[]): Record<string, DoseInstanceRow[]> {
  const byUser: Record<string, DoseInstanceRow[]> = {}
  for (const inst of instances) {
    ;(byUser[inst.user_id] ||= []).push(inst)
  }
  return byUser
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

  const instances = await _fetchPendingCriticalInstances(supabase, logger, windowStart, windowEnd)
  if (instances === null) return result // fail-open: busca falhou
  if (instances.length === 0) return result

  const byUser = _groupByUser(instances)

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
