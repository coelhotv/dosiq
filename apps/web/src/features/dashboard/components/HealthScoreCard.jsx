import React from 'react'
import './HealthScoreCard.css'
import { getTrendEmoji } from '@dashboard/services/adherenceTrendService'

/**
 * HealthScoreCard - Visualização compacta e horizontal do score.
 *
 * @param {Object} props
 * @param {number} props.score - Score de 0 a 100
 * @param {number} props.streak - Dias seguidos de adesão
 * @param {string} [props.trend] - 'up' | 'down' | 'neutral'
 * @param {number} [props.trendPercentage] - Porcentagem de variação (ex: 12)
 * @param {number} [props.magnitude] - Magnitude para emoji diferenciado (ex: 15)
 * @param {Function} props.onClick - Callback de clique
 */
export default function HealthScoreCard({
  score = 0,
  streak = 0,
  trend = 'up',
  trendPercentage = 0,
  magnitude = 0,
  onClick,
}) {
  // Cálculo do perímetro do círculo para o progresso
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  // Determinar status baseado no score
  const getStatus = (score) => {
    if (score >= 85) return 'Excelente'
    if (score >= 70) return 'Bom'
    if (score >= 50) return 'Regular'
    return 'Ruim'
  }

  // Determinar emoji baseado no streak
  const getStreakEmoji = (streak) => {
    if (streak >= 30) return '🏆'
    if (streak >= 14) return '🔥'
    if (streak >= 7) return '⚡'
    if (streak >= 3) return '✨'
    return ''
  }

  const status = getStatus(score)
  const streakEmoji = getStreakEmoji(streak)

  // Obter emoji de tendência baseado na magnitude
  const trendEmoji = getTrendEmoji(trend, magnitude)

  // Se não tem dados suficientes para tendência, ocultar
  const showTrend = magnitude > 0 || trend !== 'up'

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`health-score-card ${onClick ? 'health-score-card--clickable' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="health-score-card__chart">
        <svg viewBox="0 0 60 60" className="health-score-card__svg">
          <circle className="health-score-card__bg" cx="30" cy="30" r={radius} />
          <circle
            className="health-score-card__progress"
            cx="30"
            cy="30"
            r={radius}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
            }}
          />
        </svg>
        <span className="health-score-card__value">{score}</span>
      </div>

      <div className="health-score-card__info">
        <div className="health-score-card__header">
          <span className="health-score-card__label">Health Score</span>
          {showTrend && (
            <span className={`health-score-card__trend health-score-card__trend--${trend}`}>
              {trendEmoji} {trendPercentage}%
            </span>
          )}
        </div>
        <div className="health-score-card__status">
          <span className="health-score-card__status-label">Status: {status}</span>
        </div>
        <div className="health-score-card__streak">
          <span className="health-score-card__streak-value">
            {streakEmoji} {streak} dias
          </span>
        </div>
      </div>
    </Tag>
  )
}
