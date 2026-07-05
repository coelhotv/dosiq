import { ChevronRight } from 'lucide-react'
import { NOTIFICATION_TYPES } from '@schemas'

const CTA_MAP = {
  [NOTIFICATION_TYPES.DOSE_REMINDER]:         { label: 'Registrar dose',    action: 'dashboard' },
  [NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN]: { label: 'Registrar plano',   action: 'dashboard' },
  [NOTIFICATION_TYPES.DOSE_REMINDER_MISC]:    { label: 'Registrar doses',   action: 'dashboard' },
  [NOTIFICATION_TYPES.STOCK_ALERT]:           { label: 'Ver estoque',        action: 'stock' },
  [NOTIFICATION_TYPES.PRESCRIPTION_ALERT]:    { label: 'Ver estoque',        action: 'stock' },
  [NOTIFICATION_TYPES.MISSED_DOSE]:           { label: 'Registrar atrasada', action: 'history' },
  [NOTIFICATION_TYPES.ADHERENCE_REPORT]:      { label: 'Ver histórico',      action: 'history' },
  [NOTIFICATION_TYPES.MONTHLY_REPORT]:        { label: 'Ver histórico',      action: 'history' },
  [NOTIFICATION_TYPES.TITRATION_UPDATE]:      { label: 'Ver tratamento',     action: 'treatment' },
  [NOTIFICATION_TYPES.DLQ_DIGEST]:            { label: 'Ver Painel Admin',   action: 'admin-dlq' },
  [NOTIFICATION_TYPES.DAILY_DIGEST]:          null,
}

/**
 * NotificationActions — Componente unificado para CTAs de notificação (Web).
 * Centraliza o mapeamento de tipos para labels/rotas e a lógica de execução.
 */
export default function NotificationActions({ notification, onNavigate, onOpenDoseModal, displayTitle }) {
  const cta = CTA_MAP[notification.notification_type]
  
  if (!cta || (!onNavigate && !onOpenDoseModal)) return null

  const handleClick = (e) => {
    e.stopPropagation() 
    const { notification_type, protocol_id, treatment_plan_id, details } = notification
    
    // Resolução resiliente de IDs (Gate 5.5 hardening)
    const resolvedProtocolId = protocol_id || 
                               notification.protocolId || 
                               details?.find(d => d.protocol_id || d.protocolId)?.protocol_id || 
                               details?.find(d => d.protocol_id || d.protocolId)?.protocolId || 
                               ''
    const resolvedPlanId = treatment_plan_id || notification.treatmentPlanId || ''

    if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER && onOpenDoseModal) {
      onOpenDoseModal({ type: 'protocol', protocol_id: resolvedProtocolId })
    } else if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN && onOpenDoseModal) {
      onOpenDoseModal({
        type: 'plan',
        treatment_plan_id: resolvedPlanId,
      })
    } else if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_MISC && onOpenDoseModal) {
      // Para MISC na Web, abrimos o modal do primeiro medicamento do grupo
      onOpenDoseModal({
        type: 'protocol',
        protocol_id: resolvedProtocolId,
      })
    } else if (onNavigate) {
      onNavigate(cta.action)
    }
  }

  return (
    <button
      className="notif-card__action"
      onClick={handleClick}
      aria-label={`${cta.label} — ${displayTitle}`}
    >
      {cta.label}
      <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
