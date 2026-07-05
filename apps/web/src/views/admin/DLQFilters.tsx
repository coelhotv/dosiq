import React from 'react'

export default function DLQFilters({ statusFilter, onStatusChange, total }) {
  return (
    <div className="dlq-admin__controls">
      <div className="dlq-admin__filter">
        <label htmlFor="status-filter">Filtrar por status:</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={onStatusChange}
          className="dlq-admin__select"
        >
          <option value="">Todos</option>
          <option value="pending">Pendente</option>
          <option value="retrying">Retentando</option>
          <option value="resolved">Resolvido</option>
          <option value="discarded">Descartado</option>
        </select>
      </div>

      <div className="dlq-admin__stats">
        <span className="dlq-admin__stat">
          <strong>{total}</strong> notificações
        </span>
      </div>
    </div>
  )
}
