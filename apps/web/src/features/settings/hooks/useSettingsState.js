import { useState, useEffect, useCallback, startTransition } from 'react'
import { supabase } from '@shared/utils/supabase'
import { getServerTimestamp } from '@utils/dateUtils'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'

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

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (settings) {
        setIsTelegramConnected(!!settings.telegram_chat_id)

        const adminChatId = import.meta.env.VITE_ADMIN_CHAT_ID
        if (adminChatId && String(settings.telegram_chat_id) === String(adminChatId)) {
          setIsAdmin(true)
          const { count } = await supabase.from('dead_letter_queue').select('*', { count: 'exact', head: true })
          setDlqCount(count || 0)
        }
        setNotificationMode(settings.notification_mode || 'realtime')
        setQuietHoursEnabled(settings.quiet_hours_enabled || false)
        setQuietHoursStart(settings.quiet_hours_start || '23:00')
        setQuietHoursEnd(settings.quiet_hours_end || '08:00')
        setDigestTime(settings.digest_time || '09:00')
        setChannelWebPushEnabled(settings.channel_web_push_enabled || false)
        if (settings.complexity_override) setComplexityOverride(settings.complexity_override)
      }
      setWebPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    } catch (error) {
      console.error('Settings error:', error)
    } finally {
      setLoading(false)
    }
  }, [setComplexityOverride])

  useEffect(() => {
    startTransition(() => {
      fetchData()
    })
  }, [fetchData])

  const handleToggleWebPush = async () => {
    try {
      setSavingChannel(true)
      const newValue = !channelWebPushEnabled
      if (newValue && (await Notification.requestPermission()) !== 'granted') {
        return showMsg('error', 'Permissão de notificação negada.')
      }
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ channel_web_push_enabled: newValue }).eq('user_id', user.id)
      setChannelWebPushEnabled(newValue)
      showMsg('success', `Notificações Web ${newValue ? 'ativadas' : 'desativadas'}.`)
    } catch {
      showMsg('error', 'Falha ao atualizar canal Web.')
    } finally {
      setSavingChannel(false)
    }
  }

  const handleModeChange = async (mode) => {
    try {
      setSavingNotification(true)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ notification_mode: mode }).eq('user_id', user.id)
      setNotificationMode(mode)
      showMsg('success', 'Modo de notificação atualizado.')
    } catch {
      showMsg('error', 'Erro ao salvar modo.')
    } finally {
      setSavingNotification(false)
    }
  }

  const saveQuietHours = async () => {
    try {
      setSavingQuietHours(true)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
      }).eq('user_id', user.id)
      showMsg('success', 'Período silencioso salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar período silencioso.')
    } finally {
      setSavingQuietHours(false)
    }
  }

  const saveDigestTime = async () => {
    try {
      setSavingDigestTime(true)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ digest_time: digestTime }).eq('user_id', user.id)
      showMsg('success', 'Horário do resumo salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar horário.')
    } finally {
      setSavingDigestTime(false)
    }
  }

  const generateTelegramToken = async () => {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    const token = array[0].toString(36).substring(0, 6).toUpperCase()
    setTelegramToken(token)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ telegram_token: token, telegram_token_created_at: getServerTimestamp() }).eq('user_id', user.id)
    } catch (err) {
      console.error('Token gen error:', err)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o Telegram?')) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ telegram_chat_id: null }).eq('user_id', user.id)
      setIsTelegramConnected(false)
      showMsg('success', 'Telegram desconectado.')
    } catch {
      showMsg('error', 'Erro ao desconectar.')
    }
  }

  const handleComplexityChange = async (mode) => {
    const value = mode === 'auto' ? null : mode
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_settings').update({ complexity_override: value }).eq('user_id', user.id)
      setComplexityOverride(value)
      showMsg('success', 'Preferência de visualização atualizada.')
    } catch {
      showMsg('error', 'Erro ao salvar preferência.')
    }
  }

  const getComplexityDisplayMode = () => {
    if (overrideMode === 'simple') return 'Ativo: Modo Padrão (simplificado)'
    if (overrideMode === 'complex') return 'Ativo: Modo Detalhado'
    return `Ativo: Automático (atualmente: ${complexityMode === 'simple' ? 'Padrão' : 'Detalhado'})`
  }

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
    preference: { overrideMode, handleComplexityChange, getComplexityDisplayMode },
  }
}
