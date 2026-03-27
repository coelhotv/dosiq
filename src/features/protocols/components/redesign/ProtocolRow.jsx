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
import AdherenceLabel from './AdherenceLabel'
import StockPill from './StockPill'
import TitrationBadge from './TitrationBadge'

/**
 * ProtocolRow — Row reutilizável com dois variantes
 * S7.5.5: Adicionar isHovered prop para iluminar linha inteira em desktop
 * Célula 1 convertida de button para div (clique agora no wrapper pai)
 */
export default function ProtocolRow({
  item,
  isComplex,
  expanded,
  onToggleExpand,
  onEdit,
  activeTab,
  variant = 'card',
  isHovered = false, // S7.5.5
  onRowMouseEnter, // S7.5.5
  onRowMouseLeave, // S7.5.5
  onRowClick, // S7.5.5
}) {
  const showAdherence = activeTab === 'ativos'

  // ────────────────────────────────────────────────────────────────
  // VARIANTE: TABULAR (Modo Complexo Desktop)
  // ────────────────────────────────────────────────────────────────
  if (variant === 'tabular') {
    const hoverClass = isHovered ? 'protocol-row-tabular__cell--hovered' : '' // S7.5.5

    return (
      <>
        {/* CÉLULA 1: Nome + Dosagem — S7.5.5: recebe mouse events e click */}
        <div
          className={`protocol-row-tabular__cell protocol-row-tabular__name-cell ${hoverClass}`}
          style={{ minHeight: '3.5rem' }}
          onMouseEnter={onRowMouseEnter}
          onMouseLeave={onRowMouseLeave}
          onClick={onRowClick}
          role="row"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
              e.preventDefault()
              onRowClick()
            }
          }}
        >
          <div className="protocol-row-tabular__name-row">
            <span className="protocol-row-tabular__medicine-name">{item.medicineName}</span>
            {item.concentrationLabel && (
              <span className="protocol-row__dosage">{item.concentrationLabel}</span>
            )}
          </div>
          <div className="protocol-row-tabular__intake">{item.intakeLabel}</div>
        </div>

        {/* CÉLULA 2: Frequência + Horários — S7.5.5: aplicar hover class */}
        <div className={`protocol-row-tabular__cell protocol-row-tabular__schedule-cell ${hoverClass}`}>
          <div className="protocol-row-tabular__frequency">{item.frequencyLabel}</div>
          {item.timeSchedule.length > 0 && (
            <div className="protocol-row-tabular__times">{item.timeSchedule.join(' / ')}</div>
          )}
        </div>

        {/* CÉLULA 3: Adesão 7d (apenas em aba ativos) — S7.5.5: aplicar hover class */}
        <div className={`protocol-row-tabular__cell protocol-row-tabular__adherence-cell ${hoverClass}`}>
          {showAdherence && <AdherenceBar7d score={item.adherenceScore7d} />}
        </div>

        {/* CÉLULA 4: Estoque — S7.5.5: aplicar hover class */}
        <div className={`protocol-row-tabular__cell protocol-row-tabular__stock-cell ${hoverClass}`}>
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
        {/* Linha 1: nome + badge (esq) · stock pill (dir) */}
        <div className="protocol-row__top-row">
          <div className="protocol-row__header">
            <span className="protocol-row__name">{item.medicineName}</span>
            {item.concentrationLabel && (
              <span className="protocol-row__dosage">{item.concentrationLabel}</span>
            )}
          </div>
          <StockPill status={item.stockStatus} daysRemaining={item.daysRemaining} />
        </div>

        {/* Linha 2: quantidade por dose */}
        <div className="protocol-row__intake">{item.intakeLabel}</div>

        {/* Linha 3: frequência/horários (esq) · adesão (dir) */}
        <div className="protocol-row__bottom-row">
          <div className="protocol-row__schedule">
            {item.frequencyLabel}
            {item.timeSchedule.length > 0 && ` · ${item.timeSchedule.join(' / ')}`}
          </div>
          {showAdherence && (
            isComplex
              ? <AdherenceBar7d score={item.adherenceScore7d} />
              : <AdherenceLabel score={item.adherenceScore7d} />
          )}
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
