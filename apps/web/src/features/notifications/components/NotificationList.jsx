/**
 * NotificationList — Lista de notificações (web).
 * R-115: react-virtuoso se > 30 itens.
 * Estados: loading (skeleton), vazio, erro, dados.
 */
import { Virtuoso } from 'react-virtuoso'
import { Bell } from 'lucide-react'
import NotificationCard from './NotificationCard'
import './NotificationList.css'

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

/**
 * @param {Object} props
 * @param {Array|null} props.data
 * @param {boolean} props.isLoading
 * @param {string|null} props.error
 * @param {function(string):void} props.onNavigate
 */
export default function NotificationList({ data, isLoading, error, onNavigate }) {
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

  if (!data?.length) return <EmptyState />

  if (data.length <= 30) {
    return (
      <div className="notif-list" role="list" aria-label="Notificações">
        {data.map((notif, i) => (
          <NotificationCard
            key={notif.id ?? i}
            notification={notif}
            onNavigate={onNavigate}
            index={i}
          />
        ))}
      </div>
    )
  }

  return (
    <Virtuoso
      data={data}
      className="notif-list notif-list--virtual"
      role="list"
      aria-label="Notificações"
      itemContent={(index, notif) => (
        <div style={{ paddingBottom: 10 }}>
          <NotificationCard
            key={notif.id ?? index}
            notification={notif}
            onNavigate={onNavigate}
            index={index}
          />
        </div>
      )}
    />
  )
}
