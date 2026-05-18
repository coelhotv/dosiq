// isProtocolInPeriod (period-only) em vez de isProtocolActiveOnDate (strict
// adherence-aware). Listagem agrupada inclui quando_necessário, semanal, etc.
import { getTodayLocal, isProtocolInPeriod } from '@dosiq/core'

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
