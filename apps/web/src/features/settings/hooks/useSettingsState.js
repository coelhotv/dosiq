import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@shared/utils/supabase'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import {
  getComplexityDisplayMode,
  generateTokenString,
  saveTelegramTokenSetting,
  buildToggleWebPushHandler,
  buildSaveQuietHoursHandler,
  buildSaveDigestTimeHandler,
  buildModeChangeHandler,
  buildDisconnectTelegramHandler,
  buildComplexityChangeHandler,
} from './_settingsHelpers'

function _makeShowMsg(setMessage) {
  return (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }
}

async function _loadAdminData(user, setIsAdmin, setDlqCount) {
  if (user.user_metadata?.role !== 'admin') return
  setIsAdmin(true)
  const { count } = await supabase.from('dead_letter_queue').select('*', { count: 'exact', head: true })
  setDlqCount(count || 0)
}

function _applySettings(settings, setters, setComplexityOverride) {
  const { setIsTelegramConnected, setNotificationMode, setQuietHoursEnabled,
    setQuietHoursStart, setQuietHoursEnd, setDigestTime, setChannelWebPushEnabled } = setters
  setIsTelegramConnected(!!settings.telegram_chat_id)
  setNotificationMode(settings.notification_mode || 'realtime')
  setQuietHoursEnabled(settings.quiet_hours_enabled || false)
  setQuietHoursStart(settings.quiet_hours_start || '23:00')
  setQuietHoursEnd(settings.quiet_hours_end || '08:00')
  setDigestTime(settings.digest_time || '09:00')
  setChannelWebPushEnabled(settings.channel_web_push_enabled || false)
  if (settings.complexity_override) setComplexityOverride(settings.complexity_override)
}

export function useSettingsState() {
  const { mode: complexityMode, setOverride: setComplexityOverride, overrideMode } = useComplexityMode()

  const [loading, setLoading] = useState(true)
  const [savingChannel, setSavingChannel] = useState(false)
  const [savingNotification, setSavingNotification] = useState(false)
  const [savingQuietHours, setSavingQuietHours] = useState(false)
  const [savingDigestTime, setSavingDigestTime] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [isAdmin, setIsAdmin] = useState(false)
  const [dlqCount, setDlqCount] = useState(0)

  const [isTelegramConnected, setIsTelegramConnected] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [notificationMode, setNotificationMode] = useState('realtime')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00')
  const [digestTime, setDigestTime] = useState('08:30')
  const [webPushSupported, setWebPushSupported] = useState(false)
  const [channelWebPushEnabled, setChannelWebPushEnabled] = useState(false)

  const showMsg = _makeShowMsg(setMessage)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await _loadAdminData(user, setIsAdmin, setDlqCount)
      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (settings) {
        _applySettings(settings, {
          setIsTelegramConnected, setNotificationMode, setQuietHoursEnabled,
          setQuietHoursStart, setQuietHoursEnd, setDigestTime, setChannelWebPushEnabled
        }, setComplexityOverride)
      }
      setWebPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    } catch (error) {
      console.error('Settings error:', error)
    } finally {
      setLoading(false)
    }
  }, [setComplexityOverride])

  useEffect(() => { fetchData() }, [fetchData])

  const handleToggleWebPush = useCallback(
    buildToggleWebPushHandler({ setSavingChannel, channelWebPushEnabled, setChannelWebPushEnabled, showMsg }),
    [channelWebPushEnabled]
  )

  const handleModeChange = useCallback(
    buildModeChangeHandler({ setSavingNotification, setNotificationMode, showMsg }), []
  )

  const saveQuietHours = useCallback(
    buildSaveQuietHoursHandler({ setSavingQuietHours, quietHoursEnabled, quietHoursStart, quietHoursEnd, showMsg }),
    [quietHoursEnabled, quietHoursStart, quietHoursEnd]
  )

  const saveDigestTime = useCallback(
    buildSaveDigestTimeHandler({ setSavingDigestTime, digestTime, showMsg }), [digestTime]
  )

  const generateTelegramToken = useCallback(async () => {
    const token = generateTokenString()
    setTelegramToken(token)
    try { await saveTelegramTokenSetting(token) } catch (err) { console.error('Token gen error:', err) }
  }, [])

  const handleDisconnectTelegram = useCallback(
    buildDisconnectTelegramHandler({ setIsTelegramConnected, showMsg }), []
  )

  const handleComplexityChange = useCallback(
    buildComplexityChangeHandler({ setComplexityOverride, showMsg }), [setComplexityOverride]
  )

  const displayMode = getComplexityDisplayMode(complexityMode, overrideMode)

  return {
    loading, isAdmin, dlqCount, message,
    notification: {
      webPushSupported, channelWebPushEnabled, savingChannel, handleToggleWebPush,
      isTelegramConnected, notificationMode, handleModeChange, savingNotification,
      quietHoursEnabled, setQuietHoursEnabled, quietHoursStart, setQuietHoursStart,
      quietHoursEnd, setQuietHoursEnd, saveQuietHours, savingQuietHours,
      digestTime, setDigestTime, saveDigestTime, savingDigestTime,
    },
    integration: { isTelegramConnected, generateTelegramToken, telegramToken, handleDisconnectTelegram },
    preference: { overrideMode, handleComplexityChange, displayMode },
  }
}
