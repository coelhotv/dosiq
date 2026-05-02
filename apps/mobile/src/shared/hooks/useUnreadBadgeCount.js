/**
 * useUnreadBadgeCount — Badge leve de não-lidas (sem fetch de logs).
 *
 * Lê apenas o AsyncStorage para comparar last-seen com um count RPC simples.
 * Alternativa leve ao useNotificationLog para contextos que só precisam do badge.
 */
import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../platform/supabase/nativeSupabaseClient'
import { errorLog } from '@shared/utils/debugLog'

const getStorageKey = (userId) =>
  userId ? `@dosiq/notif-last-seen:${userId}` : '@dosiq/notif-last-seen'

/**
 * @param {string|null} userId
 * @returns {{ unreadCount: number, refreshBadge: () => Promise<void> }}
 */
export function useUnreadBadgeCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshBadge = useCallback(async () => {
    if (!userId) return
    try {
      const lastSeen = await AsyncStorage.getItem(getStorageKey(userId))
      let query = supabase
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      
      if (lastSeen) {
        query = query.gt('sent_at', lastSeen)
      }
      
      const { count, error } = await query
      if (!error) setUnreadCount(count ?? 0)
    } catch (e) {
      // Silencioso — badge é cosmético
      if (__DEV__) errorLog('useUnreadBadgeCount', `Fetch failed: ${e.message}`)
    }
  }, [userId])

  // Atualiza ao focar na tela (ex: ao voltar da Inbox)
  useFocusEffect(
    useCallback(() => {
      refreshBadge()
    }, [refreshBadge])
  )

  useEffect(() => {
    const timer = setTimeout(() => refreshBadge(), 0)
    return () => clearTimeout(timer)
  }, [refreshBadge])

  return { unreadCount, refreshBadge }
}
