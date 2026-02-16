import Button from '../ui/Button'
import './TitrationTransitionAlert.css'

export default function TitrationTransitionAlert({ protocol, onAdvance, onDismiss }) {
  if (!protocol?.titration_scheduler_data?.isTransitionDue) return null

  const currentStage = protocol.titration_schedule[protocol.current_stage_index]
  const nextStageIndex = protocol.current_stage_index + 1
  const nextStage = protocol.titration_schedule[nextStageIndex]

  // Se não há próxima etapa, significa que chegou ao fim
  const isFinalStage = !nextStage

  return (
    <div className="titration-transition-alert">
      <div className="alert-icon">⚠️</div>
      <div className="alert-content">
        <h4>
          {isFinalStage
            ? '🎯 Protocolo de Titulação Concluído!'
            : '📈 Hora de Avançar para a Próxima Etapa'}
        </h4>
        <p className="alert-protocol-name">
          <strong>{protocol.medicine?.name}</strong> - {protocol.name}
        </p>

        {isFinalStage ? (
          <div className="transition-info">
            <p>
              Você completou todas as etapas do protocolo de titulação! A dose atual de{' '}
              <strong>{currentStage.dosage} comp.</strong> é a dose de manutenção.
            </p>
            <p className="alert-note">{currentStage.note}</p>
          </div>
        ) : (
          <div className="transition-info">
            <div className="stage-comparison">
              <div className="stage-box current">
                <span className="stage-label">Etapa Atual</span>
                <span className="stage-number">Etapa {protocol.current_stage_index + 1}</span>
                <span className="stage-dose">{currentStage.dosage} comp. por horário</span>
                <span className="stage-note">{currentStage.note}</span>
              </div>
              <div className="arrow">→</div>
              <div className="stage-box next">
                <span className="stage-label">Próxima Etapa</span>
                <span className="stage-number">Etapa {nextStageIndex + 1}</span>
                <span className="stage-dose">{nextStage.dosage} comp. por horário</span>
                <span className="stage-note">{nextStage.note}</span>
              </div>
            </div>
            <p className="transition-duration">
              Duração da próxima etapa: <strong>{nextStage.days} dias</strong>
            </p>
          </div>
        )}
      </div>

      <div className="alert-actions">
        {isFinalStage ? (
          <Button variant="primary" onClick={() => onAdvance(protocol.id, true)}>
            ✅ Marcar como Concluído
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => onDismiss(protocol.id)}>
              Lembrar Depois
            </Button>
            <Button variant="primary" onClick={() => onAdvance(protocol.id, false)}>
              🚀 Avançar Agora
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
