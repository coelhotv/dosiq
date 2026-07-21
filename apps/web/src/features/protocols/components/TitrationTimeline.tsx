import { useMemo } from 'react'
import TitrationStep from './TitrationStep'
import { calculateTitrationData, getEvolutionBadge, formatDose, formatDaysLabel } from '@dosiq/core'
import './TitrationTimeline.css'

/**
 * Timeline da escada de titulação de um tratamento.
 *
 * 029 F6: lê `protocol.titration_steps` (entidade N2) via as funções do core — as mesmas do
 * mobile. Antes lia `protocol.titration_schedule`, o jsonb N1 que foi DROPADO; medido em prod
 * antes do DROP, ele estava VAZIO nas 68 linhas, então esta timeline nunca renderizou nada
 * real desde que existe (AP-301: a UI parecia viva porque o código existia).
 *
 * 🔴 As etapas DEVEM ser a escada COMPLETA (por `titration_id`) — quem monta é responsável por
 * isso (`attachFullLadders`, no core). O embed recortado por `protocol_id` costuma não conter a
 * etapa vigente, e a timeline apareceria sem o "você está aqui" (AP-311).
 */

/** `titration_steps.status` (CHECK conferido no banco) → estado visual do `TitrationStep`. */
const STEP_STATUS_MAP = {
  completed: 'completed',
  current: 'current',
  // Etapa seguinte esperando o usuário confirmar o avanço. Visualmente é futura (ainda não
  // começou); o "aguardando" vai na descrição, não como estado próprio — uma 4ª classe aqui
  // exigiria CSS que não existe e o estilo sumiria em silêncio.
  pending_confirmation: 'future',
  upcoming: 'future',
}

export default function TitrationTimeline({ protocol, compact = false, onStepClick = undefined }) {
  const steps = useMemo(
    () => (Array.isArray(protocol?.titration_steps) ? protocol.titration_steps : []),
    [protocol]
  )

  const ordered = useMemo(
    () => [...steps].sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0)),
    [steps]
  )

  // Progresso da etapa vigente. `null` = etapa CONTÍNUA (manutenção/alvo) ou sem etapa
  // vigente: a escada existe e é exibida, só não há contagem regressiva.
  const progress = useMemo(() => calculateTitrationData(steps), [steps])
  const badge = useMemo(() => getEvolutionBadge(steps), [steps])

  const viewSteps = useMemo(
    () =>
      ordered.map((s, idx) => ({
        key: s.id ?? `${s.position}-${idx}`,
        stepNumber: idx + 1,
        dose: s.dose,
        unit: s.intake_unit,
        // NULL = etapa CONTÍNUA: não vence e não avança sozinha. Exibir "0 dias" seria falso —
        // a ausência de prazo É a informação.
        durationDays: s.duration_days,
        status: STEP_STATUS_MAP[s.status] ?? 'future',
        startDate: s.started_at ?? null,
        endDate: s.ended_at ?? null,
        description: s.status === 'pending_confirmation' ? 'Aguardando sua confirmação' : null,
      })),
    [ordered]
  )

  if (viewSteps.length === 0) {
    return (
      <div className="titration-timeline empty">
        <p className="empty-message">Nenhuma evolução de dose definida para este tratamento</p>
      </div>
    )
  }

  const daysRemaining = progress?.daysRemaining ?? 0
  const progressPercent = Math.max(0, Math.min(100, Math.round(progress?.progressPercent ?? 0)))
  const isEvolving = badge.key === 'em_evolucao'

  // 🔴 "Não está evoluindo" NÃO é sinônimo de "chegou na manutenção" (RC6 #765). `estavel` cobre
  // três situações distintas, e só UMA delas merece comemoração:
  //   · etapa vigente CONTÍNUA  → chegou de fato à dose de manutenção;
  //   · escada ainda não iniciada (todas `upcoming`, nenhuma `current`) → não começou;
  //   · escada sem etapa vigente (tratamento pausado/encerrado, resíduo) → parada no meio.
  // O modelo N2 não tem chave 'pausado' — a distinção honesta que dá para fazer aqui é
  // "existe etapa vigente contínua?". Sem ela, dizer "🎯 Dose de manutenção" + 🎉 anunciaria
  // conclusão para quem não titulou um único dia.
  const hasCurrentStep = ordered.some((s) => s?.status === 'current')
  const reachedMaintenance = !isEvolving && hasCurrentStep
  const notStarted = !isEvolving && !hasCurrentStep

  const statusMessage = isEvolving
    ? `📈 Em evolução • Etapa ${progress?.currentStep ?? 1} de ${progress?.totalSteps ?? viewSteps.length}`
    : reachedMaintenance
      ? '🎯 Dose de manutenção'
      : '⏸️ Evolução não iniciada'

  const handleStepClick = (step) => {
    if (onStepClick) onStepClick(step)
  }

  // Modo compacto: apenas preview das etapas
  if (compact) {
    return (
      <div className="titration-timeline compact">
        <div className="timeline-preview">
          {viewSteps.map((step) => {
            const isClickable = Boolean(onStepClick)
            const Tag = isClickable ? 'button' : 'div'
            return (
              <Tag
                key={step.key}
                type={isClickable ? 'button' : undefined}
                className={`preview-step ${step.status}`}
                onClick={() => handleStepClick(step)}
                // A descrição volta ao tooltip (RC6 #765): no N2 ela só existe na etapa
                // `pending_confirmation`, e é justamente ali que o modo compacto precisa dizer
                // por que a bolinha está parada ("Aguardando sua confirmação").
                title={`${step.description || `Etapa ${step.stepNumber}`}: ${formatDose(step.dose, step.unit)}`}
              >
                <span className="preview-dose">{step.dose}</span>
                <span className="preview-unit">{step.unit}</span>
              </Tag>
            )
          })}
        </div>

        {progress && (
          <div className="timeline-progress-mini">
            <div className="progress-bar-mini">
              <div className="progress-fill-mini" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="progress-text-mini">
              {daysRemaining > 0
                ? formatDaysLabel(daysRemaining)
                : 'avanço pendente'}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="titration-timeline">
      <div className="timeline-header">
        <div className="timeline-title">
          <h4>Evolução da dose</h4>
          <span
            className={`timeline-status ${isEvolving ? 'active' : reachedMaintenance ? 'complete' : 'paused'}`}
          >
            {statusMessage}
          </span>
        </div>

        {progress && (
          <div className="timeline-progress">
            <div className="progress-info">
              <span className="progress-label">Progresso da etapa</span>
              <span className="progress-value">{progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            {daysRemaining > 0 && (
              <span className="days-remaining">{formatDaysLabel(daysRemaining)}</span>
            )}
          </div>
        )}
      </div>

      <div className="timeline-steps">
        {viewSteps.map((step, index) => {
          const isClickable = Boolean(onStepClick)
          const Tag = isClickable ? 'button' : 'div'
          return (
            <Tag
              key={step.key}
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
                isLast={index === viewSteps.length - 1}
                daysRemaining={step.status === 'current' ? daysRemaining : 0}
              />
            </Tag>
          )
        })}
      </div>

      <div className="timeline-footer">
        {isEvolving && daysRemaining > 0 && (
          <div className="next-step-info">
            <span className="info-icon">⏰</span>
            <span className="info-text">
              Próxima mudança de dose em{' '}
              <strong>{formatDaysLabel(daysRemaining)}</strong>
            </span>
          </div>
        )}

        {reachedMaintenance && (
          <div className="completion-message">
            <span className="info-icon">🎉</span>
            <span className="info-text">Você chegou à dose de manutenção!</span>
          </div>
        )}

        {notStarted && (
          <div className="next-step-info">
            <span className="info-icon">⏸️</span>
            <span className="info-text">Nenhuma etapa em curso nesta evolução.</span>
          </div>
        )}
      </div>
    </div>
  )
}
