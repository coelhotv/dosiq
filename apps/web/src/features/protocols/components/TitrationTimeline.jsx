import { useMemo } from 'react'
import TitrationStep from './TitrationStep'
import {
  calculateTitrationSteps,
  formatDaysRemaining,
  isTitrationActive,
  hasReachedTarget,
} from '@protocols/services/titrationService'
import './TitrationTimeline.css'

/**
 * Componente de timeline de titulação
 *
 * Exibe todas as etapas de um protocolo de titulação com:
 * - Etapas concluídas (verde)
 * - Etapa atual (azul com destaque)
 * - Etapas futuras (cinza)
 * - Dias restantes para próxima etapa
 *
 * @param {Object} props
 * @param {Object} props.protocol - Protocolo com dados de titulação
 * @param {boolean} [props.compact=false] - Modo compacto (para cards)
 * @param {function} [props.onStepClick] - Callback ao clicar em uma etapa
 */
export default function TitrationTimeline({ protocol, compact = false, onStepClick }) {
  const titrationData = useMemo(() => {
    if (!protocol?.titration_schedule?.length) {
      return null
    }
    return calculateTitrationSteps(protocol)
  }, [protocol])

  if (!titrationData) {
    return (
      <div className="titration-timeline empty">
        <p className="empty-message">Nenhum cronograma de titulação definido</p>
      </div>
    )
  }

  const { steps, currentStep, totalSteps, daysUntilNext, progressPercent } = titrationData

  const isActive = isTitrationActive(protocol)
  const isComplete = hasReachedTarget(protocol)

  const getStatusMessage = () => {
    if (isComplete) return '🎯 Alvo atingido!'
    if (isActive) return `📈 Em titulação • Etapa ${currentStep} de ${totalSteps}`
    return '⏸️ Titulação pausada'
  }

  const handleStepClick = (step) => {
    if (onStepClick) {
      onStepClick(step)
    }
  }

  // Modo compacto: apenas preview das etapas
  if (compact) {
    return (
      <div className="titration-timeline compact">
        <div className="timeline-preview">
          {steps.map((step) => {
            const isClickable = Boolean(onStepClick)
            const Tag = isClickable ? 'button' : 'div'
            return (
              <Tag
                key={step.stepNumber}
                type={isClickable ? 'button' : undefined}
                className={`preview-step ${step.status}`}
                onClick={() => handleStepClick(step)}
                title={`${step.description || `Etapa ${step.stepNumber}`}: ${step.dose}${step.unit}`}
              >
                <span className="preview-dose">{step.dose}</span>
                <span className="preview-unit">{step.unit}</span>
              </Tag>
            )
          })}
        </div>

        <div className="timeline-progress-mini">
          <div className="progress-bar-mini">
            <div className="progress-fill-mini" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="progress-text-mini">{formatDaysRemaining(daysUntilNext)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="titration-timeline">
      <div className="timeline-header">
        <div className="timeline-title">
          <h4>Cronograma de Titulação</h4>
          <span
            className={`timeline-status ${isActive ? 'active' : isComplete ? 'complete' : 'paused'}`}
          >
            {getStatusMessage()}
          </span>
        </div>

        <div className="timeline-progress">
          <div className="progress-info">
            <span className="progress-label">Progresso geral</span>
            <span className="progress-value">{progressPercent}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          {daysUntilNext > 0 && (
            <span className="days-remaining">{formatDaysRemaining(daysUntilNext)}</span>
          )}
        </div>
      </div>

      <div className="timeline-steps">
        {steps.map((step, index) => {
          const isClickable = Boolean(onStepClick)
          const Tag = isClickable ? 'button' : 'div'
          return (
            <Tag
              key={step.stepNumber}
              type={isClickable ? 'button' : undefined}
              className="timeline-step-wrapper"
              onClick={() => handleStepClick(step)}
            >
            <TitrationStep
              stepNumber={step.stepNumber}
              dose={step.dose}
              unit={step.unit}
              durationDays={step.durationDays}
              status={step.status}
              startDate={step.startDate}
              endDate={step.endDate}
              description={step.description}
              isLast={index === steps.length - 1}
              daysRemaining={step.status === 'current' ? daysUntilNext : 0}
            />
          </Tag>
        )
      })}
      </div>

      <div className="timeline-footer">
        {isActive && daysUntilNext > 0 && (
          <div className="next-step-info">
            <span className="info-icon">⏰</span>
            <span className="info-text">
              Próxima mudança de dose em{' '}
              <strong>
                {daysUntilNext} {daysUntilNext === 1 ? 'dia' : 'dias'}
              </strong>
            </span>
          </div>
        )}

        {isComplete && (
          <div className="completion-message">
            <span className="info-icon">🎉</span>
            <span className="info-text">Você atingiu a dose de manutenção!</span>
          </div>
        )}
      </div>
    </div>
  )
}
