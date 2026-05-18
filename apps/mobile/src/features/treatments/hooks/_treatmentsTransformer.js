// isProtocolInPeriod (period-only) em vez de isProtocolActiveOnDate (strict
// adherence-aware). Listagem agrupada inclui quando_necessário, semanal, etc.
import { getTodayLocal, isProtocolInPeriod, resolveTreatmentStatus, TREATMENT_STATUS } from '@dosiq/core'

export function groupTreatmentsByPlanOrClass(data) {
  if (!data) return null
  const today = getTodayLocal()

  const validProtocols = data
    .filter(p => isProtocolInPeriod(p, today))
    .sort((a, b) => {
      const timeA = (a.time_schedule && a.time_schedule[0]) || '99:99'
      const timeB = (b.time_schedule && b.time_schedule[0]) || '99:99'
      return timeA.localeCompare(timeB)
    })

  const groupsMap = {}

  validProtocols.forEach(p => {
    let groupId, groupName, groupEmoji, groupColor

    if (p.treatment_plan) {
      groupId = p.treatment_plan.id
      groupName = p.treatment_plan.name
      groupEmoji = p.treatment_plan.emoji
      groupColor = p.treatment_plan.color
    } else if (p.medicine?.therapeutic_class) {
      groupId = `class-${p.medicine.therapeutic_class}`
      groupName = p.medicine.therapeutic_class
      groupEmoji = '🧪'
      groupColor = '#94a3b8'
    } else {
      groupId = 'general'
      groupName = 'Outros Tratamentos'
      groupEmoji = '💊'
      groupColor = '#cbd5e1'
    }

    if (!groupsMap[groupId]) {
      groupsMap[groupId] = {
        id: groupId,
        title: groupName,
        emoji: groupEmoji,
        color: groupColor,
        protocols: []
      }
    }
    groupsMap[groupId].protocols.push(p)
  })

  return Object.values(groupsMap).sort((a, b) => {
    if (a.id === 'general') return 1
    if (b.id === 'general') return -1
    return a.title.localeCompare(b.title)
  })
}

/**
 * Transformer principal (Fase 2.5 T5).
 * Anota cada protocol com `tabStatus` + `endDate`, separa em 3 listas,
 * agrupa apenas ativos por plano/classe, e computa counts.
 *
 * @param {any[]|null} rawData — lista bruta de protocols do service
 * @returns {{
 *   data: any[],          // ativos (compat com callsites existentes via useTreatments)
 *   ativos: any[],
 *   pausados: any[],
 *   finalizados: any[],
 *   counts: { ativos: number, pausados: number, finalizados: number },
 *   groups: object[]|null // agrupamento dos ativos (igual a groupTreatmentsByPlanOrClass)
 * }}
 */
export function transformTreatments(rawData) {
  const empty = { data: [], ativos: [], pausados: [], finalizados: [], counts: { ativos: 0, pausados: 0, finalizados: 0 }, groups: null }
  if (!rawData) return empty

  const activeItems = []
  const pausedItems = []
  const finishedItems = []

  rawData.forEach(protocol => {
    const tabStatus = resolveTreatmentStatus(protocol)
    const enriched = { ...protocol, tabStatus, endDate: protocol.end_date ?? null }

    if (tabStatus === TREATMENT_STATUS.FINALIZADO) {
      finishedItems.push(enriched)
    } else if (tabStatus === TREATMENT_STATUS.PAUSADO) {
      pausedItems.push(enriched)
    } else {
      activeItems.push(enriched)
    }
  })

  const counts = {
    ativos: activeItems.length,
    pausados: pausedItems.length,
    finalizados: finishedItems.length,
  }

  // Agrupamento por plano/classe apenas para ativos
  const groups = groupTreatmentsByPlanOrClass(activeItems)

  return {
    data: activeItems,
    ativos: activeItems,
    pausados: pausedItems,
    finalizados: finishedItems,
    counts,
    groups,
  }
}
