import { useState } from 'react'
import Card from '@shared/components/ui/Card'
import Button from '@shared/components/ui/Button'

import StreakBadge from '@adherence/components/StreakBadge'
const StreakBadgeAny: any = StreakBadge

import Modal from '@shared/components/ui/Modal'
import TitrationTimeline from './TitrationTimeline'

import { FREQUENCY_LABELS } from '@schemas/protocolSchema'
import { getProtocolDays } from '@utils/adherenceLogic'
import { formatIntakeDose, formatConcentration, getEvolutionBadge } from '@dosiq/core'

import './ProtocolCard.css'

const WEEKDAY_ABBREVIATIONS = {
  domingo: 'Dom',
  segunda: 'Seg',
  terça: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sábado: 'Sáb',
}

const VISUAL_ORDER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function formatWeekdaysLabel(weekdays = []) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return ''
  const sorted = [...weekdays].sort(
    (a, b) => VISUAL_ORDER.indexOf(a) - VISUAL_ORDER.indexOf(b)
  )
  return sorted.map((d) => WEEKDAY_ABBREVIATIONS[d] || d).join(', ')
}

// 029 F6: as flags saem da escada N2 (`titration_steps`), pelo mesmo `getEvolutionBadge` do
// mobile. Antes vinham de `titration_status`/`titration_schedule` — colunas dropadas que, em
// prod, estavam respectivamente `'estável'` e `[]` em 100% das linhas: `canShowTimeline` era
// sempre false e esta seção nunca apareceu para ninguém (AP-301).
function _getProtocolFlags(protocol) {
  const steps = Array.isArray(protocol?.titration_steps) ? protocol.titration_steps : []
  const hasTitration = getEvolutionBadge(steps).key === 'em_evolucao'
  const hasSchedule = steps.length > 0
  // A timeline vale a pena sempre que EXISTE escada — inclusive na dose de manutenção, em que
  // o histórico das etapas percorridas é justamente o que o usuário quer rever. Exigir
  // "em evolução" esconderia a escada concluída.
  return { hasTitration, hasSchedule, canShowTimeline: hasSchedule }
}

function _renderProtocolStatusBadge({ active, streak }) {
  return (
    <div className="protocol-header-badges">
      {streak > 0 && (
        <StreakBadgeAny streak={streak} size="sm" showLabel={false} />
      )}
      <div className={`protocol-status ${active ? 'active' : 'inactive'}`}>
        {active ? '✅ Ativo' : '⏸️ Pausado'}
      </div>
    </div>
  )
}

/**
 * Badge "Em evolução" no corpo do card.
 *
 * 029 F6: derivado da escada N2 pelo `getEvolutionBadge` do core — fonte ÚNICA, a mesma do
 * `EvolutionBadge` mobile (o PO decidiu em 2026-07-17 que a web mantém a leitura justamente
 * para as duas superfícies contarem a mesma história). O preview do cronograma que vivia aqui
 * lia o jsonb N1 e foi substituído pela `TitrationTimeline`, logo abaixo no mesmo card, que
 * mostra a escada de verdade em vez de um resumo paralelo que podia divergir dela.
 *
 * "Estável" não rende badge: é o estado normal de quem não está titulando, e um selo para
 * cada tratamento estável vira ruído (§2 da spec — mesma decisão do mobile).
 */
function _renderTitrationSection(protocol) {
  const steps = Array.isArray(protocol?.titration_steps) ? protocol.titration_steps : []
  const badge = getEvolutionBadge(steps)
  if (badge.key !== 'em_evolucao') return null
  return (
    <div className="detail-item titration">
      <span className="titration-badge em_evolucao">📈 {badge.label}</span>
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
              ? ` (${formatConcentration(protocol.medicine.dosage_per_pill, protocol.medicine.dosage_unit, protocol.medicine.concentration_volume_ml)})`
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
            {(protocol.frequency === 'semanal' || protocol.frequency === 'personalizado') && (
              (() => {
                const daysSource = getProtocolDays(protocol)
                return daysSource.length > 0 ? ` (${formatWeekdaysLabel(daysSource)})` : ''
              })()
            )}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">💊 Dosagem:</span>
          <span className="detail-value">
            {formatIntakeDose(protocol.dosage_per_intake, protocol.intake_unit, protocol.medicine)}
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
