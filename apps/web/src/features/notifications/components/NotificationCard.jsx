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
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell,
  ChevronRight,
} from 'lucide-react'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import './NotificationCard.css'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

// Mapeamento de tipo → CTA
const CTA_MAP = {
  dose_reminder:    { label: 'Registrar dose',    action: 'dashboard' },
  stock_alert:      { label: 'Ver estoque',        action: 'stock' },
  missed_dose:      { label: 'Registrar atrasada', action: 'history' },
  titration_update: { label: 'Ver tratamento',     action: 'treatment' },
  daily_digest:     null,
}

/**
 * Resolve o título do card de acordo com o tipo da notificação.
 * Prioriza medicine_name / protocol_name sobre o label genérico.
 */
function resolveTitle(notification, label) {
  const { notification_type, medicine_name, protocol_name } = notification
  switch (notification_type) {
    case 'dose_reminder':
    case 'stock_alert':
    case 'missed_dose':
      return medicine_name ?? label
    case 'titration_update':
      return protocol_name ?? label
    case 'daily_digest':
      return 'Resumo do dia'
    default:
      return label
  }
}

export default function NotificationCard({
  notification,
  onNavigate,
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
  const isDailyDigest = notification_type === 'daily_digest'
  const isDoseReminder = notification_type === 'dose_reminder'

  // Título: sempre resolve pelo tipo (medicine_name, protocol_name, etc.)
  const displayTitle = resolveTitle(notification, label)

  // Corpo: body do banco (tabela foi zerada antes do deploy v1 — sem registros legados)
  const displayBody = body ?? null

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
          </div>
        </div>

        {/* Corpo */}
        {displayBody && (
          <>
            <p
              className="notif-card__preview"
              style={
                isDailyDigest && !expanded
                  ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                  : undefined
              }
            >
              {displayBody}
            </p>
            {isDailyDigest && (
              <button
                className="notif-card__expand"
                onClick={() => setExpanded(prev => !prev)}
                aria-expanded={expanded}
                style={{ background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}
              >
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </>
        )}

        {/* Rodapé: CTA */}
        <div className="notif-card__footer">
          {isDoseReminder && wasTaken === true ? (
            <span
              className="notif-card__taken"
              style={{ fontSize: 12, color: '#6b7280' }}
            >
              ✓ Tomada
            </span>
          ) : cta && onNavigate ? (
            <button
              className="notif-card__action"
              onClick={() => onNavigate(cta.action)}
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
