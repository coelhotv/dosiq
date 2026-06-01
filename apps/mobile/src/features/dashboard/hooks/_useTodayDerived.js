import { useMemo } from 'react'
import {
  getTodayLocal,
  parseISO,
  computeAdherenceFromInstances,
  addDays,
  getRawNow,
  getStartOfDayISO,
  getEndOfDayISO,
  buildDoseItemsFromInstances,
  classifyDose,
  DEFAULT_TZ,
} from '@dosiq/core'

/**
 * Mapeia o estado real da ocorrência (`dose_instances.status` + zona temporal) para
 * o rótulo de timeline consumido pelo card. Espelha o web (R-166): a zona vem de
 * `classifyDose` pelo instante ABSOLUTO (`scheduled_for`), honrando a tolerância
 * dinâmica da ocorrência (não 120min fixo) — cross-meia-noite correto (AP-194).
 */
function toTimelineStatus(item, nowRaw) {
  if (item.isRegistered) return 'TOMADA'
  if (item.status === 'missed') return 'PERDIDA'
  const zone = classifyDose(item.scheduledFor, nowRaw, 120, 60, 240, false, item.toleranceMinutes)
  if (zone === 'late') return 'ATRASADA'
  if (zone === 'now') return 'PROXIMA'
  if (zone === 'upcoming' || zone === 'later') return 'PLANEJADA'
  // pending pós-tolerância (zona null): ainda não varrida p/ missed, mas fora do
  // actionável — exibe como PERDIDA (espelha o sweep markMissedDueInstances).
  return 'PERDIDA'
}

/**
 * Hook privado para derivação de dados do Dashboard Hoje.
 *
 * F4.3b: a timeline do dia passa a vir de `dose_instances` materializadas (status
 * real `taken`/`missed`/`pending` + `scheduled_for` absoluto) via core
 * `buildDoseItemsFromInstances`/`classifyDose` (CON-024), em paridade com o web e
 * com a adesão (F3.3). Sai a inferência ±2h sobre logs (`calculateDosesByDate`),
 * que reintroduzia slot fantasma cross-meia-noite e tolerância fixa. tz default SP
 * (residual G1 mobile — auto-detecção/expat é follow-up).
 */
export function useTodayDerived(data) {
  return useMemo(() => {
    if (!data) return null

    const todayStr = getTodayLocal()
    const nowRaw = getRawNow()
    const protocols = data.protocols || []
    const instances = data.doseInstances || []

    // 1. Timeline do dia ← dose_instances (status real, instante absoluto).
    // `data.doseInstances` traz a janela de 14d (p/ a tendência de adesão abaixo);
    // a timeline é só do DIA → filtrar pelas fronteiras do dia local (tz) antes do build,
    // senão renderiza as ocorrências dos dias anteriores (bug F4.3b smoke).
    const dayStart = parseISO(getStartOfDayISO(todayStr, DEFAULT_TZ)).getTime()
    const dayEnd = parseISO(getEndOfDayISO(todayStr, DEFAULT_TZ)).getTime()
    const todayInstances = instances.filter((i) => {
      if (!i?.scheduled_for) return false
      const t = parseISO(i.scheduled_for).getTime()
      return t >= dayStart && t <= dayEnd
    })
    const protocolById = new Map(protocols.filter(Boolean).map((p) => [p.id, p]))
    const doseItems = buildDoseItemsFromInstances(todayInstances, protocols, DEFAULT_TZ)
    const timeline = doseItems
      .map((item) => {
        const protocol = protocolById.get(item.protocolId) || null
        return {
          id: item.instanceId,
          instanceId: item.instanceId,
          scheduledTime: item.scheduledTime,
          scheduledFor: item.scheduledFor,
          status: item.status,
          isRegistered: item.isRegistered,
          timelineStatus: toTimelineStatus(item, nowRaw),
          protocol,
          medicine: protocol?.medicine || null,
        }
      })
      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))

    // 2. Estatísticas e tendências ← dose_instances (S3.6/ADR-054): adesão =
    // taken/(taken+missed), skipped_* neutro. Janela 7d (atual) vs 7d (anterior).
    // scheduled_for é instante absoluto; o filtro por dia local usa boundaries via addDays.
    const curStart = addDays(todayStr, -6).getTime()
    const curEnd = addDays(todayStr, 1).getTime()
    const prevStart = addDays(todayStr, -13).getTime()
    const prevEnd = curStart
    const inWindow = (inst, start, end) => {
      if (!inst?.scheduled_for) return false
      const t = parseISO(inst.scheduled_for).getTime()
      return t >= start && t < end
    }
    const curAgg = computeAdherenceFromInstances(instances.filter((i) => inWindow(i, curStart, curEnd)))
    const prevAgg = computeAdherenceFromInstances(instances.filter((i) => inWindow(i, prevStart, prevEnd)))
    const score = Math.round((curAgg.rate ?? 0) * 100)
    const prevScore = Math.round((prevAgg.rate ?? 0) * 100)
    const hasPreviousData = (prevAgg.taken + prevAgg.missed) > 0

    const statsWithTrend = {
      taken: curAgg.taken,
      missed: curAgg.missed,
      expected: curAgg.taken + curAgg.missed,
      score,
      trend: hasPreviousData ? (score - prevScore) : 0,
      hasPreviousData,
    }

    // 3. Alertas de estoque
    const stockAlerts = Object.values(data.medicines || {})
      .filter((m) => m && (m.daysRemaining ?? Infinity) <= 7)
      .map((m) => ({
        medicineId: m.id,
        medicineName: m.name,
        daysRemaining: m.daysRemaining,
      }))

    return {
      ...data,
      stats: statsWithTrend,
      timeline,
      stockAlerts,
    }
  }, [data])
}
