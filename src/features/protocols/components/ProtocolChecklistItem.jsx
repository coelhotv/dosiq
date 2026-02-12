import './ProtocolChecklistItem.css'

export default function ProtocolChecklistItem({ protocol, isSelected, onToggle }) {
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const currentTime = getCurrentTime()

  return (
    <div 
      className={`protocol-checklist-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onToggle(protocol.id)}
    >
      <div className="checklist-left">
        <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && '✓'}
        </div>
        <div className="checklist-info">
          <span className="checklist-name">💊 {protocol.name}</span>
          <div className="checklist-meta">
            {protocol.titration_scheduler_data ? (
              <div className="titration-mini-status">
                <span className="titration-step-badge">
                  Etapa {protocol.titration_scheduler_data.currentStep}/{protocol.titration_scheduler_data.totalSteps}
                </span>
                <span className="titration-days-text">
                  Dia {protocol.titration_scheduler_data.day}/{protocol.titration_scheduler_data.totalDays}
                </span>
              </div>
            ) : (
              <span className={`titration-badge ${protocol.titration_status}`}>
                {protocol.titration_status === 'titulando' ? '📈 Titulando' : 'Estável'}
              </span>
            )}
            <span className="dosage-badge">
              {protocol.dosage_per_intake} {protocol.dosage_per_intake === 1 ? 'comp.' : 'comps.'}
            </span>
          </div>
          {protocol.titration_scheduler_data && (
            <div className="titration-progress-bar-container">
               <div 
                 className="titration-progress-bar-fill" 
                 style={{ width: `${protocol.titration_scheduler_data.progressPercent}%` }}
               />
            </div>
          )}
        </div>
      </div>

      <div className="checklist-right">
        <div className="time-pills">
          {protocol.time_schedule?.map(t => (
            <span 
              key={t} 
              className={`time-pill ${t <= currentTime ? 'past' : ''}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
