/**
 * NotificationCard — Card de item de notificação para a inbox web.
 *
 * Exibe ícone semântico, label, data relativa, status e ação contextual.
 * ADR-012 (radius ≥ 0.75rem), ADR-023 (weight ≥ 400), R-138 (ícone+label).
 */
import { motion } from 'framer-motion'
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell,
  ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import './NotificationCard.css'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

const DEEP_LINK_LABELS = {
  dashboard: 'Ver doses',
  stock:     'Ver estoque',
  history:   'Ver histórico',
  treatment: 'Ver tratamento',
}

/**
 * @param {Object} props
 * @param {Object} props.notification - Objeto notificationLog do DB
 * @param {function(string):void} props.onNavigate - Callback de navegação (recebe view id)
 * @param {number} props.index - Índice para stagger de animação
 */
export default function NotificationCard({ notification, onNavigate, index = 0 }) {
  const { notification_type, status, sent_at, provider_metadata = {} } = notification

  const { iconName, color, bgColor, label, deepLinkAction } =
    getNotificationIcon(notification_type)

  const IconComponent = ICON_MAP[iconName] ?? Bell
  const relativeTime  = formatRelativeTime(sent_at)
  const preview       = provider_metadata?.message ?? null
  const isFailed      = ['falhou', 'failed'].includes(status?.toLowerCase())

  return (
    <motion.article
      className="notif-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: 'easeOut' }}
      role="listitem"
    >
      <div
        className="notif-card__icon"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        <IconComponent size={20} color={color} strokeWidth={2} />
      </div>

      <div className="notif-card__body">
        <div className="notif-card__header">
          <span className="notif-card__label">{label}</span>
          <time
            className="notif-card__time"
            dateTime={sent_at}
            title={sent_at ? new Date(sent_at).toLocaleString('pt-BR') : ''}
          >
            {relativeTime}
          </time>
        </div>

        {preview && (
          <p className="notif-card__preview">{preview}</p>
        )}

        <div className="notif-card__footer">
          <span className={`notif-card__status ${isFailed ? 'notif-card__status--failed' : 'notif-card__status--sent'}`}>
            {isFailed
              ? <><XCircle size={11} strokeWidth={2.5} aria-hidden="true" /> Falhou</>
              : <><CheckCircle2 size={11} strokeWidth={2.5} aria-hidden="true" /> Enviada</>
            }
          </span>

          {deepLinkAction && onNavigate && (
            <button
              className="notif-card__action"
              onClick={() => onNavigate(deepLinkAction)}
              aria-label={`${DEEP_LINK_LABELS[deepLinkAction]} — ${label}`}
            >
              {DEEP_LINK_LABELS[deepLinkAction]}
              <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
