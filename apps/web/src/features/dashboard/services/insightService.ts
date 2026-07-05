/**
 * Insight Service - Geração e seleção de insights contextuais
 *
 * Funcionalidades:
 * - Geração de insights baseados em dados do usuário
 * - Sistema de prioridade (critical > important > informational)
 * - Frequency capping para evitar repetição
 * - Persistência em localStorage
 * - Integração com analyticsService para insights baseados em padrões de uso
 *
 * @module insightService
 */

import { analyticsService } from './analyticsService'
import { getNow, addDays, parseISO } from '@utils/dateUtils'
import { debugLog } from '@shared/utils/logger'
import {
  createStreakInsight,
  createPerfectWeekInsight,
  createGoodWeekInsight,
  createImprovementInsight,
  createStockHealthyInsight,
  createMissedDosesTodayInsight,
  createLowAdherenceInsight,
  createStreakBrokenInsight,
  createProtocolReminderInsight,
} from './_insightGenerators'

// Constantes para configuração do serviço
const STORAGE_KEY = 'mr_insight_history'
const MAX_HISTORY = 10
const MIN_DISPLAY_INTERVAL = 0 // 0 = sem frequency capping, rotate entre insights

// Prioridades de insight (menor número = maior prioridade)
export const INSIGHT_PRIORITY = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  info: 5,
}

// Tipos de insight disponíveis
export const INSIGHT_TYPES = {
  ADHERENCE_POSITIVE: 'ADHERENCE_POSITIVE',
  ADHERENCE_MOTIVATIONAL: 'ADHERENCE_MOTIVATIONAL',
  STREAK_CELEBRATION: 'STREAK_CELEBRATION',
  STOCK_WARNING: 'STOCK_WARNING',
  PROTOCOL_REMINDER: 'PROTOCOL_REMINDER',
  MISSED_DOSE_ALERT: 'MISSED_DOSE_ALERT',
  IMPROVEMENT_OPPORTUNITY: 'IMPROVEMENT_OPPORTUNITY',
}

//=============================================================================
// FUNÇÕES DE ANALYTICS (Capítulo 10)
//=============================================================================

/**
 * Determina o horário de maior atividade do usuário
 * @returns {Object|null} { hour: number, count: number } ou null
 */
function getMostActiveHour() {
  try {
    const sevenDaysAgo = addDays(getNow(), -7)
    const doseEvents = analyticsService.getEvents({
      name: 'dose_registered',
      since: sevenDaysAgo,
    })

    if (doseEvents.length === 0) return null

    const hourCounts: Record<string, number> = {}
    doseEvents.forEach((event) => {
      // M9.0: Extrair hora no fuso de SP
      const date = parseISO(event.timestamp)
      const hour = parseInt(date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }), 10)
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const mostActiveEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    if (!mostActiveEntry) return null

    return {
      hour: parseInt(mostActiveEntry[0]),
      count: mostActiveEntry[1],
    }
  } catch {
    console.error('[InsightService] Erro ao buscar horário de maior atividade')
    return null
  }
}

/**
 * Formata horário para exibição
 * @param {number} hour - Hora no formato 24h
 * @returns {string} - Horário formatado
 */
function formatHour(hour) {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'da manhã' : hour < 18 ? 'da tarde' : 'da noite'
  return `${h}h ${ampm}`
}

/**
 * Analisa adesão por dia da semana
 * @returns {Object} { bestDay: string, worstDay: string, bestCount: number, worstCount: number }
 */
function getAdherenceByDayOfWeek() {
  try {
    const thirtyDaysAgo = addDays(getNow(), -30)
    const doseEvents = analyticsService.getEvents({
      name: 'dose_registered',
      since: thirtyDaysAgo,
    })

    if (doseEvents.length === 0) return null

    const dayCounts: Record<string, number> = {}
    doseEvents.forEach((event) => {
      // M9.0: Fixar fuso de Brasília para determinar dia da semana real
      const day = parseISO(event.timestamp).toLocaleDateString('pt-BR', { 
        weekday: 'long',
        timeZone: 'America/Sao_Paulo'
      })
      dayCounts[day] = (dayCounts[day] || 0) + 1
    })

    const sorted = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])

    if (sorted.length === 0) return null

    return {
      bestDay: sorted[0]?.[0] || null,
      worstDay: sorted[sorted.length - 1]?.[0] || null,
      bestCount: sorted[0]?.[1] || 0,
      worstCount: sorted[sorted.length - 1]?.[1] || 0,
    }
  } catch {
    console.error('[InsightService] Erro ao analisar adesão por dia')
    return null
  }
}

//=============================================================================
// FUNÇÕES DE CRIAÇÃO DE INSIGHTS
//=============================================================================

/**
 * Cria insight sobre melhor horário para lembretes (baseado em analytics)
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null} Insight ou null
 */
function createBestTimeInsight(onNavigate) {
  const mostActive = getMostActiveHour()

  if (!mostActive || mostActive.count < 3) return null

  const timeLabel = formatHour(mostActive.hour)

  return {
    id: 'best_time',
    type: INSIGHT_TYPES.IMPROVEMENT_OPPORTUNITY,
    priority: 'info',
    icon: '🕐',
    text: `Você costuma registrar doses às ${timeLabel}. Considere agendar mais avisos neste horário!`,
    highlight: timeLabel,
    actionLabel: 'Configurar Avisos',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'best_time' })
      onNavigate?.('inbox')
    },
  }
}

function createWeakDayInsight(onNavigate) {
  const dayAnalysis = getAdherenceByDayOfWeek()

  if (!dayAnalysis || !dayAnalysis.worstDay || dayAnalysis.bestCount === 0) return null

  if (dayAnalysis.worstCount > 0 && dayAnalysis.worstCount < dayAnalysis.bestCount * 0.5) {
    return {
      id: 'weak_day',
      type: INSIGHT_TYPES.ADHERENCE_MOTIVATIONAL,
      priority: 'medium',
      icon: '📅',
      text: `Sua adesão é menor aos ${dayAnalysis.worstDay}. Configure avisos extras para este dia!`,
      highlight: dayAnalysis.worstDay,
      actionLabel: 'Configurar Avisos',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'weak_day' })
        onNavigate?.('inbox')
      },
    }
  }

  return null
}

/**
 * Gera todos os insights possíveis baseados nos dados do usuário
 * @param {Object} params - Parâmetros de dados do usuário
 * @returns {Array} - Lista de insights aplicáveis
 */
export function generateAllInsights({ stats, dailyAdherence, stockSummary, logs, onNavigate }) {
  const trend = calculateTrendFromData(dailyAdherence)
  const todayMissed = countTodayMissedDoses(logs, dailyAdherence)

  const generators = [
    () => createStreakInsight(stats, onNavigate),
    () => createPerfectWeekInsight(stats, onNavigate),
    () => createGoodWeekInsight(stats, onNavigate),
    () => createImprovementInsight(trend, onNavigate),
    () => createStockHealthyInsight(stockSummary, onNavigate),
    () => createMissedDosesTodayInsight(todayMissed),
    () => createLowAdherenceInsight(stats, onNavigate),
    () => createStreakBrokenInsight(stats),
    () => createProtocolReminderInsight(stats, onNavigate),
    () => createBestTimeInsight(onNavigate),
    () => createWeakDayInsight(onNavigate),
  ]

  return generators
    .map((gen) => gen())
    .filter((insight) => insight !== null)
}

/**
 * Calcula tendência a partir dos dados diários
 * @param {Array} dailyAdherence - Dados de adesão diária
 * @returns {Object} - Tendência calculada
 */
function calculateTrendFromData(dailyAdherence) {
  if (!dailyAdherence || dailyAdherence.length < 7) {
    return { direction: 'neutral', percentage: 0 }
  }

  const currentWeek = dailyAdherence.slice(-7)
  const previousWeek = dailyAdherence.slice(-14, -7)

  if (previousWeek.length === 0) {
    return { direction: 'neutral', percentage: 0 }
  }

  const currentAvg = currentWeek.reduce((sum, d) => sum + d.adherence, 0) / currentWeek.length
  const previousAvg = previousWeek.reduce((sum, d) => sum + d.adherence, 0) / previousWeek.length

  const percentageChange = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0

  let direction = 'neutral'
  if (percentageChange > 5) direction = 'up'
  else if (percentageChange < -5) direction = 'down'

  return {
    direction,
    percentage: Math.abs(Math.round(percentageChange)),
  }
}

/**
 * Conta doses perdidas hoje
 * @param {Array} logs - Logs de doses
 * @param {Array} dailyAdherence - Dados de adesão diária
 * @returns {number} - Quantidade de doses perdidas
 */
function countTodayMissedDoses(logs, dailyAdherence) {
  if (!dailyAdherence || dailyAdherence.length === 0) return 0

  const today = dailyAdherence[dailyAdherence.length - 1]
  if (!today) return 0

  const taken = today.taken || 0
  const expected = today.expected || 0

  return Math.max(0, expected - taken)
}

//=============================================================================
// FUNÇÕES DE SELEÇÃO DE INSIGHTS
//=============================================================================

/**
 * Seleciona o melhor insight para exibir com rotação entre insights
 * @param {Object} params - Parâmetros de dados do usuário
 * @returns {Object} - Insight selecionado
 */
export function selectBestInsight(params) {
  const { excludeIds = [], ...rest } = params
  const insights = generateAllInsights(rest)

  const applicableInsights = insights.filter(
    (insight: any) => // TODO(040-strict)
      (insight.condition === undefined || insight.condition) &&
      !excludeIds.includes(insight.id)
  )

  if (applicableInsights.length === 0) {
    if (excludeIds.includes('default')) return null
    return getDefaultInsight()
  }

  const history = getInsightHistory()
  const lastShownId = history[0]?.id

  const differentInsights = applicableInsights.filter((i) => i.id !== lastShownId)
  const candidates = differentInsights.length > 0 ? differentInsights : applicableInsights

  // Ordenar por prioridade
  const sortedInsights = candidates.sort(
    (a, b) => INSIGHT_PRIORITY[a.priority] - INSIGHT_PRIORITY[b.priority]
  )

  const selectedInsight = sortedInsights[0]

  // Rastrear insight mostrado
  try {
    analyticsService.track('insight_shown', {
      insight_id: selectedInsight.id,
      priority: selectedInsight.priority,
    })
  } catch (err) {
    console.error('[InsightService] Erro ao rastrear insight:', err)
  }

  // Salvar no histórico
  saveInsightToHistory(selectedInsight.id)

  return selectedInsight
}

/**
 * Retorna insight padrão quando não há insights aplicáveis
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object} - Insight padrão
 */
export function getDefaultInsight() {
  return {
    id: 'default',
    type: INSIGHT_TYPES.IMPROVEMENT_OPPORTUNITY,
    priority: 'info',
    icon: '💡',
    text: 'Continue registrando suas doses para manter o controle do seu tratamento.',
    highlight: '',
  }
}

/**
 * Verifica se um insight pode ser mostrado (frequency capping)
 * @param {string} insightId - ID do insight
 * @returns {boolean} - Se pode ser mostrado
 */
export function shouldShowInsight(insightId) {
  const history = getInsightHistory()
  const lastShown = history.find((h) => h.id === insightId)

  if (!lastShown) return true

  const timeSinceLastShown = getNow().getTime() - lastShown.timestamp
  return timeSinceLastShown >= MIN_DISPLAY_INTERVAL
}

/**
 * Obtém histórico de insights mostrados
 * @returns {Array} - Histórico de insights
 */
export function getInsightHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Salva insight no histórico
 * @param {string} insightId - ID do insight
 */
export function saveInsightToHistory(insightId) {
  try {
    const history = getInsightHistory()
    history.unshift({
      id: insightId,
      timestamp: getNow().getTime(),
    })

    const trimmedHistory = history.slice(0, MAX_HISTORY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory))
    debugLog('InsightService', 'Insight salvo no histórico:', insightId)
  } catch {
    console.warn('[InsightService] Erro ao salvar histórico de insights')
  }
}

/**
 * Limpa histórico de insights
 */
export function clearInsightHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silenciar erro
  }
}


export default {
  generateAllInsights,
  selectBestInsight,
  getDefaultInsight,
  shouldShowInsight,
  getInsightHistory,
  saveInsightToHistory,
  clearInsightHistory,
  INSIGHT_PRIORITY,
  INSIGHT_TYPES,
}
