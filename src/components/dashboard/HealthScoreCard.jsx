import React from 'react';
import './HealthScoreCard.css';

/**
 * HealthScoreCard - Visualização compacta e horizontal do score.
 * 
 * @param {Object} props
 * @param {number} props.score - Score de 0 a 100
 * @param {number} props.streak - Dias seguidos de adesão
 * @param {string} [props.trend] - 'up' | 'down'
 */
export default function HealthScoreCard({ score = 0, streak = 0, trend = 'up' }) {
  // Cálculo do perímetro do círculo para o progresso
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="health-score-card">
      <div className="health-score-card__chart">
        <svg viewBox="0 0 60 60" className="health-score-card__svg">
          <circle
            className="health-score-card__bg"
            cx="30"
            cy="30"
            r={radius}
          />
          <circle
            className="health-score-card__progress"
            cx="30"
            cy="30"
            r={radius}
            style={{ 
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset 
            }}
          />
        </svg>
        <span className="health-score-card__value">{score}</span>
      </div>
      
      <div className="health-score-card__info">
        <div className="health-score-card__header">
          <span className="health-score-card__label">Health Score</span>
          <span className={`health-score-card__trend health-score-card__trend--${trend}`}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        </div>
        <div className="health-score-card__streak">
          <span className="health-score-card__streak-value">{streak}d</span>
          <span className="health-score-card__streak-label">Streak</span>
        </div>
      </div>
    </div>
  );
}
