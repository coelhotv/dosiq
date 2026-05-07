import { Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import AdherenceBar7d from './AdherenceBar7d'
import AdherenceLabel from './AdherenceLabel'
import StockPill from './StockPill'
import TitrationBadge from './TitrationBadge'

export default function ProtocolRowCard({
  item,
  isComplex,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  showAdherence,
}) {
  const canExpand = isComplex && (item.hasTitration || item.notes)

  function handleClick() {
    if (canExpand) onToggleExpand()
    else if (onEdit) onEdit(item)
  }

  return (
    <div className="protocol-row">
      {onDelete && (
        <button
          className="protocol-row__delete-btn"
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
      <button
        className="protocol-row__main"
        onClick={handleClick}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div className="protocol-row__top-row">
          <div className="protocol-row__header">
            <span className="protocol-row__name">{item.medicineName}</span>
            {item.concentrationLabel && (
              <span className="protocol-row__dosage">{item.concentrationLabel}</span>
            )}
          </div>
          <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
        </div>

        <div className="protocol-row__intake">{item.intakeLabel}</div>

        <div className="protocol-row__bottom-row">
          <div className="protocol-row__schedule">
            {item.frequencyLabel}
            {item.timeSchedule.length > 0 && ` · ${item.timeSchedule.join(' / ')}`}
          </div>
          {showAdherence &&
            (isComplex ? (
              <AdherenceBar7d score={item.adherenceScore7d} />
            ) : (
              <AdherenceLabel score={item.adherenceScore7d} />
            ))}
        </div>

        {canExpand && (
          <span className="protocol-row__chevron" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && canExpand && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="protocol-row__details"
          >
            {item.hasTitration && <TitrationBadge summary={item.titrationSummary} />}
            {item.notes && <p className="protocol-row__notes">{item.notes}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
