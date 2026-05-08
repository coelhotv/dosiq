import { useState } from 'react'
import Card from '@shared/components/ui/Card'
import Button from '@shared/components/ui/Button'

import StreakBadge from '@adherence/components/StreakBadge'

import Modal from '@shared/components/ui/Modal'
import TitrationTimeline from './TitrationTimeline'

import { FREQUENCY_LABELS } from '@schemas/protocolSchema'

import './ProtocolCard.css'

function _getProtocolFlags(protocol) {
  const titrationStatus = protocol?.titration_status?.toLowerCase()
  const hasTitration = titrationStatus && !['estável'].includes(titrationStatus)
  const hasSchedule = protocol?.titration_schedule?.length > 0
  return { hasTitration, hasSchedule, canShowTimeline: hasTitration && hasSchedule }
}

function _renderProtocolStatusBadge({ active, streak }) {
  return (
    <div className="protocol-header-badges">
      {streak > 0 && (
        <StreakBadge streak={streak} size="sm" showLabel={false} />
      )}
      <div className={`protocol-status ${active ? 'active' : 'inactive'}`}>
        {active ? '✅ Ativo' : '⏸️ Pausado'}
      </div>
    </div>
  )
}

function _renderTitrationSection(protocol) {
  if (!protocol.titration_status || protocol.titration_status === 'estável') return null
  return (
    <div className="detail-item titration">
      <span className={`titration-badge ${protocol.titration_status}`}>
        {protocol.titration_status === 'titulando' ? '📈 Titulando' : '🎯 Alvo Atingido'}
      </span>
      {protocol.titration_scheduler_data && (
        <div className="titration-card-progress">
          <div className="titration-progress-stats">
            <span>
              Etapa {protocol.titration_scheduler_data.currentStep}/
              {protocol.titration_scheduler_data.totalSteps}
            </span>
            <span>
              Dia {protocol.titration_scheduler_data.day}/
              {protocol.titration_scheduler_data.totalDays}
            </span>
          </div>
          <div className="titration-progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${protocol.titration_scheduler_data.progressPercent}%` }}
            />
          </div>
          {protocol.titration_scheduler_data.stageNote && (
            <p className="stage-objective">
              Objetivo: {protocol.titration_scheduler_data.stageNote}
            </p>
          )}
        </div>
      )}
      {protocol.titration_schedule?.length > 0 && (
        <div className="titration-schedule-preview">
          <h5>Cronograma Planejado:</h5>
          <div className="stages-timeline">
            {protocol.titration_schedule.map((stage, idx) => (
              <div
                key={idx}
                className={`timeline-stage ${idx === protocol.current_stage_index ? 'current' : idx < (protocol.current_stage_index || 0) ? 'past' : 'future'}`}
              >
                <span className="stage-dose-mini">{stage.dosage} comp.</span>
                <span className="stage-days-mini">{stage.days}d</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProtocolCard({ protocol, onEdit, onToggleActive, onDelete }) {
  const [showTimeline, setShowTimeline] = useState(false)
  const flags = _getProtocolFlags(protocol)
  const { canShowTimeline } = flags

  return (
    <Card className={`protocol-card ${!protocol.active ? 'inactive' : ''}`}>
      <div className="protocol-header">
        <div>
          <h4 className="protocol-name">{protocol.name}</h4>
          <span className="protocol-medicine">
            {protocol.medicine?.name}
            {protocol.medicine?.dosage_per_pill
              ? ` (${protocol.medicine.dosage_per_pill}${protocol.medicine.dosage_unit || 'mg'})`
              : ''}
          </span>
        </div>
        {_renderProtocolStatusBadge({ active: protocol.active, streak: protocol.streak })}
      </div>

      <div className="protocol-details">
        <div className="detail-item">
          <span className="detail-label">📅 Frequência:</span>
          <span className="detail-value">
            {FREQUENCY_LABELS[protocol.frequency] || protocol.frequency}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">💊 Dosagem:</span>
          <span className="detail-value">
            {protocol.dosage_per_intake}{' '}
            {protocol.medicine?.dosage_unit === 'ml'
              ? 'ml'
              : protocol.dosage_per_intake === 1
                ? 'unidade'
                : 'unidades'}
            {protocol.target_dosage && (
              <span className="titration-progress">
                {' '}
                (Alvo: {protocol.target_dosage}
                {protocol.medicine?.dosage_unit || 'mg'})
              </span>
            )}
          </span>
        </div>

        {_renderTitrationSection(protocol)}

        {protocol.time_schedule && protocol.time_schedule.length > 0 && (
          <div className="detail-item schedule">
            <span className="detail-label">⏰ Horários:</span>
            <div className="schedule-times">
              {protocol.time_schedule.map((time) => (
                <span key={time} className="time-badge">
                  {time}
                </span>
              ))}
            </div>
          </div>
        )}

        {protocol.notes && (
          <div className="detail-item notes">
            <span className="detail-label">📝 Observações:</span>
            <p className="detail-value">{protocol.notes}</p>
          </div>
        )}
      </div>

      <div className="protocol-actions">
        {canShowTimeline && (
          <Button variant="primary" size="sm" onClick={() => setShowTimeline(true)}>
            📈 Ver Timeline
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onEdit(protocol)}>
          ✏️ Editar
        </Button>
        <Button
          variant={protocol.active ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => onToggleActive(protocol)}
        >
          {protocol.active ? '⏸️ Pausar' : '▶️ Ativar'}
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(protocol)}>
          🗑️ Excluir
        </Button>
      </div>

      {canShowTimeline && (
        <Modal
          isOpen={showTimeline}
          onClose={() => setShowTimeline(false)}
          title={`Timeline: ${protocol.name}`}
        >
          <TitrationTimeline protocol={protocol} />
        </Modal>
      )}
    </Card>
  )
}
