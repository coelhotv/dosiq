/**
 * milestoneService.js - Serviço de gerenciamento de milestones e conquistas
 * 
 * Funcionalidades:
 * - Detecção de milestones de streak
 * - Persistência em localStorage
 * - Prevenção de celebrações duplicadas
 */

const STORAGE_KEY = 'mr_milestones'

// Definição de milestones
export const MILESTONES = {
  streak_3: {
    id: 'streak_3',
    name: 'Primeiros Passos',
    description: '3 dias consecutivos',
    type: 'streak',
    threshold: 3,
    badge: 'bronze',
    icon: '🥉'
  },
  streak_7: {
    id: 'streak_7',
    name: 'Uma Semana',
    description: '7 dias consecutivos',
    type: 'streak',
    threshold: 7,
    badge: 'silver',
    icon: '🥈'
  },
  streak_14: {
    id: 'streak_14',
    name: 'Duas Semanas',
    description: '14 dias consecutivos',
    type: 'streak',
    threshold: 14,
    badge: 'gold',
    icon: '🥇'
  },
  streak_30: {
    id: 'streak_30',
    name: 'Um Mês Forte',
    description: '30 dias consecutivos',
    type: 'streak',
    threshold: 30,
    badge: 'diamond',
    icon: '💎'
  },
  streak_90: {
    id: 'streak_90',
    name: 'Disciplina Suprema',
    description: '90 dias consecutivos',
    type: 'streak',
    threshold: 90,
    badge: 'platinum',
    icon: '👑'
  },
  adherence_week_100: {
    id: 'adherence_week_100',
    name: 'Semana Perfeita',
    description: '100% de adesão por 7 dias',
    type: 'adherence',
    threshold: 100,
    badge: 'gold',
    icon: '⭐'
  }
}

/**
 * Obtém milestones já conquistados
 */
export function getAchievedMilestones() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Salva milestone conquistado
 */
export function saveMilestone(milestoneId) {
  try {
    const achieved = getAchievedMilestones()
    if (!achieved.includes(milestoneId)) {
      achieved.push(milestoneId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(achieved))
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Verifica novos milestones baseado em stats
 * Retorna array de milestones recém-conquistados
 */
export function checkNewMilestones(stats) {
  const newMilestones = []
  const achieved = getAchievedMilestones()

  // Verificar streaks
  Object.values(MILESTONES).forEach(milestone => {
    if (achieved.includes(milestone.id)) return

    let shouldTrigger = false

    if (milestone.type === 'streak') {
      shouldTrigger = stats.currentStreak >= milestone.threshold
    } else if (milestone.type === 'adherence') {
      shouldTrigger = stats.adherence === milestone.threshold
    }

    if (shouldTrigger) {
      saveMilestone(milestone.id)
      newMilestones.push(milestone)
    }
  })

  return newMilestones
}

/**
 * Reseta todos os milestones (para testes)
 */
export function resetMilestones() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
