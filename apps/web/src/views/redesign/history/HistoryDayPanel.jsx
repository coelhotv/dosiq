// src/views/redesign/history/HistoryDayPanel.jsx
// S10C.3 — Painel de doses do dia selecionado no calendário.
// PR-F4.2/S4.3 — agora consome a timeline event-agnóstica: itera `dayEvents` e resolve o
// renderizador por `event.type` via registry (FP-3/ADR-050). Reflete o estado real
// (taken/missed/pending), não só doses tomadas.

import { resolveEventCard } from './eventCardRegistry'
import { parseLocalDate } from '@utils/dateUtils'

/**
 * Painel de eventos do dia selecionado no calendário.
 *
 * @param {Object} props
 * @param {Date|string} props.selectedDate - Data selecionada no calendário.
 * @param {import('@dosiq/core').TimelineEvent[]} props.dayEvents - Eventos do dia local
 *   (já filtrados/ordenados pelo container). Cada um tem `{ id, type, occurred_at, payload }`.
 * @param {Function} props.onEditLog - callback(log) p/ editar (só eventos com log).
 * @param {Function} props.onDeleteLog - callback(logId) p/ excluir (só eventos com log).
 */
export default function HistoryDayPanel({ selectedDate, dayEvents = [], onEditLog, onDeleteLog }) {
  // Formatar data para exibição
  const dateLabel = selectedDate
    ? (typeof selectedDate === 'string' ? parseLocalDate(selectedDate) : selectedDate)
        .toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
    : ''

  // Capitalizar primeira letra (pt-BR retorna minúsculo)
  const formattedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  const count = dayEvents.length
  const takenCount = dayEvents.filter((ev) => ev.payload?.status === 'taken').length
  const countLabel = `${takenCount}/${count} ${count === 1 ? 'dose' : 'doses'}`
  const countTooltip = `${takenCount} ${takenCount === 1 ? 'dose tomada' : 'doses tomadas'} de ${count} ${count === 1 ? 'agendada' : 'agendadas'}`

  return (
    <div className="hhr-day-panel">
      <div className="hhr-day-panel__header">
        <div className="hhr-day-panel__heading">
          <h3 className="hhr-day-panel__title">Doses do Dia</h3>
          <span className="hhr-day-panel__date">{formattedDate}</span>
        </div>
        <span className="hhr-day-panel__count" title={countTooltip}>{countLabel}</span>
      </div>

      {count === 0 ? (
        <div className="hhr-day-panel__empty">
          <span className="hhr-day-panel__empty-text">Nenhuma dose registrada neste dia.</span>
        </div>
      ) : (
        <div className="hhr-day-panel__list">
          {dayEvents.map((event) => {
            const Card = resolveEventCard(event.type)
            if (!Card) return null // tipo não registrado: ignora sem quebrar a stream
            return <Card key={event.id} event={event} onEdit={onEditLog} onDelete={onDeleteLog} />
          })}
        </div>
      )}
    </div>
  )
}
