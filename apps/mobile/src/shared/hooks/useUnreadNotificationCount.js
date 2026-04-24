/**
 * useUnreadNotificationCount — Badge de não-lidas (Mobile).
 *
 * Persiste último acesso via AsyncStorage para sobreviver reinicializações.
 * R-187: chave contém userId para evitar vazamento entre contas.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const getStorageKey = (userId) =>
  userId ? `@dosiq/notif-last-seen:${userId}` : '@dosiq/notif-last-seen'

/**
 * @param {Array|null} notifications
 * @param {string} [userId]
 * @returns {{ unreadCount: number, markAllRead: () => void }}
 */
export function useUnreadNotificationCount(notifications, userId) {
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    AsyncStorage.getItem(getStorageKey(userId))
      .then((val) => setLastSeen(val))
      .catch((err) => {
        if (__DEV__) {
          console.error('Failed to get notification last seen time:', err)
        }
      })
  }, [userId])

  const unreadCount = useMemo(() => {
    if (!notifications?.length) return 0
    if (!lastSeen) return notifications.length
    const lastSeenTime = new Date(lastSeen).getTime()
    return notifications.filter((n) => {
      if (!n.sent_at) return false
      return new Date(n.sent_at).getTime() > lastSeenTime
    }).length
  }, [notifications, lastSeen])

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString()
    AsyncStorage.setItem(getStorageKey(userId), now)
      .then(() => setLastSeen(now))
      .catch((err) => {
        if (__DEV__) {
          console.error('Failed to set notification last seen time:', err)
        }
      })
  }, [userId])

  return { unreadCount, markAllRead }
}
