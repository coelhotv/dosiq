/**
 * DoseCalendarPanel — Painel lateral de detalhes do dia selecionado no DoseCalendar.
 */
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_LABELS = {
  completo: 'Completo',
  parcial: 'Parcial',
  perdido: 'Perdido',
  sem_doses: 'Sem doses',
  futuro: 'Futuro',
}

export default function DoseCalendarPanel({ isPanelOpen, selectedDayDetails, onClose, formatDateDisplay }) {
  return (
    <AnimatePresence>
      {isPanelOpen && selectedDayDetails && (
        <>
          <motion.div
            className="dose-calendar__overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="dose-calendar__panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="dose-calendar__panel-header">
              <h3 className="dose-calendar__panel-title">
                {formatDateDisplay(selectedDayDetails.date)}
              </h3>
              <button
                className="dose-calendar__panel-close"
                onClick={onClose}
                aria-label="Fechar painel"
              >
                ×
              </button>
            </div>

            <div className="dose-calendar__panel-summary">
              <div
                className="dose-calendar__panel-status"
                style={{ backgroundColor: selectedDayDetails.color }}
              >
                <span className="dose-calendar__panel-status-label">
                  {STATUS_LABELS[selectedDayDetails.status]}
                </span>
                <span className="dose-calendar__panel-status-count">
                  {selectedDayDetails.taken}/{selectedDayDetails.expected} doses
                </span>
              </div>
            </div>

            <div className="dose-calendar__panel-protocols">
              <h4 className="dose-calendar__panel-subtitle">Por Protocolo</h4>
              {selectedDayDetails.protocols.length === 0 ? (
                <p className="dose-calendar__panel-empty">Nenhum protocolo ativo nesta data</p>
              ) : (
                <ul className="dose-calendar__protocol-list">
                  {selectedDayDetails.protocols.map((protocol) => (
                    <li
                      key={protocol.id}
                      className="dose-calendar__protocol-item"
                      style={{ borderLeftColor: protocol.color }}
                    >
                      <span className="dose-calendar__protocol-name">{protocol.name}</span>
                      <span className="dose-calendar__protocol-status">
                        {protocol.taken}/{protocol.expected} - {STATUS_LABELS[protocol.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
