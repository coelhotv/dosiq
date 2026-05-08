/**
 * HeatmapStacked — Layout mobile empilhado do AdherenceHeatmap
 * Visível em telas < 380px via CSS.
 */

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

export default function HeatmapStacked({ pattern, getCellColor }) {
  return (
    <div className="adherence-heatmap__stacked-wrapper">
      <div className="adherence-heatmap__stacked-container">
        {pattern.grid.map((row, dayIndex) => (
          <div key={dayIndex} className="adherence-heatmap__day-card">
            <h4 className="adherence-heatmap__day-card-title">{DAY_NAMES[dayIndex]}</h4>
            <div className="adherence-heatmap__day-card-periods">
              {row.map((cell, periodIndex) => (
                <div
                  key={periodIndex}
                  className={`adherence-heatmap__period-bar ${cell.adherence === null ? 'adherence-heatmap__period-bar--na' : ''}`}
                >
                  <span className="adherence-heatmap__period-name">
                    {PERIOD_NAMES[periodIndex]}
                  </span>
                  <div className="adherence-heatmap__period-fill-bg">
                    <div
                      className="adherence-heatmap__period-fill"
                      style={{
                        width: `${cell.adherence === null ? 0 : cell.adherence}%`,
                        backgroundColor: getCellColor(cell.adherence),
                      }}
                    />
                  </div>
                  <span className="adherence-heatmap__period-percent">
                    {cell.adherence === null ? '—' : `${cell.adherence}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
