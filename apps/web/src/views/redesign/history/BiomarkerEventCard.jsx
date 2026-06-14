// src/views/redesign/history/BiomarkerEventCard.jsx
// 012 Fase C / FR-011 — Renderizador do evento `biomarker` na timeline event-agnóstica
// (FP-3/ADR-050/R-252). Card "registro tintado" (fundo infoSoft, plano, sem sombra, sem botão,
// IconRuler inline): elevação=ação (dose), tinta=registro (medida) — medida nunca com mais peso
// visual que dose (AP-018 do handoff). Read-only na timeline (edição/exclusão no hub de Medidas).
// SaMD (ADR-062): cor diferencia TIPO, nunca qualidade do valor. Sem meta/alvo.

import { Ruler, PencilLine, Trash2 } from 'lucide-react'
import { parseISO, BIOMARKER_TYPE_LABELS, BIOMARKER_CONTEXT_LABELS } from '@dosiq/core'

// Reconstrói a linha de biomarkers_log a partir do payload do evento (p/ edição/exclusão).
function eventToMeasure(event) {
  const p = event.payload || {}
  return {
    id: p.biomarkerId,
    type: p.biomarkerType,
    value: p.value,
    value_secondary: p.valueSecondary ?? null,
    unit: p.unit,
    context: p.context ?? null,
    measured_at: event.occurred_at,
  }
}

/** Formata "value[/value_secondary] unit" PT-BR (PA = "12/8"; demais = valor único). */
function formatMeasure(p) {
  const v = String(p.value).replace('.', ',')
  if (p.valueSecondary != null) {
    return `${v}/${String(p.valueSecondary).replace('.', ',')} ${p.unit}`
  }
  return `${v} ${p.unit}`
}

/**
 * Card de um evento `biomarker` no painel do dia.
 *
 * @param {Object} props
 * @param {import('@dosiq/core').TimelineEvent} props.event - evento de `type='biomarker'`.
 * @param {string} [props.timezone='America/Sao_Paulo'] - fuso do usuário p/ exibir a hora (AP-194).
 */
export default function BiomarkerEventCard({ event, timezone = 'America/Sao_Paulo', onEditMeasure, onDeleteMeasure }) {
  const p = event.payload || {}
  const label = BIOMARKER_TYPE_LABELS[p.biomarkerType] || p.biomarkerType
  const ctx = p.context ? BIOMARKER_CONTEXT_LABELS[p.context] : null

  const timeLabel = event.occurred_at
    ? parseISO(event.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
    : ''

  const measure = eventToMeasure(event)

  return (
    <div className="hlc-card hlc-card--biomarker">
      <div className="hlc-card__info">
        <div className="hlc-card__title-row">
          <Ruler size={14} className="hlc-card__bio-icon" aria-hidden="true" />
          <span className="hlc-card__name">{label} {formatMeasure(p)}</span>
        </div>
        {ctx && <span className="hlc-card__quantity">{ctx}</span>}
      </div>
      <div className="hlc-card__side">
        <span className="hlc-card__time">{timeLabel}</span>
        <div className="hlc-card__actions">
          <button
            className="hlc-card__btn hlc-card__btn--edit"
            onClick={() => onEditMeasure?.(measure)}
            aria-label="Editar medida"
            title="Editar"
          >
            <PencilLine size={14} />
          </button>
          <button
            className="hlc-card__btn hlc-card__btn--delete"
            onClick={() => onDeleteMeasure?.(measure)}
            aria-label="Excluir medida"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
