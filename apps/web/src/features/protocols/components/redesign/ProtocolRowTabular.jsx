import { Trash2 } from 'lucide-react'
import AdherenceBar7d from './AdherenceBar7d'
import StockPill from './StockPill'

export default function ProtocolRowTabular({
  item,
  showAdherence,
  isHovered,
  onRowMouseEnter,
  onRowMouseLeave,
  onRowClick,
  onDelete,
}) {
  const hoverClass = isHovered ? 'protocol-row-tabular__cell--hovered' : ''

  return (
    <>
      <div
        className={`protocol-row-tabular__cell protocol-row-tabular__name-cell ${hoverClass}`}
        style={{ minHeight: '3.5rem' }}
        onMouseEnter={onRowMouseEnter}
        onMouseLeave={onRowMouseLeave}
        role="gridcell"
      >
        <button
          type="button"
          className="protocol-row-tabular__name-btn"
          onClick={onRowClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
              e.preventDefault()
              onRowClick()
            }
          }}
        >
          <div className="protocol-row-tabular__name-row">
            <span className="medicine-name">{item.medicineName}</span>
            {item.concentrationLabel && (
              <span className="protocol-row__dosage">{item.concentrationLabel}</span>
            )}
          </div>
          <div className="protocol-row-tabular__intake">{item.intakeLabel}</div>
        </button>

        {onDelete && isHovered && (
          <button
            className="protocol-row-tabular__delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(item)
            }}
            aria-label={`Excluir tratamento ${item.medicineName}`}
            title="Excluir tratamento"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className={`protocol-row-tabular__cell protocol-row-tabular__schedule-cell ${hoverClass}`}>
        <div className="protocol-row-tabular__frequency">{item.frequencyLabel}</div>
        {item.timeSchedule.length > 0 && (
          <div className="protocol-row-tabular__times">{item.timeSchedule.join(' / ')}</div>
        )}
      </div>

      <div className={`protocol-row-tabular__cell protocol-row-tabular__adherence-cell ${hoverClass}`}>
        {showAdherence && <AdherenceBar7d score={item.adherenceScore7d} />}
      </div>

      <div className={`protocol-row-tabular__cell protocol-row-tabular__stock-cell ${hoverClass}`}>
        <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
      </div>
    </>
  )
}
