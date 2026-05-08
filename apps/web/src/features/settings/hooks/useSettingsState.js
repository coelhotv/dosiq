import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@shared/utils/supabase'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import {
  getComplexityDisplayMode,
  generateTokenString,
  saveTelegramTokenSetting,
  updateWebPushSetting,
  updateNotificationModeSetting,
  updateQuietHoursSetting,
  updateDigestTimeSetting,
  disconnectTelegramSetting,
  updateComplexityModeSetting,
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

  const showMsg = useCallback((type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }, [])

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

  const handleToggleWebPush = useCallback(async () => {
    try {
      setSavingChannel(true)
      const newValue = !channelWebPushEnabled
      if (newValue && (await Notification.requestPermission()) !== 'granted') {
        return showMsg('error', 'Permissão de notificação negada.')
      }
      await updateWebPushSetting(newValue)
      setChannelWebPushEnabled(newValue)
      showMsg('success', `Notificações Web ${newValue ? 'ativadas' : 'desativadas'}.`)
    } catch {
      showMsg('error', 'Falha ao atualizar canal Web.')
    } finally {
      setSavingChannel(false)
    }
  }, [channelWebPushEnabled, showMsg])

  const handleModeChange = useCallback(async (mode) => {
    try {
      setSavingNotification(true)
      await updateNotificationModeSetting(mode)
      setNotificationMode(mode)
      showMsg('success', 'Modo de notificação atualizado.')
    } catch {
      showMsg('error', 'Erro ao salvar modo.')
    } finally {
      setSavingNotification(false)
    }
  }, [showMsg])

  const saveQuietHours = useCallback(async () => {
    try {
      setSavingQuietHours(true)
      await updateQuietHoursSetting(quietHoursEnabled, quietHoursStart, quietHoursEnd)
      showMsg('success', 'Período silencioso salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar período silencioso.')
    } finally {
      setSavingQuietHours(false)
    }
  }, [quietHoursEnabled, quietHoursStart, quietHoursEnd, showMsg])

  const saveDigestTime = useCallback(async () => {
    try {
      setSavingDigestTime(true)
      await updateDigestTimeSetting(digestTime)
      showMsg('success', 'Horário do resumo salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar horário.')
    } finally {
      setSavingDigestTime(false)
    }
  }, [digestTime, showMsg])

  const generateTelegramToken = useCallback(async () => {
    const token = generateTokenString()
    setTelegramToken(token)
    try {
      await saveTelegramTokenSetting(token)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Erro ao salvar token Telegram:', err)
      showMsg('error', 'Erro ao salvar token do Telegram.')
    }
  }, [showMsg])

  const handleDisconnectTelegram = useCallback(async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o Telegram?')) return
    try {
      await disconnectTelegramSetting()
      setIsTelegramConnected(false)
      showMsg('success', 'Telegram desconectado.')
    } catch {
      showMsg('error', 'Erro ao desconectar.')
    }
  }, [showMsg])

  const handleComplexityChange = useCallback(async (mode) => {
    const value = mode === 'auto' ? null : mode
    try {
      await updateComplexityModeSetting(value)
      setComplexityOverride(value)
      showMsg('success', 'Preferência de visualização atualizada.')
    } catch {
      showMsg('error', 'Erro ao salvar preferência.')
    }
  }, [setComplexityOverride, showMsg])

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
