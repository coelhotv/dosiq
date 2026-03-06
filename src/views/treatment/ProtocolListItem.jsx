import './Treatment.css'

const FREQUENCY_LABELS = {
  diario: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
}

export default function ProtocolListItem({ protocol, onEdit, onPause }) {
  const medicine = protocol.medicine || {}
  const freq = FREQUENCY_LABELS[protocol.frequency] || protocol.frequency
  const times = protocol.time_schedule?.join(', ') || ''

  return (
    <div className="protocol-list-item">
      <div className="protocol-list-item__info">
        <span className="protocol-list-item__name">{medicine.name || 'Medicamento'}</span>
        <span className="protocol-list-item__detail">
          {protocol.dosage_per_intake ?? 1}× · {freq}
          {times && ` · ${times}`}
        </span>
      </div>
      <div className="protocol-list-item__actions">
        {onEdit && (
          <button
            className="protocol-list-item__btn"
            onClick={() => onEdit(protocol)}
            aria-label={`Editar ${medicine.name}`}
          >
            ✏️
          </button>
        )}
        {onPause && (
          <button
            className="protocol-list-item__btn"
            onClick={() => onPause(protocol.id)}
            aria-label={`Pausar ${medicine.name}`}
          >
            ⏸️
          </button>
        )}
      </div>
    </div>
  )
}
