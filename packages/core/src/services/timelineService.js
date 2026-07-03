/**
 * timelineService — Adapter `dose_instances`/`medicine_logs` → eventos + read.
 *
 * FP-3 (ADR-050): o adapter é o ÚNICO ponto que conhece `dose_instances`. Converte
 * linhas concretas em `TimelineEvent[]` de `type='dose'`; o builder puro (timeline.js)
 * só ordena. Um adapter futuro (`biomarkers_log` → eventos `biomarker`) entra ao lado
 * sem tocar este nem o builder.
 *
 * Dedupe (AP-193): uma instância `taken` ancorada e seu `medicine_log` são UM evento,
 * não dois. Logs avulsos (sem `dose_instance_id`, ex: PRN/`quando_necessario` ou
 * registros pré-âncora) viram eventos próprios — NÃO somem do histórico. Defensivo:
 * um log avulso cujo instante cai na tolerância de uma instância já representada
 * (estado real materializado) é suprimido p/ não duplicar o mesmo slot.
 *
 * @module timelineService
 */

import { createDoseInstanceRepository } from '../repositories/createDoseInstanceRepository'
import { buildTimeline, TIMELINE_EVENT_TYPES, TIMELINE_ORDER } from '../utils/timeline.js'
import { parseISO } from '../utils/dateUtils.js'

const MS_PER_MINUTE = 60 * 1000
const DEFAULT_TOLERANCE_MINUTES = 120

/** Status de instância que aparecem na timeline (skipped_* são neutros → ocultos). */
const VISIBLE_INSTANCE_STATUSES = new Set(['taken', 'missed', 'pending'])

/**
 * Resolve o instante absoluto de uma instância:
 * - `taken` com log ancorado → o instante REAL da tomada (`taken_at`);
 * - demais → o horário agendado (`scheduled_for`).
 */
function instanceOccurredAt(instance, linkedLog) {
  if (instance.status === 'taken' && linkedLog?.taken_at) return linkedLog.taken_at
  return instance.scheduled_for
}

/**
 * IDs de logs já "consumidos" por uma instância: elo direto na instância
 * (medicine_log_id) OU elo inverso no log (dose_instance_id). Bidirecional (AP-185).
 */
function collectConsumedLogIds(instances, logs) {
  const consumed = new Set()
  for (const inst of instances) {
    if (inst.medicine_log_id) consumed.add(inst.medicine_log_id)
  }
  for (const log of logs) {
    if (log.dose_instance_id) consumed.add(log.id)
  }
  return consumed
}

/** Enriquecimento opcional de payload (medicine name/unit) a partir do mapa de protocolos. */
function makeEnricher(protocolsById) {
  return (protocolId) => {
    const p = protocolsById[protocolId]
    if (!p) return {}
    return {
      medicineName: p.medicine?.name ?? p.medicine_name ?? null,
      dosageUnit: p.dosage_unit ?? p.medicine?.dosage_unit ?? null,
    }
  }
}

/** Constrói o evento de uma instância visível (taken/missed/pending). */
function instanceToEvent(inst, logById, enrich) {
  const linkedLog = inst.medicine_log_id ? logById.get(inst.medicine_log_id) : null
  return {
    id: `inst:${inst.id}`,
    type: TIMELINE_EVENT_TYPES.DOSE,
    occurred_at: instanceOccurredAt(inst, linkedLog),
    payload: {
      source: 'instance',
      instanceId: inst.id,
      protocolId: inst.protocol_id,
      status: inst.status,
      scheduledFor: inst.scheduled_for,
      expectedDose: inst.expected_dose ?? null,
      toleranceMinutes: inst.tolerance_minutes ?? null,
      logId: inst.medicine_log_id ?? null,
      medicineId: linkedLog?.medicine_id ?? null,
      quantityTaken: linkedLog?.quantity_taken ?? null,
      notes: linkedLog?.notes ?? null,
      injectionSite: linkedLog?.injection_site ?? null,
      ...enrich(inst.protocol_id),
    },
  }
}

/** Constrói o evento de um log avulso (PRN/freeform, sem instância representativa). */
function logToEvent(log, enrich) {
  return {
    id: `log:${log.id}`,
    type: TIMELINE_EVENT_TYPES.DOSE,
    occurred_at: log.taken_at,
    payload: {
      source: 'log',
      logId: log.id,
      protocolId: log.protocol_id ?? null,
      status: 'taken',
      medicineId: log.medicine_id ?? null,
      quantityTaken: log.quantity_taken ?? null,
      notes: log.notes ?? null,
      injectionSite: log.injection_site ?? null,
      ...enrich(log.protocol_id),
    },
  }
}

/**
 * Adapter PURO: `dose_instances` + `medicine_logs` → `TimelineEvent[]` (`type='dose'`).
 *
 * @param {Array<Object>} instances - linhas de dose_instances (repo.getWindow).
 * @param {Array<Object>} logs - linhas de medicine_logs na mesma janela.
 * @param {Object} [opts]
 * @param {Object<string,Object>} [opts.protocolsById] - mapa p/ enriquecer payload
 *        (medicine name/unit). Opcional — UI também resolve via contexto.
 * @returns {import('../utils/timeline.js').TimelineEvent[]}
 */
export function doseInstancesToEvents(instances, logs, { protocolsById = {} } = {}) {
  const safeInstances = Array.isArray(instances) ? instances : []
  const safeLogs = Array.isArray(logs) ? logs : []
  const logById = new Map(safeLogs.map((l) => [l.id, l]))
  const enrich = makeEnricher(protocolsById)
  const consumedLogIds = collectConsumedLogIds(safeInstances, safeLogs)

  // Slots representados por instância visível, indexados por protocol_id (p/ dedupe
  // defensivo de avulsos, AP-193). Map por protocolo evita varrer todos os slots por
  // log avulso — busca fica limitada aos slots do mesmo protocolo (Gemini #620).
  const slotsByProtocol = new Map()
  const events = []
  for (const inst of safeInstances) {
    if (!VISIBLE_INSTANCE_STATUSES.has(inst.status)) continue
    events.push(instanceToEvent(inst, logById, enrich))
    // Slots de tolerância temporal só para pending/missed: protegem contra race-condition
    // (log sem dose_instance_id que deveria ter). Instâncias 'taken' já têm medicine_log_id
    // → collectConsumedLogIds cuida da dedupe. Construir slot para 'taken' causaria supressão
    // de segunda dose legítima no mesmo protocolo dentro da janela de tolerância (AP-193).
    if (inst.status === 'taken') continue
    if (!slotsByProtocol.has(inst.protocol_id)) slotsByProtocol.set(inst.protocol_id, [])
    slotsByProtocol.get(inst.protocol_id).push({
      ms: parseISO(inst.scheduled_for).getTime(),
      tolMs: (inst.tolerance_minutes ?? DEFAULT_TOLERANCE_MINUTES) * MS_PER_MINUTE,
    })
  }

  const isCoveredBySlot = (log) => {
    const slots = slotsByProtocol.get(log.protocol_id)
    if (!slots || slots.length === 0) return false
    const takenMs = parseISO(log.taken_at).getTime()
    return slots.some((s) => Math.abs(s.ms - takenMs) <= s.tolMs)
  }

  // Logs avulsos: sem elo (nenhuma direção) E não cobertos por slot representado.
  for (const log of safeLogs) {
    if (consumedLogIds.has(log.id) || !log.taken_at || isCoveredBySlot(log)) continue
    events.push(logToEvent(log, enrich))
  }

  return events
}

/**
 * Adapter PURO: `biomarkers_log` → `TimelineEvent[]` (`type='biomarker'`). Entra ao lado do
 * adapter de dose (FP-3/ADR-060) sem tocar o builder nem a UI de dose. Sem FK rígido com dose —
 * correlação só temporal (occurred_at = measured_at). SaMD: nenhum valor de meta/qualidade aqui.
 *
 * @param {Array<Object>} biomarkers - linhas de biomarkers_log (repo.list).
 * @returns {import('../utils/timeline.js').TimelineEvent[]}
 */
export function biomarkersToEvents(biomarkers) {
  const safe = Array.isArray(biomarkers) ? biomarkers : []
  const events = []
  for (const b of safe) {
    if (!b?.measured_at) continue // sem instante não ordena (descarta defensivo)
    events.push({
      id: `bio:${b.id}`,
      type: TIMELINE_EVENT_TYPES.BIOMARKER,
      occurred_at: b.measured_at,
      payload: {
        source: 'biomarker',
        biomarkerId: b.id,
        biomarkerType: b.type,
        value: b.value,
        valueSecondary: b.value_secondary ?? null,
        unit: b.unit,
        context: b.context ?? null,
        notes: b.notes ?? null,
      },
    })
  }
  return events
}

const LOGS_TABLE = 'medicine_logs'
const LOG_PAGE_SIZE = 1000

/**
 * Busca medicine_logs de um usuário na janela [fromIso, toIso] por keyset em `id`
 * (AP-186: PostgREST trunca em ~1000 sem paginação).
 */
async function fetchLogsWindow(client, userId, fromIso, toIso) {
  const out = []
  let lastId = null
  for (;;) {
    let q = client
      .from(LOGS_TABLE)
      .select(
        'id, protocol_id, medicine_id, taken_at, quantity_taken, notes, dose_instance_id, injection_site'
      )
      .eq('user_id', userId)
      .gte('taken_at', fromIso)
      .lte('taken_at', toIso)
      .order('id', { ascending: true })
      .limit(LOG_PAGE_SIZE)
    if (lastId) q = q.gt('id', lastId)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < LOG_PAGE_SIZE) break
    lastId = data[data.length - 1].id
  }
  return out
}

/**
 * Factory do serviço de leitura da timeline. Injeta o client Supabase (web/mobile/server).
 * @param {Object} deps
 * @param {Object} deps.client - Cliente Supabase.
 */
export function createTimelineService({ client }) {
  if (!client) throw new Error('createTimelineService: client é obrigatório')
  const doseInstanceRepo = createDoseInstanceRepository({ client })

  return {
    /**
     * Lê a timeline de um usuário numa janela absoluta [fromTs, toTs].
     *
     * Limites de janela em UTC real (AP-194): o caller monta `fromTs`/`toTs` com
     * `getServerTimestamp()` + `addDays`, nunca com wall-clock SP. O `tz` aqui só
     * governa a derivação do dia local p/ exibição (cross-meia-noite), nunca o filtro.
     *
     * Não dispara lazy-net de geração: timeline lê o passado já materializado
     * (ensureInstancesUpTo é p/ janela futura — irrelevante aqui).
     *
     * @param {Object} args
     * @param {string} args.userId
     * @param {Date|string} args.fromTs - limite inferior (UTC real)
     * @param {Date|string} args.toTs - limite superior (UTC real)
     * @param {string} [args.tz='America/Sao_Paulo'] - fuso p/ derivar dia local
     * @param {'asc'|'desc'} [args.order=TIMELINE_ORDER.DESC]
     * @param {Object<string,Object>} [args.protocolsById] - enriquecimento opcional
     * @returns {Promise<import('../utils/timeline.js').TimelineEvent[]>}
     */
    async getTimeline({ userId, fromTs, toTs, tz = 'America/Sao_Paulo', order = TIMELINE_ORDER.DESC, protocolsById = {} }) {
      if (!userId) throw new Error('getTimeline: userId é obrigatório')
      const fromIso = parseISO(fromTs).toISOString()
      const toTsIso = parseISO(toTs).toISOString()

      const [instances, logs] = await Promise.all([
        doseInstanceRepo.getWindow(userId, fromIso, toTsIso),
        fetchLogsWindow(client, userId, fromIso, toTsIso),
      ])

      const events = doseInstancesToEvents(instances, logs, { protocolsById })
      return buildTimeline(events, { tz, order })
    },
  }
}
