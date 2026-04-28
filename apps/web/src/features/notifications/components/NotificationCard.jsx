/**
 * NotificationCard — Card de item de notificação para a inbox web.
 *
 * Exibe ícone semântico, título contextual, data relativa e ação contextual.
 * ADR-012 (radius ≥ 0.75rem), ADR-023 (weight ≥ 400), R-138 (ícone+label).
 *
 * Props:
 *   notification — objeto notificationLog do DB
 *   onNavigate   — callback de navegação (recebe view id)
 *   index        — índice para stagger de animação
 *   wasTaken     — booleano calculado pelo pai (dose_reminder já foi tomada)
 *   doseLogs     — não usado diretamente; wasTaken já vem processado
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell, ChevronRight, BellOff, CheckCircle2 } from 'lucide-react'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { NOTIFICATION_TYPES, DOSE_RELATED_NOTIFICATION_TYPES } from '@schemas'
import './NotificationCard.css'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

// Mapeamento de tipo → CTA
const CTA_MAP = {
  [NOTIFICATION_TYPES.DOSE_REMINDER]:         { label: 'Registrar dose',    action: 'dashboard' },
  [NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN]: { label: 'Registrar plano',   action: 'dashboard' },
  [NOTIFICATION_TYPES.DOSE_REMINDER_MISC]:    { label: 'Registrar doses',   action: 'dashboard' },
  [NOTIFICATION_TYPES.STOCK_ALERT]:           { label: 'Ver estoque',        action: 'stock' },
  [NOTIFICATION_TYPES.MISSED_DOSE]:           { label: 'Registrar atrasada', action: 'history' },
  [NOTIFICATION_TYPES.TITRATION_UPDATE]:      { label: 'Ver tratamento',     action: 'treatment' },
  [NOTIFICATION_TYPES.DAILY_DIGEST]:          null,
}

/**
 * Resolve o título do card de acordo com o tipo da notificação.
 * Prioriza medicine_name / protocol_name / treatment_plan_name sobre o label genérico.
 */
function resolveTitle(notification, label) {
  const { notification_type, medicine_name, protocol_name, treatment_plan_name } = notification
  switch (notification_type) {
    case NOTIFICATION_TYPES.DOSE_REMINDER:
    case NOTIFICATION_TYPES.STOCK_ALERT:
    case NOTIFICATION_TYPES.MISSED_DOSE:
      return medicine_name ?? label
    case NOTIFICATION_TYPES.TITRATION_UPDATE:
      return protocol_name ?? label
    case NOTIFICATION_TYPES.DAILY_DIGEST:
      return 'Resumo do dia'
    case NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN:
      return treatment_plan_name ?? 'Plano de tratamento'
    case NOTIFICATION_TYPES.DOSE_REMINDER_MISC:
      return 'Doses agendadas'
    default:
      return label
  }
}

export default function NotificationCard({
  notification,
  onNavigate,
  onOpenDoseModal,
  index = 0,
  wasTaken,
}) {
  // 1. States
  const [expanded, setExpanded] = useState(false)

  // 2. Derivados
  const {
    notification_type,
    status,
    sent_at,
    body,
  } = notification

  const { iconName, color, bgColor, label } = getNotificationIcon(notification_type)
  const IconComponent = ICON_MAP[iconName] ?? Bell
  const relativeTime  = formatRelativeTime(sent_at)
  const isFailed      = ['falhou', 'failed'].includes(status?.toLowerCase())
  const isMuted       = status?.toLowerCase() === 'muted'
  const isDailyDigest = notification_type === NOTIFICATION_TYPES.DAILY_DIGEST
  const isDoseRelated = DOSE_RELATED_NOTIFICATION_TYPES.includes(notification_type)

  // Título: sempre resolve pelo tipo (medicine_name, protocol_name, etc.)
  const displayTitle = resolveTitle(notification, label)

  const displayBody = body ?? null
  const doses       = notification.doses ?? null

  // CTA
  const cta = CTA_MAP[notification_type] ?? null

  return (
    <motion.article
      className="notif-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: 'easeOut' }}
      role="listitem"
    >
      {/* Ícone circular */}
      <div
        className="notif-card__icon"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        <IconComponent size={20} color={color} strokeWidth={2} />
      </div>

      {/* Conteúdo */}
      <div className="notif-card__body">

        {/* Cabeçalho: título + timestamp (+ ícone de falha se aplicável) */}
        <div className="notif-card__header">
          <span className="notif-card__label">{displayTitle}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <time
              className="notif-card__time"
              dateTime={sent_at}
              title={sent_at ? new Date(sent_at).toLocaleString('pt-BR') : ''}
            >
              {relativeTime}
            </time>
            {isFailed && (
              <AlertTriangle
                size={12}
                color="#dc2626"
                strokeWidth={2.5}
                aria-label="Falhou ao enviar"
              />
            )}
            {isMuted && (
              <span className="notif-card__muted-badge">
                <BellOff size={10} strokeWidth={2.5} />
                Silenciada
              </span>
            )}
          </div>
        </div>

        {/* Corpo */}
        {doses?.length > 0 ? (
          <ul className="notif-card__dose-list">
            {doses.map((dose, i) => (
              <li key={i} className="notif-card__dose-item">
                {`${dose.dosage}x ${dose.medicineName}`}
              </li>
            ))}
          </ul>
        ) : displayBody ? (
          <>
            <p
              className={`notif-card__preview ${isDailyDigest && !expanded ? 'notif-card__preview--collapsed' : ''}`}
            >
              {displayBody}
            </p>
            {isDailyDigest && (
              <button
                className="notif-card__expand"
                onClick={() => setExpanded(prev => !prev)}
                aria-expanded={expanded}
              >
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </>
        ) : null}

        {/* Rodapé: CTA */}
        <div className="notif-card__footer">
          {isDoseRelated && wasTaken === true ? (
            <span className="notif-card__taken">
              <CheckCircle2 size={14} /> Tomada
            </span>
          ) : cta && (onNavigate || onOpenDoseModal) ? (
            <button
              className="notif-card__action"
              onClick={() => {
                const isPlan = notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN
                const isMisc = notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_MISC
                const isIndividual = notification_type === NOTIFICATION_TYPES.DOSE_REMINDER
                if (isIndividual && onOpenDoseModal && notification.protocol_id) {
                  onOpenDoseModal({ type: 'protocol', protocol_id: notification.protocol_id })
                } else if ((isPlan || isMisc) && onOpenDoseModal) {
                  onOpenDoseModal({
                    type: isPlan ? 'plan' : 'protocol',
                    treatment_plan_id: notification.treatment_plan_id ?? '',
                  })
                } else {
                  onNavigate(cta.action)
                }
              }}
              aria-label={`${cta.label} — ${displayTitle}`}
            >
              {cta.label}
              <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : null}
        </div>

      </div>
    </motion.article>
  )
}
