import { supabase } from '@shared/utils/supabase'
import { getNow } from '@utils/dateUtils'

export function getComplexityDisplayMode(complexityMode, overrideMode) {
  if (overrideMode === 'simple') return 'Ativo: Modo Padrão (simplificado)'
  if (overrideMode === 'complex') return 'Ativo: Modo Detalhado'
  return `Ativo: Automático (atualmente: ${complexityMode === 'simple' ? 'Padrão' : 'Detalhado'})`
}

export async function updateWebPushSetting(newValue) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ channel_web_push_enabled: newValue }).eq('user_id', user.id)
}

export async function updateNotificationModeSetting(mode) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ notification_mode: mode }).eq('user_id', user.id)
}

export async function updateQuietHoursSetting(enabled, start, end) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({
    quiet_hours_enabled: enabled,
    quiet_hours_start: start,
    quiet_hours_end: end,
  }).eq('user_id', user.id)
}

export async function updateDigestTimeSetting(time) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ digest_time: time }).eq('user_id', user.id)
}

export function generateTokenString() {
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  return array[0].toString(36).substring(0, 6).toUpperCase()
}

export async function saveTelegramTokenSetting(token) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ telegram_token: token, telegram_token_created_at: getNow().toISOString() }).eq('user_id', user.id)
}

export async function disconnectTelegramSetting() {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ telegram_chat_id: null }).eq('user_id', user.id)
}

export async function updateComplexityModeSetting(value) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_settings').update({ complexity_override: value }).eq('user_id', user.id)
}

export function buildToggleWebPushHandler({ setSavingChannel, channelWebPushEnabled, setChannelWebPushEnabled, showMsg }) {
  return async () => {
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
  }
}

export function buildSaveQuietHoursHandler({ setSavingQuietHours, quietHoursEnabled, quietHoursStart, quietHoursEnd, showMsg }) {
  return async () => {
    try {
      setSavingQuietHours(true)
      await updateQuietHoursSetting(quietHoursEnabled, quietHoursStart, quietHoursEnd)
      showMsg('success', 'Período silencioso salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar período silencioso.')
    } finally {
      setSavingQuietHours(false)
    }
  }
}

export function buildSaveDigestTimeHandler({ setSavingDigestTime, digestTime, showMsg }) {
  return async () => {
    try {
      setSavingDigestTime(true)
      await updateDigestTimeSetting(digestTime)
      showMsg('success', 'Horário do resumo salvo.')
    } catch {
      showMsg('error', 'Erro ao salvar horário.')
    } finally {
      setSavingDigestTime(false)
    }
  }
}

export function buildModeChangeHandler({ setSavingNotification, setNotificationMode, showMsg }) {
  return async (mode) => {
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
  }
}

export function buildDisconnectTelegramHandler({ setIsTelegramConnected, showMsg }) {
  return async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o Telegram?')) return
    try {
      await disconnectTelegramSetting()
      setIsTelegramConnected(false)
      showMsg('success', 'Telegram desconectado.')
    } catch {
      showMsg('error', 'Erro ao desconectar.')
    }
  }
}

export function buildComplexityChangeHandler({ setComplexityOverride, showMsg }) {
  return async (mode) => {
    const value = mode === 'auto' ? null : mode
    try {
      await updateComplexityModeSetting(value)
      setComplexityOverride(value)
      showMsg('success', 'Preferência de visualização atualizada.')
    } catch {
      showMsg('error', 'Erro ao salvar preferência.')
    }
  }
}
