// src/views/redesign/history/HistoryDayPanel.jsx
// S10C.3 — Wave 10C: Painel de doses do dia selecionado no calendário

import HistoryLogCard from './HistoryLogCard'

/**
 * Painel de doses do dia selecionado no calendário.
 *
 * @param {Object} props
 * @param {Date} props.selectedDate - Data selecionada no calendário (objeto Date)
 * @param {Array} props.dayLogs - Array de logs filtrados para o dia selecionado.
 *   Cada log tem: { id, taken_at, quantity_taken, notes, medicine: { name }, protocol: { name } }
 * @param {Function} props.onEditLog - Callback chamado com o objeto log quando usuário quer editar.
 *   Assinatura: onEditLog(log) → abre modal de edição no componente pai.
 * @param {Function} props.onDeleteLog - Callback chamado com o id do log quando usuário quer deletar.
 *   Assinatura: onDeleteLog(logId) → deleta e remove do state no componente pai.
 */
export default function HistoryDayPanel({
  selectedDate,
  dayLogs,
  onEditLog,
  onDeleteLog,
}) {
  // Formatar data para exibição
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  // Capitalizar primeira letra (pt-BR retorna minúsculo)
  const formattedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  return (
    <div className="hhr-day-panel">
      <div className="hhr-day-panel__header">
        <h3 className="hhr-day-panel__title">Doses do Dia</h3>
        <span className="hhr-day-panel__date">{formattedDate}</span>
      </div>

      {dayLogs.length === 0 ? (
        <div className="hhr-day-panel__empty">
          <span className="hhr-day-panel__empty-text">
            Nenhuma dose registrada neste dia.
          </span>
        </div>
      ) : (
        <div className="hhr-day-panel__list">
          {dayLogs.map((log) => (
            <HistoryLogCard
              key={log.id}
              log={log}
              onEdit={onEditLog}
              onDelete={onDeleteLog}
            />
          ))}
        </div>
      )}
    </div>
  )
}
