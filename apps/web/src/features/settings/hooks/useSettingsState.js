import { useState, useEffect, useCallback, startTransition } from 'react'
import { supabase } from '@shared/utils/supabase'
import { getServerTimestamp } from '@utils/dateUtils'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { hasFuturePendingDoses, regenActiveProtocolsForTz } from '@dosiq/core'
import { invalidateCache } from '@shared/hooks/useCachedQuery'
import { CACHE_KEYS } from '@dosiq/shared-data'

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
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  // F4.3f.2: prompt de intenção na troca de fuso (viagem × mudança).
  // tzPrompt = { fromTz, toTz } enquanto a modal está aberta; null fechada.
  const [tzPrompt, setTzPrompt] = useState(null)
  const [tzApplying, setTzApplying] = useState(false)

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
        setTimezone(settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo')
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

  // Persiste o tz no perfil. `regen=true` ("Me mudei") re-ancora as doses futuras
  // no fuso novo; `regen=false` ("viagem") só troca o setting (instante absoluto intacto).
  const persistTimezone = async (tz, { regen }) => {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) throw new Error('Usuário não autenticado')
    // Supabase não lança em falha de update (rede/RLS) — checar {error} senão
    // o estado local muda e o usuário vê sucesso falso (lição Sprint 7).
    const { error } = await supabase.from('user_settings').update({ timezone: tz }).eq('user_id', user.id)
    if (error) throw error
    if (regen) {
      // Best-effort (R-245/246): falha na regeneração não desfaz o persist do tz.
      await regenActiveProtocolsForTz({ client: supabase, userId: user.id, tz })
    }
    setTimezone(tz)
    // F4.3f.0: ajuste manual do fuso dispensa o nudge do Perfil (TzNudge.DISMISS_KEY).
    try { localStorage.setItem('dosiq_tz_nudge_dismissed', '1') } catch { /* sem localStorage */ }
    // Render do dashboard depende do tz e das ocorrências de hoje → invalidar.
    invalidateCache(CACHE_KEYS.USER_TIMEZONE)
    invalidateCache(`${CACHE_KEYS.DOSE_INSTANCES_TODAY}*`)
  }

  const handleTimezoneChange = async (tz) => {
    if (!tz || tz === timezone) return
    try {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) throw new Error('Usuário não autenticado')
      // Sem dose futura, viagem×mudança não muda nada → persiste direto, sem prompt.
      const hasFuture = await hasFuturePendingDoses(supabase, user.id)
      if (!hasFuture) {
        await persistTimezone(tz, { regen: false })
        showMsg('success', 'Fuso horário atualizado.')
        return
      }
      // Há doses futuras → pergunta a intenção antes de persistir.
      setTzPrompt({ fromTz: timezone, toTz: tz })
    } catch {
      showMsg('error', 'Erro ao salvar fuso horário.')
    }
  }

  // "Estou só de viagem": persiste o tz, sem regenerar (doses no horário real de origem).
  const handleTzTravel = async () => {
    if (!tzPrompt) return
    try {
      setTzApplying(true)
      await persistTimezone(tzPrompt.toTz, { regen: false })
      showMsg('success', 'Fuso horário atualizado.')
    } catch {
      showMsg('error', 'Erro ao salvar fuso horário.')
    } finally {
      setTzApplying(false)
      setTzPrompt(null)
    }
  }

  // "Me mudei": persiste o tz e re-ancora as doses futuras no fuso novo.
  const handleTzMove = async () => {
    if (!tzPrompt) return
    try {
      setTzApplying(true)
      await persistTimezone(tzPrompt.toTz, { regen: true })
      showMsg('success', 'Fuso e horários das doses atualizados.')
    } catch {
      showMsg('error', 'Erro ao salvar fuso horário.')
    } finally {
      setTzApplying(false)
      setTzPrompt(null)
    }
  }

  // Cancelar/descartar: nada muda (o seletor reflete `timezone`, que não foi alterado).
  const handleTzCancel = () => setTzPrompt(null)

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
    preference: {
      overrideMode, handleComplexityChange, getComplexityDisplayMode, timezone, handleTimezoneChange,
      tzPrompt, tzApplying, handleTzTravel, handleTzMove, handleTzCancel,
    },
  }
}
