/**
 * DoseListItem - Componente para exibir uma dose individual na lista do drill-down
 *
 * Mostra informações de uma dose (tomada ou perdida) com indicador visual de status.
 *
 * @component
 * @example
 * <DoseListItem log={log} isTaken={true} scheduledTime="08:00" />
 */

import { motion } from 'framer-motion'
import './DoseListItem.css'

/**
 * Formata horário para exibição
 * @param {string} dateStr - Data/hora ISO 8601
 * @returns {string} Horário formatado (HH:mm)
 */
const formatTime = (dateStr) => {
  if (!dateStr) return '--:--'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formata nome do medicamento (trunca se muito longo)
 * @param {string} name - Nome do medicamento
 * @param {number} maxLength - Comprimento máximo
 * @returns {string} Nome formatado
 */
const formatMedicineName = (name, maxLength = 30) => {
  if (!name) return 'Remédio'
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength - 3) + '...'
}

/**
 * Retorna label de quantidade no plural correto
 * @param {number} quantity - Quantidade
 * @param {string} unit - Unidade (comprimido, cápsula, etc)
 * @returns {string} Label formatado
 */
const getQuantityLabel = (quantity, unit = 'comprimido') => {
  if (quantity === 1) return `1 ${unit}`
  return `${quantity} ${unit}s`
}

/**
 * Componente DoseListItem
 *
 * @param {Object} props
 * @param {Object} props.log - Log da dose
 * @param {string} props.log.id - ID do log
 * @param {string} props.log.taken_at - Data/hora da dose
 * @param {number} props.log.quantity_taken - Quantidade tomada
 * @param {Object} props.log.medicine - Dados do medicamento
 * @param {string} props.log.medicine.name - Nome do medicamento
 * @param {Object} props.log.protocol - Dados do protocolo
 * @param {string} props.log.protocol.name - Nome do protocolo
 * @param {boolean} props.isTaken - Se a dose foi tomada
 * @param {string} props.status - Status: 'taken', 'missed', ou 'scheduled'
 * @param {string} props.scheduledTime - Horário previsto (opcional)
 * @param {Function} props.onClick - Handler de click opcional
 * @param {number} props.index - Índice para animação staggered
 */
export function DoseListItem({ log, isTaken, status, scheduledTime, onClick, index = 0 }) {
  // Determinar o status efetivo
  const effectiveStatus = status || (isTaken ? 'taken' : 'missed')
  const medicineName = formatMedicineName(log.medicine?.name)
  const protocolName = log.protocol?.name || 'Protocolo'
  const unit = log.medicine?.type === 'cápsula' ? 'cápsula' : 'comprimido'
  // Usar expectedQuantity para doses futuras (scheduled/missed), quantity_taken para doses tomadas
  const quantity =
    effectiveStatus === 'taken'
      ? log.quantity_taken || 1
      : log.expectedQuantity || log.quantity_taken || 1
  const quantityLabel = getQuantityLabel(quantity, unit)

  // Horário real se tomada, ou previsto se perdida/agendada
  const displayTime =
    effectiveStatus === 'taken' ? formatTime(log.taken_at) : scheduledTime || '--:--'

  // Label de status em português
  const statusLabels = {
    taken: 'Tomada',
    missed: 'Perdida',
    scheduled: 'Agendada',
  }

  // Ícone baseado no status
  const statusIcons = {
    taken: '✓',
    missed: '✕',
    scheduled: '○',
  }

  return (
    <motion.div
      className={`dose-list-item dose-list-item--${effectiveStatus}`}
      role="listitem"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.05, // Staggered animation
      }}
      data-testid={`dose-list-item-${log.id}`}
    >
      <div className="dose-list-item__status" aria-hidden="true">
        <span className={`dose-status-icon dose-status-icon--${effectiveStatus}`}>
          {statusIcons[effectiveStatus]}
        </span>
      </div>

      <div className="dose-list-item__content">
        <div className="dose-list-item__header">
          <span className="dose-medicine-name" title={log.medicine?.name}>
            {medicineName}
          </span>
        </div>

        <div className="dose-list-item__details">
          <span className="dose-protocol-name">{protocolName}</span>
          <span className="dose-quantity" aria-label={`Quantidade: ${quantityLabel}`}>
            {quantityLabel}
          </span>
        </div>
      </div>

      <div className="dose-list-item__time">
        <time
          className="dose-time"
          dateTime={log.taken_at || scheduledTime}
          aria-label={
            effectiveStatus === 'taken'
              ? `Tomada às ${displayTime}`
              : `Prevista para ${displayTime}`
          }
        >
          {displayTime}
        </time>
        <span className={`dose-status-label dose-status-label--${effectiveStatus}`}>
          {statusLabels[effectiveStatus]}
        </span>
      </div>
    </motion.div>
  )
}

export default DoseListItem
