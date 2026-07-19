import { getNow } from '@utils/dateUtils'
import { formatIntakeDose } from '@dosiq/core'
import './ProtocolChecklistItem.css'

export default function ProtocolChecklistItem({ protocol, isSelected, onToggle }) {
  const getCurrentTime = () => {
    const now = getNow()
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const currentTime = getCurrentTime()

  return (
    <button
      type="button"
      className={`protocol-checklist-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onToggle(protocol.id)}
      aria-pressed={isSelected}
    >
      <div className="checklist-left">
        <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>{isSelected && '✓'}</div>
        <div className="checklist-info">
          <span className="checklist-name">💊 {protocol.name}</span>
          <div className="checklist-meta">
            {/* 029 F3.1: o ramo "Etapa X/Y" + a barra de progresso liam
                `titration_scheduler_data`, campo SEM produtor no repositório inteiro — o ternário
                caía SEMPRE aqui. Removidos (AP-301: código que aparenta capacidade que não
                existe). O que a web exibe da escada N2 é decisão do F6/T033b. */}
            <span className={`titration-badge ${protocol.titration_status}`}>
              {protocol.titration_status === 'titulando' ? '📈 Em evolução' : 'Estável'}
            </span>
            <span className="dosage-badge">
              {formatIntakeDose(protocol.dosage_per_intake, protocol.intake_unit, protocol.medicine)}
            </span>
          </div>
        </div>
      </div>

      <div className="checklist-right">
        <div className="time-pills">
          {protocol.time_schedule?.map((t) => (
            <span key={t} className={`time-pill ${t <= currentTime ? 'past' : ''}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
