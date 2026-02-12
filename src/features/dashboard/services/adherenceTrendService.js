/**
 * Adherence Trend Service - Cálculo de tendência de adesão
 * 
 * Funcionalidades:
 * - Cálculo de variação percentual entre semanas
 * - Direção de tendência (up, down, neutral)
 * - Magnitude da variação para emojis
 * 
 * @module adherenceTrendService
 */

import { adherenceService } from '@adherence/services/adherenceService'

/**
 * Configurações de threshold para tendência
 */
const TREND_THRESHOLD = 5 // Variação mínima para considerar tendência
const MAGNITUDE_THRESHOLD = 15 // Variação grande para emoji diferenciado

/**
 * Calcula a tendência de adesão entre semanas
 * @param {Array} currentWeekData - Dados de adesão da semana atual
 * @param {Array} previousWeekData - Dados de adesão da semana anterior
 * @returns {Object} - { percentage: number, direction: 'up'|'down'|'neutral', magnitude: number }
 */
export function calculateTrendPercentage(currentWeekData, previousWeekData) {
  // Edge case: dados insuficientes
  if (!currentWeekData || currentWeekData.length === 0) {
    return { percentage: 0, direction: 'neutral', magnitude: 0 }
  }

  // Se não há dados da semana anterior
  if (!previousWeekData || previousWeekData.length === 0) {
    return { percentage: 0, direction: 'neutral', magnitude: 0 }
  }

  // Calcular médias
  const currentAvg = currentWeekData.reduce((sum, d) => sum + (d.adherence || 0), 0) / currentWeekData.length
  const previousAvg = previousWeekData.reduce((sum, d) => sum + (d.adherence || 0), 0) / previousWeekData.length

  // Calcular variação percentual
  const percentageChange = previousAvg > 0
    ? ((currentAvg - previousAvg) / previousAvg) * 100
    : 0

  // Determinar direção
  let direction = 'neutral'
  if (percentageChange > TREND_THRESHOLD) {
    direction = 'up'
  } else if (percentageChange < -TREND_THRESHOLD) {
    direction = 'down'
  }

  // Determinar magnitude (para emoji)
  const magnitude = Math.abs(Math.round(percentageChange))

  return {
    percentage: Math.min(magnitude, 100), // Cap em 100%
    direction,
    magnitude
  }
}

/**
 * Busca dados de adesão e calcula tendência
 * @param {number} weeks - Número de semanas para buscar (padrão: 2)
 * @returns {Promise<Object>} - Dados de tendência
 */
export async function getAdherenceTrend(weeks = 2) {
  try {
    // Buscar dados de adesão para o período especificado
    const days = weeks * 7
    const dailyAdherence = await adherenceService.getDailyAdherence(days)

    if (!dailyAdherence || dailyAdherence.length < 7) {
      return {
        percentage: 0,
        direction: 'neutral',
        magnitude: 0,
        hasPreviousWeek: false
      }
    }

    // Separar semana atual e semana anterior
    const currentWeek = dailyAdherence.slice(-7)
    const previousWeek = dailyAdherence.slice(-14, -7)

    const trend = calculateTrendPercentage(currentWeek, previousWeek)

    return {
      ...trend,
      hasPreviousWeek: previousWeek.length > 0
    }
  } catch (error) {
    console.error('Erro ao calcular tendência de adesão:', error)
    return {
      percentage: 0,
      direction: 'neutral',
      magnitude: 0,
      error: error.message
    }
  }
}

/**
 * Retorna o emoji baseado na direção e magnitude
 * @param {string} direction - Direção da tendência
 * @param {number} magnitude - Magnitude da variação
 * @returns {string} - Emoji formatado
 */
export function getTrendEmoji(direction, magnitude) {
  if (direction === 'neutral' || magnitude === 0) {
    return '→'
  }

  if (direction === 'up') {
    if (magnitude >= MAGNITUDE_THRESHOLD) {
      return '↑↑'
    }
    return '↑'
  }

  if (direction === 'down') {
    if (magnitude >= MAGNITUDE_THRESHOLD) {
      return '↓↓'
    }
    return '↓'
  }

  return '→'
}

/**
 * Retorna label legível para a tendência
 * @param {string} direction - Direção da tendência
 * @param {number} percentage - Porcentagem
 * @returns {string} - Label formatada
 */
export function getTrendLabel(direction, percentage) {
  if (direction === 'neutral' || percentage === 0) {
    return '→ 0%'
  }

  const sign = direction === 'up' ? '+' : ''
  return `${getTrendEmoji(direction, percentage)} ${sign}${percentage}%`
}

export default {
  calculateTrendPercentage,
  getAdherenceTrend,
  getTrendEmoji,
  getTrendLabel
}
