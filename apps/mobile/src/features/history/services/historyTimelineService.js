// historyTimelineService.js — adapter mobile para o timeline do histórico (spec 033).
// Service-first, screen-second (MASTER_PLAN D2). Envolve o core createTimelineService
// e adiciona: enriquecimento de protocolos (GAP-3), merge de biomarkers (GAP-1, best-effort)
// e anti-corruption layer mapToMobileShape (GAP-2: camelCase core → flat snake_case UI).

import {
  createTimelineService,
  biomarkersToEvents,
  buildTimeline,
  TIMELINE_ORDER,
  parseISO,
  getTodayLocal,
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { measuresRepo } from '../../measures/services/measuresRepo'


// Dias padrão da janela de histórico (espelha constantes do hook)
const HISTORY_PAST_DAYS = 30
const HISTORY_FUTURE_DAYS = 7

// Desloca uma data YYYY-MM-DD em N dias (safe, ignora UTC drift usando T12:00:00)
function shiftDateStr(dateStr, days) {
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Constrói mapa rico de protocolos para enriquecimento (GAP-3).
// Inclui campos extras além do enricher core (dosage_per_pill, dosage_per_intake, intake_unit, protocol_name).
// Formato compatível com makeEnricher do core (p.medicine?.name, p.medicine?.dosage_unit).
export async function buildProtocolsById(userId) {
  const { data, error } = await supabase
    .from('protocols')
    .select('id, name, medicine_id, dosage_per_intake, intake_unit, medicine:medicines(name, dosage_per_pill, dosage_unit, units_per_ml), treatment_plan:treatment_plans(name)')
    .eq('user_id', userId)

  if (error || !data) return {}

  const map = {}
  data.forEach(p => { map[p.id] = p })
  return map
}

// Anti-corruption layer (GAP-2): TimelineEvent (camelCase aninhado) → shape flat snake_case
// consumido por DoseHistoryList / DoseActionSheet (spec 030). Não expõe TimelineEvent cru à UI.
function _mapBiomarkerEvent(ev) {
  const p = ev.payload
  return {
    id: ev.id,
    type: 'biomarker',
    occurred_at: ev.occurred_at,
    localDay: ev.localDay,
    measured_at: ev.occurred_at,
    bioType: p.biomarkerType,
    value: p.value,
    value_secondary: p.valueSecondary ?? null,
    unit: p.unit,
    context: p.context ?? null,
    notes: p.notes ?? null,
    biomarkerId: p.biomarkerId,
  }
}

function _getMedicineName(p, proto, med) {
  return p.medicineName || med.name || proto.name || null
}

function _getDosagePerIntake(p, proto) {
  return proto.dosage_per_intake || p.expectedDose || null
}

function _getDosageUnit(p, med) {
  return p.dosageUnit || med.dosage_unit || null
}

function _getMedicineId(p, proto) {
  return p.medicineId || proto.medicine_id || null
}

function _getProtocolProperties(p, proto, med) {
  return {
    medicine_name: _getMedicineName(p, proto, med),
    protocol_name: p.protocolName || proto.name || null,
    dosage_per_pill: med.dosage_per_pill || null,
    dosage_per_intake: _getDosagePerIntake(p, proto),
    intake_unit: proto.intake_unit || null,
    dosage_unit: _getDosageUnit(p, med),
    units_per_ml: med.units_per_ml || null,
  }
}

function _mapDoseEvent(ev, protocolsById) {
  const p = ev.payload || {}
  const proto = (p.protocolId && protocolsById[p.protocolId]) || {}
  const med = proto.medicine || {}
  return {
    id: ev.id,
    type: 'dose',
    occurred_at: ev.occurred_at,
    localDay: ev.localDay,
    status: p.status,
    source: p.source,
    scheduled_for: p.scheduledFor || ev.occurred_at,
    taken_at: p.takenAt || null,
    ..._getProtocolProperties(p, proto, med),
    quantity_taken: p.quantityTaken || null,
    medicine_id: _getMedicineId(p, proto),
    protocol_id: p.protocolId || null,
    is_orphan: p.source === 'log',
    logId: p.logId || null,
    instanceId: p.instanceId || null,
  }
}

export function mapToMobileShape(events, protocolsById = {}) {
  return events.map(ev => {
    if (ev.type === 'biomarker') {
      return _mapBiomarkerEvent(ev)
    }
    return _mapDoseEvent(ev, protocolsById)
  })
}

// Ponto de entrada principal. Retorna itens flat (dose | biomarker) ordenados por occurred_at ASC.
// Biomarkers: best-effort — falha não derruba doses (espelha padrão web getMonthTimeline).
export async function getHistoryTimeline(userId, {
  pastDays = HISTORY_PAST_DAYS,
  futureDays = HISTORY_FUTURE_DAYS,
  tz = 'America/Sao_Paulo',
} = {}) {
  const today = getTodayLocal()
  // Janela expandida ±1 dia em UTC (AP-194: nunca wall-clock local para filtro)
  const fromTs = shiftDateStr(today, -(pastDays + 1)) + 'T00:00:00Z'
  const toTs   = shiftDateStr(today, futureDays + 1)  + 'T23:59:59Z'

  const protocolsById = await buildProtocolsById(userId)

  const coreTimeline = createTimelineService({ client: supabase })
  const doseEvents = await coreTimeline.getTimeline({
    userId,
    fromTs,
    toTs,
    tz,
    order: TIMELINE_ORDER.ASC,
    protocolsById,
  })

  let events = doseEvents
  try {
    const bioRows = await measuresRepo.list({ fromTs, toTs })
    if (bioRows && bioRows.length > 0) {
      const bioEvents = biomarkersToEvents(bioRows)
      events = buildTimeline([...doseEvents, ...bioEvents], { tz, order: TIMELINE_ORDER.ASC })
    }
  } catch (err) {
    console.error('[historyTimelineService] merge biomarcadores falhou:', err?.message)
  }

  return mapToMobileShape(events, protocolsById)
}
