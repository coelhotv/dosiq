/**
 * useUnreadNotificationCount — Conta notificações não lidas via localStorage (Web).
 *
 * Estratégia: compara sent_at dos logs com a última vez que o usuário abriu a inbox.
 * Zero roundtrip extra — tudo local.
 */
import { useMemo, useCallback } from 'react'
import { parseISO, getServerTimestamp } from '@utils/dateUtils'

const STORAGE_KEY = 'dosiq:notif-last-seen'

interface NotificationLike {
  sent_at?: string
}

export interface UseUnreadNotificationCountResult {
  unreadCount: number
  markAllRead: () => void
  lastSeen: string | null
}

/**
 * @param notifications - Lista retornada por useNotificationLog
 */
export function useUnreadNotificationCount(
  notifications: NotificationLike[] | null | undefined
): UseUnreadNotificationCountResult {
  const lastSeen = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to get notification last seen time from localStorage:', err)
      }
      return null
    }
  }, [])

  const unreadCount = useMemo(() => {
    if (!notifications?.length) return 0
    if (!lastSeen) return notifications.length
    const lastSeenTime = parseISO(lastSeen).getTime()
    return notifications.filter(n => {
      if (!n.sent_at) return false
      return parseISO(n.sent_at).getTime() > lastSeenTime
    }).length
  }, [notifications, lastSeen])

  const markAllRead = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, getServerTimestamp())
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to set notification last seen time in localStorage:', err)
      }
    }
  }, [])

  return { unreadCount, markAllRead, lastSeen }
}
