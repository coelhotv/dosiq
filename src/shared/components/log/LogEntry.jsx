import './LogEntry.css'

export default function LogEntry({ log, onEdit, onDelete }) {
  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const { date, time } = formatDateTime(log.taken_at)

  return (
    <div className="log-entry">
      <div className="log-header">
        <div className="log-time">
          <span className="log-date">{date}</span>
          <span className="log-hour">{time}</span>
        </div>
        <div className="actions-header">
          {onEdit && (
            <button className="btn-edit-log" onClick={() => onEdit(log)}>
              ✏️ Editar
            </button>
          )}
          {onDelete && log.id && (
            <button className="btn-delete-log" onClick={() => {
              if (window.confirm('Excluir este registro de dose? O estoque será devolvido.')) {
                onDelete(log.id)
              }
            }}>
              🗑️
            </button>
          )}
          <div className="log-badge">
            ✅ Tomado
          </div>
        </div>
      </div>

      <div className="log-content">
        <div className="log-medicine">
          <h4>{log.medicine?.name}</h4>
          {log.protocol && (
            <span className="log-protocol">{log.protocol.name}</span>
          )}
        </div>

        <div className="log-details">
          <span className="log-quantity">
            {log.quantity_taken} {log.quantity_taken === 1 ? 'comprimido' : 'comprimidos'}
          </span>
        </div>

        {log.notes && (
          <div className="log-notes">
            <span className="notes-label">📝</span>
            <p>{log.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
