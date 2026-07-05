// src/views/history/DoseEventCard.jsx
// PR-F4.2/S4.3 — Renderizador do evento `dose` na timeline event-agnóstica (FP-3/ADR-050).
// Substitui o HistoryLogCard (log-only) no painel do dia: agora reflete o ESTADO real
// materializado em dose_instances — taken / missed / pending — não só doses tomadas.

import { PencilLine, Trash2, Check, X, Clock, LocateFixed } from 'lucide-react'
import { parseISO } from '@utils/dateUtils'
import { isLiquidMedicine, formatDose, formatConcentration, getInjectionSiteLabel } from '@dosiq/core'

/** Metadados visuais por status (ícone + label + classe). Idoso-friendly: ícone + texto (R-137/R-138). */
const STATUS_META = {
  taken: { label: 'Tomada', Icon: Check, cls: 'taken' },
  missed: { label: 'Perdida', Icon: X, cls: 'missed' },
  pending: { label: 'Pendente', Icon: Clock, cls: 'pending' },
}

/**
 * Reconstrói um objeto log-shaped a partir do payload do evento, p/ alimentar o LogForm
 * (edição) e o delete. Só faz sentido quando o evento está ancorado a um `medicine_log`
 * (taken ancorado OU log avulso). missed/pending NÃO têm log → sem ação.
 */
function eventToLog(event) {
  const p = event.payload || {}
  if (!p.logId) return null
  return {
    id: p.logId,
    taken_at: event.occurred_at,
    quantity_taken: p.quantityTaken ?? null,
    notes: p.notes ?? null,
    medicine_id: p.medicineId ?? null,
    protocol_id: p.protocolId ?? null,
    // Sítio de injeção (031/FR-011) — pré-popula o LogForm na edição; oral/legado = null.
    injection_site: p.injectionSite ?? null,
  }
}

/**
 * Card de um evento `dose` no painel do dia.
 *
 * @param {Object} props
 * @param {import('@dosiq/core').TimelineEvent} props.event - evento de `type='dose'`.
 * @param {Function} props.onEdit - callback(log) p/ abrir edição (só eventos com log).
 * @param {Function} props.onDelete - callback(logId) p/ excluir (só eventos com log).
 * @param {string} [props.timezone='America/Sao_Paulo'] - fuso do usuário p/ exibir a hora
 *        (occurred_at é UTC absoluto; sem timeZone o navegador usaria o fuso local → AP-194).
 */
export default function DoseEventCard({ event, onEdit, onDelete, timezone = 'America/Sao_Paulo' }) {
  const p = event.payload || {}
  const status = p.status || 'pending'
  const meta = STATUS_META[status] || STATUS_META.pending
  const { Icon } = meta

  // occurred_at: instante real da tomada (taken) ou horário agendado (missed/pending).
  // Renderiza no fuso do usuário (timeZone) — nunca no fuso do navegador (AP-194).
  const timeLabel = event.occurred_at
    ? parseISO(event.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
    : ''

  const medicineName = p.medicineName ?? 'Medicamento'

  const medicineLike = {
    dosage_unit: p.dosageUnit,
    dosage_per_pill: p.dosagePerPill,
    units_per_ml: p.unitsPerMl,
  }
  const isLiquid = isLiquidMedicine(medicineLike)

  // Pílula de concentração (ex: "100 UI/ml"). Líquido usa formatConcentration p/
  // casing correto; sólido mantém expected_dose + unidade.
  const dosageLabel = (() => {
    if (isLiquid) return formatConcentration(p.dosagePerPill, p.dosageUnit) || null
    const dose = p.expectedDose
    const unit = p.dosageUnit ?? ''
    if (dose == null) return null
    return `${dose}${unit}`
  })()

  // Quantidade tomada (só faz sentido em taken). Unidade-aware (FP-4/ADR-050): não assume
  // comprimido p/ líquido(ml)/inalador(un)/insulina(ui). 0 é válido (titulação) → checa null.
  const quantityLabel = (() => {
    const qty = p.quantityTaken
    if (qty === undefined || qty === null) return null
    // Líquido (022): unidade de tomada do tratamento (gotas/ml/UI) → "10 UI".
    if (isLiquid) return formatDose(qty, p.intakeUnit || 'ml')
    const unit = p.dosageUnit ?? ''
    const u = unit.toLowerCase()
    if (!u || ['mg', 'mcg', 'g'].includes(u)) {
      return qty === 1 ? '1 comprimido' : `${qty} comprimidos`
    }
    if (u === 'un') {
      return qty === 1 ? '1 unidade' : `${qty} unidades`
    }
    return `${qty} ${unit}`
  })()

  // Local de aplicação (031/US5) — só exibe quando presente (oral/legado = NULL = oculto).
  const injectionSiteLabel = getInjectionSiteLabel(p.injectionSite)

  const log = eventToLog(event)
  const canEdit = !!log

  return (
    <div className={`hlc-card hlc-card--${meta.cls}`}>
      <div className="hlc-card__info">
        <div className="hlc-card__title-row">
          <span className="hlc-card__name">{medicineName}</span>
          {dosageLabel && <span className="hlc-card__dosage-pill">{dosageLabel}</span>}
        </div>
        {quantityLabel && <span className="hlc-card__quantity">{quantityLabel}</span>}
        {injectionSiteLabel && (
          <span className="hlc-card__injection-site">
            <LocateFixed size={13} aria-hidden="true" />
            {injectionSiteLabel}
          </span>
        )}
        <span className="hlc-card__status" data-status={status} title={meta.label} aria-label={meta.label}>
          <Icon size={14} aria-hidden="true" />
          <span className="hlc-card__status-label">{meta.label}</span>
        </span>
      </div>

      <div className="hlc-card__side">
        <span className="hlc-card__time">{timeLabel}</span>
        {canEdit && (
          <div className="hlc-card__actions">
            <button
              className="hlc-card__btn hlc-card__btn--edit"
              onClick={() => onEdit(log)}
              aria-label="Editar registro"
              title="Editar"
            >
              <PencilLine size={14} />
            </button>
            <button
              className="hlc-card__btn hlc-card__btn--delete"
              onClick={() => onDelete(log.id)}
              aria-label="Excluir registro"
              title="Excluir"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
