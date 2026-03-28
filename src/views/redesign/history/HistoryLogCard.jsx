// src/views/redesign/history/HistoryLogCard.jsx
// S10C — Card de dose para o HistoryDayPanel (substitui LogEntry no contexto do histórico)

import { PencilLine, Trash2 } from 'lucide-react'

/**
 * Card de dose para o painel do dia no histórico.
 * Diferente de LogEntry: só mostra horário (sem data), sem badge "Tomado",
 * ícones Lucide, pílula de dosagem ao lado do nome.
 *
 * @param {Object} props
 * @param {Object} props.log - Objeto de log com: { id, taken_at, quantity_taken, medicine, protocol }
 * @param {Function} props.onEdit - Callback com o objeto log para edição
 * @param {Function} props.onDelete - Callback com o id do log para exclusão
 */
export default function HistoryLogCard({ log, onEdit, onDelete }) {
  const timeLabel = log.taken_at
    ? new Date(log.taken_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const medicineName = log.medicine?.name ?? 'Medicamento'
  const protocolName = log.protocol?.name ?? null

  // Pílula de dosagem: "500mg" ou "10mcg" a partir dos dados do medicamento
  const dosageLabel = (() => {
    const dpp = log.medicine?.dosage_per_pill
    const unit = log.medicine?.dosage_unit ?? ''
    if (!dpp) return null
    return `${dpp}${unit}`
  })()

  // Quantidade tomada: "1 comprimido", "2 comprimidos", "0.5 comprimido"
  const quantityLabel = (() => {
    const qty = log.quantity_taken
    if (!qty) return null
    return qty === 1 ? '1 comprimido' : `${qty} comprimidos`
  })()

  return (
    <div className="hlc-card">
      <div className="hlc-card__main">
        <div className="hlc-card__info">
          <div className="hlc-card__title-row">
            <span className="hlc-card__name">{medicineName}</span>
            {dosageLabel && (
              <span className="hlc-card__dosage-pill">{dosageLabel}</span>
            )}
          </div>
          {protocolName && (
            <span className="hlc-card__protocol">{protocolName}</span>
          )}
          {quantityLabel && (
            <span className="hlc-card__quantity">{quantityLabel}</span>
          )}
        </div>
        <span className="hlc-card__time">{timeLabel}</span>
      </div>

      <div className="hlc-card__actions">
        <button
          className="hlc-card__btn hlc-card__btn--edit"
          onClick={() => onEdit(log)}
          aria-label="Editar registro"
          title="Editar"
        >
          <PencilLine size={14} />
        </button>
        <button
          className="hlc-card__btn hlc-card__btn--delete"
          onClick={() => onDelete(log.id)}
          aria-label="Excluir registro"
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
