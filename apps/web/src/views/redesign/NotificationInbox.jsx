/**
 * NotificationInbox — View da Central de Avisos (Web PWA).
 *
 * R-117: lazy-loaded via React.lazy() + Suspense em App.jsx.
 * Usa useNotificationLog (Sprint 8.2) + useUnreadNotificationCount.
 */
import { useEffect } from 'react'
import { ArrowLeft, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNotificationLog } from '@shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '@shared/hooks/useUnreadNotificationCount'
import NotificationList from '@features/notifications/components/NotificationList'
import './NotificationInbox.css'

/**
 * @param {Object} props
 * @param {string} props.userId - ID do usuário autenticado
 * @param {function(string):void} props.onNavigate - Navega para outra view
 * @param {function():void} props.onBack - Volta para a view anterior
 */
export default function NotificationInbox({ userId, onNavigate, onBack }) {
  const { data, isLoading, error } = useNotificationLog({ userId, limit: 30 })
  const { unreadCount, markAllRead } = useUnreadNotificationCount(data)

  useEffect(() => {
    if (!isLoading && data) markAllRead()
  }, [isLoading, data, markAllRead])

  return (
    <motion.div
      className="notif-inbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <header className="notif-inbox__header">
        <button
          className="notif-inbox__back"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="notif-inbox__title-group">
          <h1 className="notif-inbox__title">Central de Avisos</h1>
          {unreadCount > 0 && !isLoading && (
            <motion.span
              className="notif-inbox__badge"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={`${unreadCount} não lidas`}
            >
              {unreadCount}
            </motion.span>
          )}
        </div>

        <div className="notif-inbox__header-icon" aria-hidden="true">
          <Bell size={20} strokeWidth={1.75} />
        </div>
      </header>

      <main className="notif-inbox__content">
        <NotificationList
          data={data}
          isLoading={isLoading}
          error={error}
          onNavigate={onNavigate}
        />
      </main>
    </motion.div>
  )
}
