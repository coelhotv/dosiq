import './TitrationStep.css'

/**
 * Componente de etapa individual da timeline de titulação
 * 
 * @param {Object} props
 * @param {number} props.stepNumber - Número da etapa
 * @param {number} props.dose - Dose da etapa
 * @param {string} props.unit - Unidade da dose (mg, ml, etc)
 * @param {number} props.durationDays - Duração em dias
 * @param {'completed'|'current'|'future'} props.status - Status da etapa
 * @param {Date} [props.startDate] - Data de início
 * @param {Date} [props.endDate] - Data de fim
 * @param {string} [props.description] - Descrição da etapa
 * @param {boolean} [props.isLast] - Se é a última etapa
 * @param {number} [props.daysRemaining] - Dias restantes (para etapa atual)
 */
export default function TitrationStep({
  stepNumber,
  dose,
  unit,
  durationDays,
  status,
  startDate,
  endDate,
  description,
  isLast = false,
  daysRemaining = 0
}) {
  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return '✓'
      case 'current':
        return '●'
      default:
        return '○'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'completed':
        return 'Concluído'
      case 'current':
        return 'Você está aqui'
      default:
        return 'Futuro'
    }
  }

  return (
    <div className={`titration-step ${status}`}>
      <div className="step-connector">
        {!isLast && <div className="connector-line" />}
        <div className={`step-indicator ${status}`}>
          <span className="step-icon">{getStatusIcon()}</span>
        </div>
      </div>

      <div className="step-content">
        <div className="step-header">
          <span className="step-number">Etapa {stepNumber}</span>
          {status === 'current' && (
            <span className="step-badge current">{getStatusLabel()}</span>
          )}
        </div>

        <div className="step-dose">
          <span className="dose-value">{dose}</span>
          <span className="dose-unit">{unit}</span>
          <span className="dose-divider">•</span>
          <span className="duration">{durationDays} dias</span>
        </div>

        {description && (
          <p className="step-description">{description}</p>
        )}

        <div className="step-dates">
          {startDate && (
            <span className="date-start">{formatDate(startDate)}</span>
          )}
          {startDate && endDate && (
            <span className="date-separator">→</span>
          )}
          {endDate && (
            <span className="date-end">{formatDate(endDate)}</span>
          )}
        </div>

        {status === 'current' && daysRemaining > 0 && (
          <div className="step-countdown">
            <span className="countdown-label">Próxima etapa em:</span>
            <span className="countdown-value">
              {daysRemaining === 1 ? '1 dia' : `${daysRemaining} dias`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}