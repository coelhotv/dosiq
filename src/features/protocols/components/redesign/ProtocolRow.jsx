/**
 * ProtocolRow — Row reutilizável com dois variantes
 *
 * variant="card" (padrão — Modo Simples):
 * - Layout vertical (flex-column) em mobile
 * - Cards empilhados com nome, dosagem, frequência, adesão, estoque
 * - Expandível para titulação e notas
 *
 * variant="tabular" (Modo Complexo Desktop):
 * - 4 células separadas: nome | frequência | adesão | estoque
 * - Renderiza sem button, sem expand (cada célula é independente)
 * - CSS Grid do container pai distribui as 4 células horizontalmente
 */
import { AnimatePresence, motion } from 'framer-motion'
import AdherenceBar7d from './AdherenceBar7d'
import StockPill from './StockPill'
import TitrationBadge from './TitrationBadge'

export default function ProtocolRow({
  item,
  isComplex,
  expanded,
  onToggleExpand,
  onEdit,
  activeTab,
  variant = 'card',
}) {
  const showAdherence = activeTab === 'ativos'

  // ────────────────────────────────────────────────────────────────
  // VARIANTE: TABULAR (Modo Complexo Desktop)
  // ────────────────────────────────────────────────────────────────
  if (variant === 'tabular') {
    return (
      <>
        {/* CÉLULA 1: Nome + Dosagem */}
        <button
          className="protocol-row-tabular__cell protocol-row-tabular__name-cell"
          onClick={() => onEdit?.(item)}
          style={{ minHeight: '3.5rem' }}
        >
          <div className="protocol-row-tabular__medicine-name">{item.medicineName}</div>
          <div className="protocol-row-tabular__dosage">{item.dosageLabel}</div>
        </button>

        {/* CÉLULA 2: Frequência + Horários */}
        <div className="protocol-row-tabular__cell protocol-row-tabular__schedule-cell">
          <div className="protocol-row-tabular__frequency">{item.frequencyLabel}</div>
          {item.timeSchedule.length > 0 && (
            <div className="protocol-row-tabular__times">{item.timeSchedule.join(' / ')}</div>
          )}
        </div>

        {/* CÉLULA 3: Adesão 7d (apenas em aba ativos) */}
        <div className="protocol-row-tabular__cell protocol-row-tabular__adherence-cell">
          {showAdherence && <AdherenceBar7d score={item.adherenceScore7d} />}
        </div>

        {/* CÉLULA 4: Estoque */}
        <div className="protocol-row-tabular__cell protocol-row-tabular__stock-cell">
          <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
        </div>
      </>
    )
  }

  // ────────────────────────────────────────────────────────────────
  // VARIANTE: CARD (Modo Simples)
  // ────────────────────────────────────────────────────────────────
  const canExpand = isComplex && (item.hasTitration || item.notes)

  function handleClick() {
    // Se em modo complexo e tem conteúdo para expandir, expande
    if (canExpand) {
      onToggleExpand()
    } else if (onEdit) {
      // Caso contrário, abre o modal de edição
      onEdit(item)
    }
  }

  return (
    <div className="protocol-row">
      <button
        className="protocol-row__main"
        onClick={handleClick}
        aria-expanded={canExpand ? expanded : undefined}
        style={{ minHeight: '3.5rem' }}
      >
        <div className="protocol-row__header">
          <span className="protocol-row__name">{item.medicineName}</span>
          <span className="protocol-row__dosage">{item.dosageLabel}</span>
        </div>
        <div className="protocol-row__schedule">
          {item.frequencyLabel}
          {item.timeSchedule.length > 0 && ` · ${item.timeSchedule.join(' / ')}`}
        </div>
        <div className="protocol-row__metrics">
          {showAdherence && <AdherenceBar7d score={item.adherenceScore7d} />}
          <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
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
