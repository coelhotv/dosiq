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
  info: 5
}

// Tipos de insight disponíveis
export const INSIGHT_TYPES = {
  ADHERENCE_POSITIVE: 'ADHERENCE_POSITIVE',
  ADHERENCE_MOTIVATIONAL: 'ADHERENCE_MOTIVATIONAL',
  STREAK_CELEBRATION: 'STREAK_CELEBRATION',
  STOCK_WARNING: 'STOCK_WARNING',
  PROTOCOL_REMINDER: 'PROTOCOL_REMINDER',
  MISSED_DOSE_ALERT: 'MISSED_DOSE_ALERT',
  IMPROVEMENT_OPPORTUNITY: 'IMPROVEMENT_OPPORTUNITY'
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const doseEvents = analyticsService.getEvents({
      name: 'dose_registered',
      since: sevenDaysAgo
    })

    if (doseEvents.length === 0) return null

    const hourCounts = {}
    doseEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const mostActiveEntry = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0]

    if (!mostActiveEntry) return null

    return {
      hour: parseInt(mostActiveEntry[0]),
      count: mostActiveEntry[1]
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
 * Determina quais features o usuário mais utiliza
 * @returns {Object} { mostUsed: string, leastUsed: string }
 */
function getFeatureUsage() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const summary = analyticsService.getSummary({ since: thirtyDaysAgo })

    const featureEvents = {
      swipe_used: summary.eventCounts?.['swipe_used'] || 0,
      sparkline_tapped: summary.eventCounts?.['sparkline_tapped'] || 0,
      milestone_achieved: summary.eventCounts?.['milestone_achieved'] || 0
    }

    const sorted = Object.entries(featureEvents)
      .sort((a, b) => b[1] - a[1])

    return {
      mostUsed: sorted[0]?.[0] || null,
      leastUsed: sorted[sorted.length - 1]?.[0] || null
    }
  } catch {
    console.error('[InsightService] Erro ao buscar uso de features')
    return { mostUsed: null, leastUsed: null }
  }
}

/**
 * Analisa adesão por dia da semana
 * @returns {Object} { bestDay: string, worstDay: string, bestCount: number, worstCount: number }
 */
function getAdherenceByDayOfWeek() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const doseEvents = analyticsService.getEvents({
      name: 'dose_registered',
      since: thirtyDaysAgo
    })

    if (doseEvents.length === 0) return null

    const dayCounts = {}
    doseEvents.forEach(event => {
      const day = new Date(event.timestamp).toLocaleDateString('pt-BR', { weekday: 'long' })
      dayCounts[day] = (dayCounts[day] || 0) + 1
    })

    const sorted = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])

    if (sorted.length === 0) return null

    return {
      bestDay: sorted[0]?.[0] || null,
      worstDay: sorted[sorted.length - 1]?.[0] || null,
      bestCount: sorted[0]?.[1] || 0,
      worstCount: sorted[sorted.length - 1]?.[1] || 0
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
    text: `Você costuma registrar doses às ${timeLabel}. Considere agendar mais lembretes neste horário!`,
    highlight: timeLabel,
    actionLabel: 'Configurar Lembretes',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'best_time' })
      onNavigate?.('settings')
    }
  }
}

/**
 * Cria insight sobre feature não utilizada
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null} Insight ou null
 */
function createFeatureDiscoveryInsight(onNavigate) {
  const usage = getFeatureUsage()
  
  // Se usuário nunca usou sparkline mas usa swipe regularmente
  if (usage.leastUsed === 'sparkline_tapped' && usage.mostUsed === 'swipe_used') {
    return {
      id: 'feature_discovery_sparkline',
      type: INSIGHT_TYPES.IMPROVEMENT_OPPORTUNITY,
      priority: 'info',
      icon: '📊',
      text: 'Você sabia que pode tocar no gráfico de adesão para ver detalhes diários?',
      highlight: 'tocar no gráfico',
      actionLabel: 'Experimentar',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'feature_discovery_sparkline' })
        onNavigate?.('stats')
      }
    }
  }

  return null
}

/**
 * Cria insight sobre dia da semana com menor adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null} Insight ou null
 */
function createWeakDayInsight(onNavigate) {
  const dayAnalysis = getAdherenceByDayOfWeek()
  
  if (!dayAnalysis || !dayAnalysis.worstDay || dayAnalysis.bestCount === 0) return null

  // Se o pior dia tem significativamente menos doses (menos de 50% do melhor)
  if (dayAnalysis.worstCount > 0 && dayAnalysis.worstCount < dayAnalysis.bestCount * 0.5) {
    return {
      id: 'weak_day',
      type: INSIGHT_TYPES.ADHERENCE_MOTIVATIONAL,
      priority: 'medium',
      icon: '📅',
      text: `Sua adesão é menor aos ${dayAnalysis.worstDay}. Configure lembretes extras para este dia!`,
      highlight: dayAnalysis.worstDay,
      actionLabel: 'Configurar Lembretes',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'weak_day' })
        onNavigate?.('settings')
      }
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
  const insights = []

  // Insight: Celebração de Streak (threshold reduzido para ser mais inclusivo)
  if (stats.currentStreak >= 5) {
    insights.push({
      id: 'streak_achievement',
      type: INSIGHT_TYPES.STREAK_CELEBRATION,
      priority: 'low',
      icon: '🔥',
      text: `Você está em uma sequência de ${stats.currentStreak} dias! Continue assim!`,
      highlight: `${stats.currentStreak} dias`,
      actionLabel: 'Ver Histórico',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'streak_achievement' })
        onNavigate?.('history')
      }
    })
  }

  // Insight: Semana Perfeita
  if (stats.adherence === 100) {
    insights.push({
      id: 'perfect_week',
      type: INSIGHT_TYPES.ADHERENCE_POSITIVE,
      priority: 'low',
      icon: '⭐',
      text: 'Semana perfeita! 100% de adesão nos últimos 7 dias.',
      highlight: '100% de adesão',
      actionLabel: 'Compartilhar',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'perfect_week' })
        shareAchievement()
      }
    })
  }

  // Insight: Boa Semana (adesão >= 80%)
  if (stats.adherence >= 80 && stats.adherence < 100) {
    insights.push({
      id: 'good_week',
      type: INSIGHT_TYPES.ADHERENCE_POSITIVE,
      priority: 'low',
      icon: '👍',
      text: `Sua adesão esta semana está em ${Math.round(stats.adherence)}%. Muito bem! Continue assim!`,
      highlight: `${Math.round(stats.adherence)}%`,
      actionLabel: 'Ver Histórico',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'good_week' })
        onNavigate?.('history')
      }
    })
  }

  // Insight: Melhoria de Adesão
  const trend = calculateTrendFromData(dailyAdherence)
  if (trend.direction === 'up' && trend.percentage >= 10) {
    insights.push({
      id: 'improvement',
      type: INSIGHT_TYPES.ADHERENCE_POSITIVE,
      priority: 'low',
      icon: '📈',
      text: `Sua adesão melhorou ${trend.percentage}% em relação à semana anterior!`,
      highlight: `${trend.percentage}% melhor`,
      actionLabel: 'Ver Detalhes',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'improvement' })
        onNavigate?.('stats')
      }
    })
  }

  // Insight: Estoque Saudável
  const lowStockCount = stockSummary?.filter(s => s.isLow || s.isZero).length || 0
  if (lowStockCount === 0 && stockSummary?.length > 0) {
    insights.push({
      id: 'stock_healthy',
      type: INSIGHT_TYPES.ADHERENCE_POSITIVE,
      priority: 'info',
      icon: '✅',
      text: 'Todos os medicamentos com estoque saudável. Ótimo planejamento!',
      highlight: 'estoque saudável',
      actionLabel: 'Ver Estoque',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'stock_healthy' })
        onNavigate?.('stock')
      }
    })
  }

  // Insight: Doses Pendentes Hoje
  const todayMissed = countTodayMissedDoses(logs, dailyAdherence)
  if (todayMissed > 0 && todayMissed <= 2) {
    insights.push({
      id: 'missed_doses_today',
      type: INSIGHT_TYPES.ADHERENCE_MOTIVATIONAL,
      priority: 'medium',
      icon: '⏰',
      text: `Você tem ${todayMissed} doses pendentes hoje. Que tal completar agora?`,
      highlight: `${todayMissed} doses pendentes`,
      actionLabel: 'Registrar Doses',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'missed_doses_today' })
        onNavigate?.('register')
      }
    })
  }

  // Insight: Adesão Baixa (threshold ajustado para motivar users entre 50-80%)
  if (stats.adherence < 80 && stats.adherence > 0) {
    insights.push({
      id: 'low_adherence_week',
      type: INSIGHT_TYPES.ADHERENCE_MOTIVATIONAL,
      priority: 'medium',
      icon: '💪',
      text: `Sua adesão esta semana está em ${Math.round(stats.adherence)}%. Vamos melhorar juntos!`,
      highlight: `${Math.round(stats.adherence)}%`,
      actionLabel: 'Ver Protocolos',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'low_adherence_week' })
        onNavigate?.('protocols')
      }
    })
  }

  // Insight: Streak Quebrado
  if (stats.currentStreak === 0 && stats.longestStreak >= 3) {
    insights.push({
      id: 'streak_broken',
      type: INSIGHT_TYPES.ADHERENCE_MOTIVATIONAL,
      priority: 'high',
      icon: '🔄',
      text: `Seu streak foi interrompido. Seu recorde foi ${stats.longestStreak} dias. Recomece agora!`,
      highlight: `${stats.longestStreak} dias`,
      actionLabel: 'Registrar Dose',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'streak_broken' })
        onNavigate?.('register')
      }
    })
  }

  // Insight: Protocolos Ativos
  const activeProtocols = stats.activeProtocols || 0
  if (activeProtocols > 0 && activeProtocols <= 3) {
    insights.push({
      id: 'protocol_reminder',
      type: INSIGHT_TYPES.PROTOCOL_REMINDER,
      priority: 'info',
      icon: '📋',
      text: `Você tem ${activeProtocols} protocolo${activeProtocols > 1 ? 's' : ''} ativo${activeProtocols > 1 ? 's' : ''}. Todos em dia!`,
      highlight: `${activeProtocols} protocolo${activeProtocols > 1 ? 's' : ''}`,
      actionLabel: 'Ver Protocolos',
      onAction: () => {
        analyticsService.track('insight_action', { insight_id: 'protocol_reminder' })
        onNavigate?.('protocols')
      }
    })
  }

  // Insights Baseados em Analytics (Capítulo 10)
  const bestTimeInsight = createBestTimeInsight(onNavigate)
  if (bestTimeInsight) insights.push(bestTimeInsight)

  const featureDiscoveryInsight = createFeatureDiscoveryInsight(onNavigate)
  if (featureDiscoveryInsight) insights.push(featureDiscoveryInsight)

  const weakDayInsight = createWeakDayInsight(onNavigate)
  if (weakDayInsight) insights.push(weakDayInsight)

  return insights.filter(insight => insight !== null)
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

  const percentageChange = previousAvg > 0
    ? ((currentAvg - previousAvg) / previousAvg) * 100
    : 0

  let direction = 'neutral'
  if (percentageChange > 5) direction = 'up'
  else if (percentageChange < -5) direction = 'down'

  return {
    direction,
    percentage: Math.abs(Math.round(percentageChange))
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
  const insights = generateAllInsights(params)

  // Filtrar insights aplicáveis (sem frequency capping)
  const applicableInsights = insights.filter(insight =>
    insight.condition === undefined || insight.condition
  )

  if (applicableInsights.length === 0) {
    return getDefaultInsight(params.onNavigate)
  }

  // Rotacionar entre insights: tentar mostrar um diferente do último
  const history = getInsightHistory()
  const lastShownId = history[0]?.id

  // Filtrar para mostrar insight diferente do último
  const differentInsights = applicableInsights.filter(i => i.id !== lastShownId)
  const candidates = differentInsights.length > 0 ? differentInsights : applicableInsights

  // Ordenar por prioridade
  const sortedInsights = candidates.sort((a, b) =>
    INSIGHT_PRIORITY[a.priority] - INSIGHT_PRIORITY[b.priority]
  )

  const selectedInsight = sortedInsights[0]

  // Rastrear insight mostrado
  try {
    analyticsService.track('insight_shown', {
      insight_id: selectedInsight.id,
      priority: selectedInsight.priority
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
export function getDefaultInsight(onNavigate) {
  return {
    id: 'default',
    type: INSIGHT_TYPES.IMPROVEMENT_OPPORTUNITY,
    priority: 'info',
    icon: '💡',
    text: 'Continue registrando suas doses para manter o controle do seu tratamento.',
    highlight: '',
    actionLabel: 'Saiba mais',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'default' })
      onNavigate?.('help')
    }
  }
}

/**
 * Verifica se um insight pode ser mostrado (frequency capping)
 * @param {string} insightId - ID do insight
 * @returns {boolean} - Se pode ser mostrado
 */
export function shouldShowInsight(insightId) {
  const history = getInsightHistory()
  const lastShown = history.find(h => h.id === insightId)

  if (!lastShown) return true

  const timeSinceLastShown = Date.now() - lastShown.timestamp
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
      timestamp: Date.now()
    })

    const trimmedHistory = history.slice(0, MAX_HISTORY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory))
    console.log('[InsightService] Insight salvo no histórico:', insightId)
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

/**
 * Compartilha conquista (placeholder para Web Share API)
 */
function shareAchievement() {
  console.log('[InsightService] Compartilhar conquista - funcionalidade não implementada')
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
  INSIGHT_TYPES
}
