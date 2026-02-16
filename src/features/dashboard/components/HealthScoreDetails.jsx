import React from 'react'
import Modal from '@shared/components/ui/Modal'
import './HealthScoreDetails.css'

/**
 * HealthScoreDetails - Modal de detalhamento do Health Score (Breakdown)
 */
export default function HealthScoreDetails({ isOpen, onClose, stats, stockSummary }) {
  if (!stats || !stats.rates) return null

  const { adherence: adherenceRate, punctuality: punctualityRate, stock: stockRate } = stats.rates
  const totalScore = stats.score

  // Insights Acionáveis
  const insights = []
  if (adherenceRate < 0.9) {
    insights.push({
      type: 'warning',
      text: 'Você perdeu algumas doses nos últimos 30 dias. Tente manter a constância.',
      action: 'Dica: Use as notificações do Telegram.',
    })
  }
  if (stockRate < 1) {
    const lowItems = stockSummary.filter((s) => s.isLow || s.isZero)
    if (lowItems.length > 0) {
      insights.push({
        type: 'danger',
        text: `Estoque crítico para: ${lowItems.map((i) => i.medicine.name).join(', ')}.`,
        action: 'Ação: Registre novas compras no widget de Estoque.',
      })
    }
  }
  if (stats.currentStreak < 3) {
    insights.push({
      type: 'info',
      text: 'Comece uma nova sequência (streak) hoje para subir seu score rapidamente!',
      action: 'Objetivo: 7 dias seguidos.',
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análise do Health Score">
      <div className="health-details">
        <div className="health-details__overview">
          <div className="health-details__score-main">
            <div className="health-details__score-container">
              <span className="health-details__score-value">{totalScore}</span>
              <div className="health-details__score-glow"></div>
            </div>
            <span className="health-details__score-label">Score Atual</span>
          </div>
          <p className="health-details__description">
            Seu score de <strong>{totalScore}</strong> é reflexo da sua constância nos últimos 30
            dias.
          </p>
        </div>

        <div className="health-details__breakdown">
          <div className="health-details__metric">
            <div className="health-details__metric-header">
              <span>Adesão (Doses tomadas)</span>
              <span>{Math.round(adherenceRate * 100)}%</span>
            </div>
            <div className="health-details__progress-bar">
              <div
                className="health-details__progress-fill"
                style={{ width: `${adherenceRate * 100}%`, backgroundColor: 'var(--cyan-primary)' }}
              />
            </div>
            <span className="health-details__metric-weight">Peso: 60%</span>
          </div>

          <div className="health-details__metric">
            <div className="health-details__metric-header">
              <span>Pontualidade (Na janela de 2h)</span>
              <span>{Math.round(punctualityRate * 100)}%</span>
            </div>
            <div className="health-details__progress-bar">
              <div
                className="health-details__progress-fill"
                style={{
                  width: `${punctualityRate * 100}%`,
                  backgroundColor: 'var(--purple-primary)',
                }}
              />
            </div>
            <span className="health-details__metric-weight">Peso: 20%</span>
          </div>

          <div className="health-details__metric">
            <div className="health-details__metric-header">
              <span>Nível de Estoque</span>
              <span>{Math.round(stockRate * 100)}%</span>
            </div>
            <div className="health-details__progress-bar">
              <div
                className="health-details__progress-fill"
                style={{ width: `${stockRate * 100}%`, backgroundColor: 'var(--neon-green)' }}
              />
            </div>
            <span className="health-details__metric-weight">Peso: 20%</span>
          </div>
        </div>

        <div className="health-details__insights">
          <h3>Como Melhorar</h3>
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div
                key={idx}
                className={`health-details__insight-card health-details__insight-card--${insight.type}`}
              >
                <p>{insight.text}</p>
                <small>{insight.action}</small>
              </div>
            ))
          ) : (
            <div className="health-details__insight-card health-details__insight-card--success">
              <p>Excelente trabalho! Você está mantendo níveis ótimos de saúde e organização.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
