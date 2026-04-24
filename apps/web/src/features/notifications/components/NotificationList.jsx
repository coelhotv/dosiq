/**
 * NotificationList — Lista de notificações (web).
 * R-115: react-virtuoso se > 30 itens.
 * Estados: loading (skeleton), vazio, erro, dados.
 *
 * Agrupa notificações por dia (Hoje / Ontem / Esta semana / Mais antigos).
 * Calcula wasTaken para cada dose_reminder e passa para NotificationCard.
 */
import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Bell } from 'lucide-react'
import NotificationCard from './NotificationCard'
import './NotificationList.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Agrupa notificações por faixa temporal em relação ao dia atual.
 * @param {Array} notifications
 * @returns {Array<{title: string, items: Array}>}
 */
function groupByDay(notifications) {
  const now = new Date()
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday - 86400000)
  const startOfWeek      = new Date(startOfToday - 6 * 86400000)

  const groups = [
    { title: 'Hoje',         items: [] },
    { title: 'Ontem',        items: [] },
    { title: 'Esta semana',  items: [] },
    { title: 'Mais antigos', items: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.sent_at)
    if (d >= startOfToday)          groups[0].items.push(n)
    else if (d >= startOfYesterday) groups[1].items.push(n)
    else if (d >= startOfWeek)      groups[2].items.push(n)
    else                            groups[3].items.push(n)
  }

  return groups.filter(g => g.items.length > 0)
}

/**
 * Para uma notificação dose_reminder, verifica se há um log posterior ao envio.
 * @param {Object} notification
 * @param {Array} doseLogs
 * @returns {boolean}
 */
function calcWasTaken(notification, doseLogs) {
  if (!doseLogs?.length) return false
  return doseLogs.some(
    log =>
      log.protocol_id === notification.protocol_id &&
      new Date(log.taken_at) > new Date(notification.sent_at),
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const GROUP_HEADER_STYLE = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '12px 0 6px',
}

function GroupHeader({ title }) {
  return <div style={GROUP_HEADER_STYLE} aria-hidden="true">{title}</div>
}

function NotificationSkeleton() {
  return (
    <div className="notif-skeleton" aria-hidden="true">
      <div className="notif-skeleton__icon" />
      <div className="notif-skeleton__body">
        <div className="notif-skeleton__line notif-skeleton__line--title" />
        <div className="notif-skeleton__line notif-skeleton__line--preview" />
        <div className="notif-skeleton__line notif-skeleton__line--short" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="notif-empty" role="status" aria-live="polite">
      <div className="notif-empty__icon-wrap" aria-hidden="true">
        <Bell size={36} strokeWidth={1.5} />
      </div>
      <h3 className="notif-empty__title">Nenhuma notificação ainda</h3>
      <p className="notif-empty__body">
        Quando você receber lembretes de doses ou alertas de estoque,
        eles aparecerão aqui.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * @param {Object} props
 * @param {Array|null}  props.notifications
 * @param {boolean}     props.isLoading
 * @param {string|null} props.error
 * @param {function(string):void} props.onNavigate
 * @param {Array}       props.doseLogs — medicine_logs para calcular wasTaken
 */
export default function NotificationList({ notifications, isLoading, error, onNavigate, doseLogs }) {
  // Monta lista plana com grupos intercalados (para Virtuoso e para lista simples)
  const flatItems = useMemo(() => {
    if (!notifications?.length) return []
    const groups = groupByDay(notifications)
    const items = []
    for (const group of groups) {
      items.push({ type: 'header', title: group.title })
      for (const notif of group.items) {
        items.push({ type: 'card', notif })
      }
    }
    return items
  }, [notifications])

  // ---- Estados especiais ----
  if (isLoading) {
    return (
      <div className="notif-list" aria-busy="true" aria-label="Carregando notificações">
        {Array.from({ length: 3 }, (_, i) => <NotificationSkeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="notif-error" role="alert">
        <p>Erro ao carregar notificações: {error}</p>
      </div>
    )
  }

  if (!flatItems.length) return <EmptyState />

  // ---- Lista pequena (≤ 30 notificações) ----
  const totalCards = flatItems.filter(i => i.type === 'card').length

  if (totalCards <= 30) {
    return (
      <div className="notif-list" role="list" aria-label="Notificações">
        {flatItems.map((item, i) =>
          item.type === 'header' ? (
            <GroupHeader key={`header-${item.title}`} title={item.title} />
          ) : (
            <NotificationCard
              key={item.notif.id ?? i}
              notification={item.notif}
              onNavigate={onNavigate}
              index={i}
              wasTaken={
                item.notif.notification_type === 'dose_reminder'
                  ? calcWasTaken(item.notif, doseLogs)
                  : undefined
              }
            />
          ),
        )}
      </div>
    )
  }

  // ---- Lista virtualizada (> 30 notificações) ----
  return (
    <Virtuoso
      data={flatItems}
      className="notif-list notif-list--virtual"
      role="list"
      aria-label="Notificações"
      itemContent={(index, item) =>
        item.type === 'header' ? (
          <GroupHeader title={item.title} />
        ) : (
          <div style={{ paddingBottom: 10 }}>
            <NotificationCard
              key={item.notif.id ?? index}
              notification={item.notif}
              onNavigate={onNavigate}
              index={index}
              wasTaken={
                item.notif.notification_type === 'dose_reminder'
                  ? calcWasTaken(item.notif, doseLogs)
                  : undefined
              }
            />
          </div>
        )
      }
    />
  )
}
