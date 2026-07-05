/**
 * HeatmapGrid — Grade desktop do AdherenceHeatmap
 * Visível em telas >= 380px via CSS.
 */

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

export default function HeatmapGrid({
  pattern,
  hoveredCell,
  touchedCell,
  getCellColor,
  onCellMouseEnter,
  onCellMouseLeave,
  onCellTouchEnd,
}) {
  return (
    <div className="adherence-heatmap__grid-container">
      <div className="adherence-heatmap__container">
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
            <div className="adherence-heatmap__day-label">{DAY_NAMES[dayIndex]}</div>
            {row.map((cell, periodIndex) => {
              const cellKey = `${dayIndex}-${periodIndex}`
              const isActive =
                hoveredCell !== null &&
                hoveredCell.includes(`${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}`)

              return (
                <div
                  key={cellKey}
                  className={`adherence-heatmap__cell ${isActive ? 'adherence-heatmap__cell--active' : ''} ${cell.adherence === null ? 'adherence-heatmap__cell--na' : ''}`}
                  style={{ backgroundColor: getCellColor(cell.adherence) }}
                  onMouseEnter={() => onCellMouseEnter(dayIndex, periodIndex)}
                  onMouseLeave={onCellMouseLeave}
                  onTouchEnd={() => onCellTouchEnd(dayIndex, periodIndex)}
                  role="gridcell"
                  aria-label={`${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}: ${cell.adherence === null ? 'N/D' : `${cell.adherence}%`}`}
                  tabIndex={0}
                >
                  <span className="adherence-heatmap__cell-text">
                    {cell.adherence === null ? '—' : `${cell.adherence}%`}
                  </span>
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
        {touchedCell && (
          <div
            className="adherence-heatmap__tooltip adherence-heatmap__tooltip--mobile"
            role="status"
          >
            {touchedCell}
          </div>
        )}
      </div>
    </div>
  )
}
