// src/views/redesign/history/HistoryKPICards.jsx
// S10C.2 — Wave 10C: KPI cards do topo do Histórico de Doses

/**
 * KPI cards para o topo do Histórico de Doses.
 *
 * @param {Object} props
 * @param {number} props.adherenceScore - Percentual de adesão (0-100), de stats.score
 * @param {number} props.currentStreak - Sequência atual em dias, de stats.currentStreak
 * @param {number} props.dosesThisMonth - Total de doses registradas no mês selecionado
 * @param {number} props.totalExpectedThisMonth - Total de logs do mês (para exibir "X doses")
 */
export default function HistoryKPICards({
  adherenceScore,
  currentStreak,
  dosesThisMonth,
}) {
  return (
    <div className="hhr-kpi-row">
      {/* Card 1: Adesão 30d */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Adesão (30 dias)</span>
        <span className="hhr-kpi-card__value hhr-kpi-card__value--primary">
          {adherenceScore}%
        </span>
      </div>

      {/* Card 2: Sequência Atual */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Sequência Atual</span>
        <span className="hhr-kpi-card__value">
          {currentStreak} <span className="hhr-kpi-card__unit">dias</span>
        </span>
      </div>

      {/* Card 3: Doses este Mês */}
      <div className="hhr-kpi-card">
        <span className="hhr-kpi-card__label">Doses este Mês</span>
        <span className="hhr-kpi-card__value hhr-kpi-card__value--accent">
          {dosesThisMonth}
        </span>
      </div>
    </div>
  )
}
