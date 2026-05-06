/**
 * _insightGenerators.js — Funções geradoras de insights individuais.
 *
 * Módulo privado (prefixo _) extraído de insightService.js para manter
 * generateAllInsights abaixo de 100 linhas e complexidade ≤ 15.
 * Não deve ser importado diretamente por outros módulos.
 * @module _insightGenerators
 */

import { analyticsService } from './analyticsService'

// Tipos de insight (espelho local de INSIGHT_TYPES para evitar ciclo de import)
const IT = {
  STREAK_CELEBRATION: 'STREAK_CELEBRATION',
  ADHERENCE_POSITIVE: 'ADHERENCE_POSITIVE',
  ADHERENCE_MOTIVATIONAL: 'ADHERENCE_MOTIVATIONAL',
  PROTOCOL_REMINDER: 'PROTOCOL_REMINDER',
}

/**
 * Cria insight de celebração de streak.
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createStreakInsight(stats, onNavigate) {
  if (stats.currentStreak < 5) return null
  return {
    id: 'streak_achievement',
    type: IT.STREAK_CELEBRATION,
    priority: 'low',
    icon: '🔥',
    text: `Você está em uma sequência de ${stats.currentStreak} dias! Continue assim!`,
    highlight: `${stats.currentStreak} dias`,
    actionLabel: 'Ver Histórico',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'streak_achievement' })
      onNavigate?.('history')
    },
  }
}

/**
 * Cria insight de semana perfeita (100% de adesão).
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} shareAchievement - Callback de compartilhamento
 * @returns {Object|null}
 */
export function createPerfectWeekInsight(stats, shareAchievement) {
  if (stats.adherence !== 100) return null
  return {
    id: 'perfect_week',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'low',
    icon: '⭐',
    text: 'Semana perfeita! 100% de adesão nos últimos 7 dias.',
    highlight: '100% de adesão',
    actionLabel: 'Compartilhar',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'perfect_week' })
      shareAchievement()
    },
  }
}

/**
 * Cria insight de boa semana (80–99% de adesão).
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createGoodWeekInsight(stats, onNavigate) {
  if (stats.adherence < 80 || stats.adherence >= 100) return null
  return {
    id: 'good_week',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'low',
    icon: '👍',
    text: `Sua adesão esta semana está em ${Math.round(stats.adherence)}%. Muito bem! Continue assim!`,
    highlight: `${Math.round(stats.adherence)}%`,
    actionLabel: 'Ver Histórico',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'good_week' })
      onNavigate?.('history')
    },
  }
}

/**
 * Cria insight de melhoria de adesão.
 * @param {Object} trend - Dados de tendência { direction, percentage }
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createImprovementInsight(trend, onNavigate) {
  if (trend.direction !== 'up' || trend.percentage < 10) return null
  return {
    id: 'improvement',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'low',
    icon: '📈',
    text: `Sua adesão melhorou ${trend.percentage}% em relação à semana anterior!`,
    highlight: `${trend.percentage}% melhor`,
    actionLabel: 'Ver Detalhes',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'improvement' })
      onNavigate?.('stats')
    },
  }
}

/**
 * Cria insight de estoque saudável.
 * @param {Array} stockSummary - Resumo de estoque
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createStockHealthyInsight(stockSummary, onNavigate) {
  const lowStockCount = stockSummary?.filter((s) => s.isLow || s.isZero).length || 0
  if (lowStockCount !== 0 || !stockSummary?.length) return null
  return {
    id: 'stock_healthy',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'info',
    icon: '✅',
    text: 'Todos os medicamentos com estoque saudável. Ótimo planejamento!',
    highlight: 'estoque saudável',
    actionLabel: 'Ver Estoque',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'stock_healthy' })
      onNavigate?.('stock')
    },
  }
}

/**
 * Cria insight de doses pendentes hoje.
 * @param {number} todayMissed - Quantidade de doses perdidas hoje
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createMissedDosesTodayInsight(todayMissed, onNavigate) {
  if (todayMissed <= 0 || todayMissed > 2) return null
  return {
    id: 'missed_doses_today',
    type: IT.ADHERENCE_MOTIVATIONAL,
    priority: 'medium',
    icon: '⏰',
    text: `Você tem ${todayMissed} doses pendentes hoje. Que tal completar agora?`,
    highlight: `${todayMissed} doses pendentes`,
    actionLabel: 'Registrar Doses',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'missed_doses_today' })
      onNavigate?.('register')
    },
  }
}

/**
 * Cria insight de adesão baixa (< 80%).
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createLowAdherenceInsight(stats, onNavigate) {
  if (stats.adherence >= 80 || stats.adherence <= 0) return null
  return {
    id: 'low_adherence_week',
    type: IT.ADHERENCE_MOTIVATIONAL,
    priority: 'medium',
    icon: '💪',
    text: `Sua adesão esta semana está em ${Math.round(stats.adherence)}%. Vamos melhorar juntos!`,
    highlight: `${Math.round(stats.adherence)}%`,
    actionLabel: 'Ver Protocolos',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'low_adherence_week' })
      onNavigate?.('protocols')
    },
  }
}

/**
 * Cria insight de streak quebrado.
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createStreakBrokenInsight(stats, onNavigate) {
  if (stats.currentStreak !== 0 || stats.longestStreak < 3) return null
  return {
    id: 'streak_broken',
    type: IT.ADHERENCE_MOTIVATIONAL,
    priority: 'high',
    icon: '🔄',
    text: `Seu streak foi interrompido. Seu recorde foi ${stats.longestStreak} dias. Recomece agora!`,
    highlight: `${stats.longestStreak} dias`,
    actionLabel: 'Registrar Dose',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'streak_broken' })
      onNavigate?.('register')
    },
  }
}

/**
 * Cria insight de protocolos ativos.
 * @param {Object} stats - Estatísticas de adesão
 * @param {Function} onNavigate - Função de navegação
 * @returns {Object|null}
 */
export function createProtocolReminderInsight(stats, onNavigate) {
  const activeProtocols = stats.activeProtocols || 0
  if (activeProtocols <= 0 || activeProtocols > 3) return null
  return {
    id: 'protocol_reminder',
    type: IT.PROTOCOL_REMINDER,
    priority: 'info',
    icon: '📋',
    text: `Você tem ${activeProtocols} protocolo${activeProtocols > 1 ? 's' : ''} ativo${activeProtocols > 1 ? 's' : ''}. Todos em dia!`,
    highlight: `${activeProtocols} protocolo${activeProtocols > 1 ? 's' : ''}`,
    actionLabel: 'Ver Protocolos',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'protocol_reminder' })
      onNavigate?.('protocols')
    },
  }
}
