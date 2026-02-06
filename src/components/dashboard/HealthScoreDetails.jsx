import React from 'react';
import Modal from '../ui/Modal';
import './HealthScoreDetails.css';

/**
 * HealthScoreDetails - Modal de detalhamento do Health Score (Breakdown)
 */
export default function HealthScoreDetails({ isOpen, onClose, stats, stockSummary }) {
  if (!stats) return null;

  // 1. Cálculo de Adesão (60%) - Doses tomadas (mesmo fora da janela) / Esperadas
  // Nota: Por enquanto o logService não distingue se foi fora da janela para a "Adesão" pura,
  // mas vamos assumir que se há um log no dia para aquele remédio, conta como adesão.
  const adherenceWeight = 0.6;
  const punctualityWeight = 0.2;
  const stockWeight = 0.2;

  // Mock ou cálculo simplificado baseado nos dados atuais
  // Em uma refatoração futura, essas métricas virão prontas do useDashboard
  const adherenceRate = stats.expected > 0 ? (stats.takenAnytime / stats.expected) : 1;
  const punctualityRate = stats.expected > 0 ? (stats.taken / stats.expected) : 1;
  
  const totalMeds = stockSummary.length;
  const healthyStockMeds = stockSummary.filter(s => !s.isLow && !s.isZero).length;
  const stockRate = totalMeds > 0 ? (healthyStockMeds / totalMeds) : 1;

  const adherenceScore = Math.round(adherenceRate * 100 * adherenceWeight);
  const punctualityScore = Math.round(punctualityRate * 100 * punctualityWeight);
  const stockScore = Math.round(stockRate * 100 * stockWeight);
  
  const totalScore = Math.min(adherenceScore + punctualityScore + stockScore, 100);

  // Insights Acionáveis
  const insights = [];
  if (adherenceRate < 0.9) {
    insights.push({
      type: 'warning',
      text: 'Você perdeu algumas doses nos últimos 30 dias. Tente manter a constância.',
      action: 'Dica: Use as notificações do Telegram.'
    });
  }
  if (stockRate < 1) {
    const lowItems = stockSummary.filter(s => s.isLow || s.isZero);
    if (lowItems.length > 0) {
      insights.push({
        type: 'danger',
        text: `Estoque crítico para: ${lowItems.map(i => i.medicine.name).join(', ')}.`,
        action: 'Ação: Registre novas compras no widget de Estoque.'
      });
    }
  }
  if (stats.currentStreak < 3) {
    insights.push({
      type: 'info',
      text: 'Comece uma nova sequência (streak) hoje para subir seu score rapidamente!',
      action: 'Objetivo: 7 dias seguidos.'
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análise de Performance">
      <div className="health-details">
        <div className="health-details__overview">
          <div className="health-details__score-main">
            <span className="health-details__score-value">{totalScore}</span>
            <span className="health-details__score-label">Score Atual</span>
          </div>
          <p className="health-details__description">
            Seu score de <strong>{totalScore}</strong> é reflexo da sua constância nos últimos 30 dias.
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
                style={{ width: `${punctualityRate * 100}%`, backgroundColor: 'var(--purple-primary)' }}
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
              <div key={idx} className={`health-details__insight-card health-details__insight-card--${insight.type}`}>
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
  );
}
