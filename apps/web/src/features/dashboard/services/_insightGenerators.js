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

const openDoseModal = () => window.dispatchEvent(new CustomEvent('mr:open-dose-modal'))

export function createStreakInsight(stats, onNavigate) {
  if (!stats || stats.currentStreak < 5) return null
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

export function createPerfectWeekInsight(stats, onNavigate) {
  if (!stats || stats.adherence !== 100) return null
  return {
    id: 'perfect_week',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'low',
    icon: '⭐',
    text: 'Semana perfeita! 100% de adesão nos últimos 7 dias.',
    highlight: '100% de adesão',
    actionLabel: 'Ver Histórico',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'perfect_week' })
      onNavigate?.('history')
    },
  }
}

export function createGoodWeekInsight(stats, onNavigate) {
  if (!stats || stats.adherence < 80 || stats.adherence >= 100) return null
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

export function createImprovementInsight(trend, onNavigate) {
  if (trend.direction !== 'up' || trend.percentage < 10) return null
  return {
    id: 'improvement',
    type: IT.ADHERENCE_POSITIVE,
    priority: 'low',
    icon: '📈',
    text: `Sua adesão melhorou ${trend.percentage}% em relação à semana anterior!`,
    highlight: `${trend.percentage}% melhor`,
    actionLabel: 'Ver Histórico',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'improvement' })
      onNavigate?.('history')
    },
  }
}

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

export function createMissedDosesTodayInsight(todayMissed) {
  if (todayMissed <= 0 || todayMissed > 2) return null
  return {
    id: 'missed_doses_today',
    type: IT.ADHERENCE_MOTIVATIONAL,
    priority: 'medium',
    icon: '⏰',
    text: `Você tem ${todayMissed} doses pendentes hoje. Que tal completar agora?`,
    highlight: `${todayMissed} doses pendentes`,
    actionLabel: 'Registrar Dose',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'missed_doses_today' })
      openDoseModal()
    },
  }
}

export function createLowAdherenceInsight(stats, onNavigate) {
  if (!stats || stats.adherence >= 80 || stats.adherence <= 0) return null
  return {
    id: 'low_adherence_week',
    type: IT.ADHERENCE_MOTIVATIONAL,
    priority: 'medium',
    icon: '💪',
    text: `Sua adesão esta semana está em ${Math.round(stats.adherence)}%. Vamos melhorar juntos!`,
    highlight: `${Math.round(stats.adherence)}%`,
    actionLabel: 'Ver Histórico',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'low_adherence_week' })
      onNavigate?.('history')
    },
  }
}

export function createStreakBrokenInsight(stats) {
  if (!stats || stats.currentStreak !== 0 || stats.longestStreak < 3) return null
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
      openDoseModal()
    },
  }
}

export function createProtocolReminderInsight(stats, onNavigate) {
  const activeProtocols = stats?.activeProtocols || 0
  if (activeProtocols <= 0 || activeProtocols > 3) return null
  return {
    id: 'protocol_reminder',
    type: IT.PROTOCOL_REMINDER,
    priority: 'info',
    icon: '📋',
    text: `Você tem ${activeProtocols} tratamento${activeProtocols > 1 ? 's' : ''} ativo${activeProtocols > 1 ? 's' : ''}. Todos em dia!`,
    highlight: `${activeProtocols} tratamento${activeProtocols > 1 ? 's' : ''}`,
    actionLabel: 'Ver Tratamentos',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'protocol_reminder' })
      onNavigate?.('treatments')
    },
  }
}
