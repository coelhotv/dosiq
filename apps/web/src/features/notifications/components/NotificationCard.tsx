/**
 * NotificationCard — Card de item de notificação para a inbox web.
 *
 * Exibe ícone semântico, título contextual, data relativa e ação contextual.
 * ADR-012 (radius ≥ 0.75rem), ADR-023 (weight ≥ 400), R-138 (ícone+label).
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  AlertTriangle, BellOff, CheckCircle2, Bell, 
  Clock, Package, BarChart2, TrendingUp, ListChecks, Tablets, 
  PieChart, BarChart3, NotepadText 
} from 'lucide-react'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { NOTIFICATION_TYPES, DOSE_RELATED_NOTIFICATION_TYPES } from '@schemas'
import { parseISO } from '@utils/dateUtils'
import NotificationActions from './NotificationActions'
import { parseTelegramMarkdown } from '@features/notifications/utils/markdownParser'
import './NotificationCard.css'

const ICON_COMPONENTS = {
  Pill: Clock,
  Package,
  AlertTriangle,
  NotepadText,
  TrendingUp,
  ListChecks,
  Tablets,
  PieChart,
  BarChart3,
  Bell
}

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
      return 'Doses agora'
    default:
      return label
  }
}

function _renderDosesList(doses) {
  if (!doses?.length) return null
  return (
    <ul className="notif-card__dose-list">
      {doses.map((dose, i) => (
        <li key={i} className="notif-card__dose-item">
          {`${dose.dosage}x ${dose.medicineName}`}
        </li>
      ))}
    </ul>
  )
}

function _renderBodyContent(displayBody, isDailyDigest, expanded, setExpanded) {
  if (!displayBody) return null
  return (
    <>
      <div
        className={`notif-card__preview ${isDailyDigest && !expanded ? 'notif-card__preview--collapsed' : ''}`}
      >
        {parseTelegramMarkdown(displayBody)}
      </div>
      {isDailyDigest && (
        <button
          className="notif-card__expand"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(prev => !prev)
          }}
          aria-expanded={expanded}
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </>
  )
}

export default function NotificationCard({
  notification,
  onNavigate,
  onOpenDoseModal,
  index = 0,
  wasTaken,
}) {
  const [expanded, setExpanded] = useState(false)

  const {
    notification_type,
    status,
    sent_at,
    body,
  } = notification

  const { iconName, color, bgColor, label } = getNotificationIcon(notification_type)
  const relativeTime  = formatRelativeTime(sent_at)
  const isFailed      = ['falhou', 'failed'].includes(status?.toLowerCase())
  const isMuted       = status?.toLowerCase() === 'muted'
  const isDailyDigest = notification_type === NOTIFICATION_TYPES.DAILY_DIGEST
  const isDoseRelated = DOSE_RELATED_NOTIFICATION_TYPES.includes(notification_type)

  const displayTitle = resolveTitle(notification, label)
  const displayBody = body ?? null
  const doses = notification.doses ?? null

  const IconComponent = ICON_COMPONENTS[iconName] ?? Bell

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
              title={sent_at ? parseISO(sent_at).toLocaleString('pt-BR') : ''}
            >
              {relativeTime}
            </time>
            {isFailed && (
              <AlertTriangle
                size={12}
                color="var(--color-error)"
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
        {doses?.length > 0 ? _renderDosesList(doses) : _renderBodyContent(displayBody, isDailyDigest, expanded, setExpanded)}

        {/* Rodapé: CTA via NotificationActions */}
        <div className="notif-card__footer">
          {isDoseRelated && wasTaken === true ? (
            <span className="notif-card__taken">
              <CheckCircle2 size={14} /> Tomada
            </span>
          ) : (
            <NotificationActions 
              notification={notification}
              onNavigate={onNavigate}
              onOpenDoseModal={onOpenDoseModal}
              displayTitle={displayTitle}
            />
          )}
        </div>

      </div>
    </motion.article>
  )
}
