import { useState } from 'react'
import './AdherenceHeatmap.css'

/**
 * Nomes dos dias da semana
 */
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * Nomes dos períodos do dia
 */
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

/**
 * Componente de heatmap de adesão por dia da semana e período do dia
 *
 * Props:
 * - pattern: { grid, worstCell, narrative, hasEnoughData } (saída de analyzeAdherencePatterns)
 *
 * Renderiza:
 * - Desktop (>= 380px): Grid 7x4 via CSS
 * - Mobile (< 380px): Stacked cards via CSS
 * (A responsividade é controlada por media queries no CSS, não por lógica JS)
 */
export default function AdherenceHeatmap({ pattern }) {
  // States
  const [hoveredCell, setHoveredCell] = useState(null)
  const [touchedCell, setTouchedCell] = useState(null)

  // Guard clause: dados insuficientes
  if (!pattern || !pattern.hasEnoughData) {
    return (
      <div className="adherence-heatmap adherence-heatmap--empty" role="status">
        <p className="adherence-heatmap__empty-message">
          {pattern?.narrative || 'Registre pelo menos 21 dias de doses para análise de padrões.'}
        </p>
      </div>
    )
  }

  /**
   * Calcula opacidade baseada na adherência (0-100%)
   * 100% = 1.0 (verde opaco)
   * 50% = 0.5 (verde translúcido)
   * 0% = 0.1 (verde bem transparente)
   */
  const getOpacity = (adherence) => {
    if (adherence >= 90) return 1.0
    if (adherence >= 75) return 0.8
    if (adherence >= 50) return 0.5
    if (adherence >= 25) return 0.25
    return 0.1
  }

  /**
   * Retorna cor CSS com opacidade adequada
   */
  const getCellColor = (adherence) => {
    const opacity = getOpacity(adherence)
    return `rgba(34, 197, 94, ${opacity})` // green-500 com opacidade variável
  }

  /**
   * Handler para tooltip ao tocar/passar mouse
   */
  const handleCellInteraction = (dayIndex, periodIndex) => {
    const cell = pattern.grid[dayIndex][periodIndex]
    const tooltip = `${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}: ${cell.adherence}% (${cell.taken}/${cell.expected} doses)`
    setHoveredCell(tooltip)
  }

  const handleCellTouchEnd = (dayIndex, periodIndex) => {
    const cell = pattern.grid[dayIndex][periodIndex]
    const tooltip = `${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}: ${cell.adherence}% (${cell.taken}/${cell.expected} doses)`
    setTouchedCell(tooltip === touchedCell ? null : tooltip)
  }

  const handleCellMouseLeave = () => {
    setHoveredCell(null)
  }

  // Renderização: Grid (visível em desktop via CSS) + Stacked (visível em mobile via CSS)
  return (
    <div className="adherence-heatmap" role="region" aria-label="Heatmap de adesão por dia e período">
      {/* Grid: Desktop (>=380px) */}
      <div className="adherence-heatmap__grid-container">
        <div className="adherence-heatmap__container"> {/* Inner container for grid styling */}
          {/* Cabeçalho com períodos */}
          <div className="adherence-heatmap__header">
            <div className="adherence-heatmap__corner" />
            {PERIOD_NAMES.map((period, idx) => (
              <div key={idx} className="adherence-heatmap__period-header">
                {period}
              </div>
            ))}
          </div>

          {/* Grid de células */}
          {pattern.grid.map((row, dayIndex) => (
            <div key={dayIndex} className="adherence-heatmap__row">
              {/* Label do dia */}
              <div className="adherence-heatmap__day-label">{DAY_NAMES[dayIndex]}</div>

              {/* Células do grid */}
              {row.map((cell, periodIndex) => {
                const cellKey = `${dayIndex}-${periodIndex}`
                const isActive = hoveredCell !== null && hoveredCell.includes(`${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}`)

                return (
                  <div
                    key={cellKey}
                    className={`adherence-heatmap__cell ${isActive ? 'adherence-heatmap__cell--active' : ''}`}
                    style={{ backgroundColor: getCellColor(cell.adherence) }}
                    onMouseEnter={() => handleCellInteraction(dayIndex, periodIndex)}
                    onMouseLeave={handleCellMouseLeave}
                    onTouchEnd={() => handleCellTouchEnd(dayIndex, periodIndex)}
                    role="gridcell"
                    aria-label={`${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}: ${cell.adherence}%`}
                    tabIndex={0}
                  >
                    <span className="adherence-heatmap__cell-text">{cell.adherence}%</span>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Tooltip flutuante */}
          {hoveredCell && (
            <div className="adherence-heatmap__tooltip" role="tooltip">
              {hoveredCell}
            </div>
          )}

          {/* Tooltip para mobile (persistente) */}
          {touchedCell && (
            <div className="adherence-heatmap__tooltip adherence-heatmap__tooltip--mobile" role="status">
              {touchedCell}
            </div>
          )}
        </div>
      </div>

      {/* Stacked: Mobile (<380px) */}
      <div className="adherence-heatmap__stacked-wrapper">
        <div className="adherence-heatmap__stacked-container">
          {pattern.grid.map((row, dayIndex) => (
            <div key={dayIndex} className="adherence-heatmap__day-card">
              <h4 className="adherence-heatmap__day-card-title">{DAY_NAMES[dayIndex]}</h4>
              <div className="adherence-heatmap__day-card-periods">
                {row.map((cell, periodIndex) => (
                  <div key={periodIndex} className="adherence-heatmap__period-bar">
                    <span className="adherence-heatmap__period-name">{PERIOD_NAMES[periodIndex]}</span>
                    <div className="adherence-heatmap__period-fill-bg">
                      <div
                        className="adherence-heatmap__period-fill"
                        style={{
                          width: `${cell.adherence}%`,
                          backgroundColor: getCellColor(cell.adherence),
                        }}
                      />
                    </div>
                    <span className="adherence-heatmap__period-percent">{cell.adherence}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Narrativa (única para ambos os layouts) */}
      {pattern.narrative && (
        <div className="adherence-heatmap__narrative" role="status">
          💡 {pattern.narrative}
        </div>
      )}
    </div>
  )
}
