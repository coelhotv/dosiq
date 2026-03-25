/**
 * ProtocolRow — Row reutilizável para exibir protocolo
 * Modo collapsed: nome, dosagem, frequência, adesão 7d, estoque
 * Modo expanded (complex): titulação + notas clínicas
 */
import { AnimatePresence, motion } from 'framer-motion'
import AdherenceBar7d from './AdherenceBar7d'
import StockPill from './StockPill'
import TitrationBadge from './TitrationBadge'

export default function ProtocolRow({ item, isComplex, expanded, onToggleExpand, onEdit, activeTab }) {
  const canExpand = isComplex && (item.hasTitration || item.notes)
  // Mostrar adesão apenas para protocolos ativos
  const showAdherence = activeTab === 'ativos'

  function handleClick() {
    // Se em modo complexo e tem conteúdo para expandir, expande
    if (canExpand) {
      onToggleExpand()
    } else if (onEdit) {
      // Caso contrário, abre o modal de edição se callback fornecido
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
