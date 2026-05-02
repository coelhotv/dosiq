/**
 * NotificationList — Lista de notificações (web).
 * R-115: react-virtuoso se > 30 itens.
 * Estados: loading (skeleton), vazio, erro, dados.
 *
 * Agrupa notificações por dia (Hoje / Ontem / Esta semana / Mais antigos).
 * Calcula wasTaken para cada dose_reminder e passa para NotificationCard.
 */
import { useMemo, useState, useEffect } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Bell } from 'lucide-react'
import { NOTIFICATION_TYPES, DOSE_RELATED_NOTIFICATION_TYPES } from '@schemas'
import { getNow, getTodayLocal, parseISO, daysDifference } from '@utils/adherenceLogic'
import { formatLocalDate, addDays, parseLocalDate } from '@utils/dateUtils'
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
function groupByDay(notifications, todayStr = getTodayLocal()) {
  const groups = [
    { title: 'Hoje',         items: [] },
    { title: 'Ontem',        items: [] },
    { title: 'Esta semana',  items: [] },
    { title: 'Mais antigos', items: [] },
  ]

  for (const n of notifications) {
    const diff = daysDifference(n.sent_at, todayStr)
    
    if (diff === 0)       groups[0].items.push(n)
    else if (diff === 1)  groups[1].items.push(n)
    else if (diff <= 7)   groups[2].items.push(n)
    else                  groups[3].items.push(n)
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
  const { notification_type, protocol_id, treatment_plan_id, sent_at } = notification
  const sentAtDate = parseISO(sent_at)

  return doseLogs.some(log => {
    const takenAtDate = parseISO(log.taken_at)
    if (takenAtDate <= sentAtDate) return false

    if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER && protocol_id) {
      return log.protocol_id === protocol_id
    }
    if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN && treatment_plan_id) {
      return log.treatment_plan_id === treatment_plan_id
    }
    if (notification_type === NOTIFICATION_TYPES.DOSE_REMINDER_MISC) {
      // Para misc, se houver qualquer log posterior, assumimos como parcial ou totalmente registrado
      // O ideal seria verificar todos os protocolos na lista, mas logs simplificados ajudam na UX
      return true
    }
    return false
  })
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
export default function NotificationList({ notifications, isLoading, error, onNavigate, onOpenDoseModal, doseLogs }) {
  // localDay: re-avalia groupByDay quando o dia muda (visibilitychange + midnight timer)
  const [localDay, setLocalDay] = useState(() => getTodayLocal())
  useEffect(() => {
    let timer
    const schedule = () => {
      const now = getNow()
      const next = addDays(parseLocalDate(getTodayLocal()), 1)
      timer = setTimeout(() => { 
        setLocalDay(getTodayLocal())
        schedule() 
      }, next.getTime() - now.getTime() + 1000)
    }
    const onVisibility = () => { if (!document.hidden) setLocalDay(getTodayLocal()) }
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  // Monta lista plana com grupos intercalados (para Virtuoso e para lista simples)
  const flatItems = useMemo(() => {
    if (!notifications?.length) return []
    const groups = groupByDay(notifications, localDay)
    const items = []
    for (const group of groups) {
      items.push({ type: 'header', title: group.title })
      for (const notif of group.items) {
        items.push({ type: 'card', notif })
      }
    }
    return items
  }, [notifications, localDay])

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
              onOpenDoseModal={onOpenDoseModal}
              index={i}
              wasTaken={
                DOSE_RELATED_NOTIFICATION_TYPES.includes(item.notif.notification_type)
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
              onOpenDoseModal={onOpenDoseModal}
              index={index}
              wasTaken={
                DOSE_RELATED_NOTIFICATION_TYPES.includes(item.notif.notification_type)
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
