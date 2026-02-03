import { useState, useEffect } from 'react'
import './AdherenceWidget.css'

/**
 * AdherenceWidget - Widget de Score de Aderência
 * 
 * Exibe o score de aderência do usuário com visualização
 * circular e estatísticas de streak.
 * 
 * Props:
 * - adherenceData: {
 *     score: number (0-100),
 *     streakDays: number,
 *     bestStreak: number,
 *     dosesTaken: number,
 *     dosesScheduled: number,
 *     periodLabel: string (ex: "Últimos 7 dias")
 *   }
 * - onViewDetails: () => void - Navega para relatório detalhado
 * - onImprove: () => void - Navega para dicas de melhoria
 */
export default function AdherenceWidget({ 
  adherenceData,
  onViewDetails,
  onImprove
}) {
  const [animatedScore, setAnimatedScore] = useState(0)
  
  const {
    score = 0,
    streakDays = 0,
    bestStreak = 0,
    dosesTaken = 0,
    dosesScheduled = 0,
    periodLabel = 'Últimos 7 dias'
  } = adherenceData || {}

  // Animação do score ao carregar
  useEffect(() => {
    const duration = 1000
    const steps = 60
    const increment = score / steps
    let current = 0
    
    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        setAnimatedScore(score)
        clearInterval(timer)
      } else {
        setAnimatedScore(Math.round(current))
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [score])

  // Determinar cor baseada no score
  const getScoreColor = (value) => {
    if (value >= 80) return '#00ff88' // Verde neon
    if (value >= 60) return '#ffc107' // Amarelo/laranja
    return '#ff4444' // Vermelho
  }

  // Determinar label baseada no score
  const getScoreLabel = (value) => {
    if (value >= 90) return 'Excelente'
    if (value >= 80) return 'Muito Bom'
    if (value >= 60) return 'Bom'
    if (value >= 40) return 'Regular'
    return 'Precisa Melhorar'
  }

  const scoreColor = getScoreColor(score)
  const scoreLabel = getScoreLabel(score)
  
  // Calcular circunferência para o progress ring
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  return (
    <div className="adherence-widget">
      <div className="adherence-widget__header">
        <div className="adherence-widget__icon">🎯</div>
        <div className="adherence-widget__title-group">
          <h3 className="adherence-widget__title">Aderência</h3>
          <span className="adherence-widget__period">{periodLabel}</span>
        </div>
      </div>

      <div className="adherence-widget__content">
        {/* Circular Progress */}
        <div className="adherence-widget__score-section">
          <div className="adherence-widget__ring-container">
            <svg className="adherence-widget__ring" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                className="adherence-widget__ring-bg"
                cx="50"
                cy="50"
                r={radius}
              />
              {/* Progress circle */}
              <circle
                className="adherence-widget__ring-progress"
                cx="50"
                cy="50"
                r={radius}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset,
                  stroke: scoreColor
                }}
              />
            </svg>
            <div className="adherence-widget__score-center">
              <span 
                className="adherence-widget__score-value"
                style={{ color: scoreColor }}
              >
                {animatedScore}%
              </span>
              <span className="adherence-widget__score-label">{scoreLabel}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="adherence-widget__stats">
          <div className="adherence-widget__stat">
            <span className="adherence-widget__stat-icon">🔥</span>
            <span className="adherence-widget__stat-value">{streakDays}</span>
            <span className="adherence-widget__stat-label">Dias seguidos</span>
          </div>
          
          <div className="adherence-widget__stat">
            <span className="adherence-widget__stat-icon">🏆</span>
            <span className="adherence-widget__stat-value">{bestStreak}</span>
            <span className="adherence-widget__stat-label">Melhor sequência</span>
          </div>
          
          <div className="adherence-widget__stat">
            <span className="adherence-widget__stat-icon">💊</span>
            <span className="adherence-widget__stat-value">
              {dosesTaken}/{dosesScheduled}
            </span>
            <span className="adherence-widget__stat-label">Doses tomadas</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="adherence-widget__actions">
        {score < 80 && (
          <button 
            className="adherence-widget__btn adherence-widget__btn--improve"
            onClick={onImprove}
          >
            💡 Como Melhorar
          </button>
        )}
        <button 
          className="adherence-widget__btn adherence-widget__btn--details"
          onClick={onViewDetails}
        >
          Ver Detalhes →
        </button>
      </div>
    </div>
  )
}