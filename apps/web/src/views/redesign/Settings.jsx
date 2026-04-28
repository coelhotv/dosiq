import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@shared/utils/supabase'
import { useTheme } from '@shared/hooks/useTheme'

// Import components
import SettingsHeader from './settings/sections/SettingsHeader'
import NotificationSection from './settings/sections/NotificationSection'
import IntegrationSection from './settings/sections/IntegrationSection'
import PreferenceSection from './settings/sections/PreferenceSection'
import AccountSection from './settings/sections/AccountSection'
import AdminSection from './settings/sections/AdminSection'

// Import CSS
import './settings/SettingsRedesign.css'

import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'

/**
 * SettingsRedesign (v10.0) — Orquestrador principal de configurações.
 * Utiliza o Sectional Pattern para modularidade.
 */
export default function SettingsRedesign({ onNavigate }) {
  const { theme, toggleTheme } = useTheme()
  const { mode: complexityMode, setOverride: setComplexityOverride, overrideMode } = useComplexityMode()

  // ── States ──
  const [loading, setLoading] = useState(true)
  const [savingChannel, setSavingChannel] = useState(false)
  const [savingNotification, setSavingNotification] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [isAdmin, setIsAdmin] = useState(false)
  const [dlqCount, setDlqCount] = useState(0)

  // User Data
  const [isTelegramConnected, setIsTelegramConnected] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [notificationMode, setNotificationMode] = useState('realtime')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00')
  const [digestTime, setDigestTime] = useState('08:30')


  // Web Push
  const [webPushSupported, setWebPushSupported] = useState(false)
  const [channelWebPushEnabled, setChannelWebPushEnabled] = useState(false)

  // Password
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // ── Initialization ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Admin check
      if (user.user_metadata?.role === 'admin' || user.id === 'ADMIN_ID_PLACEHOLDER') {
        setIsAdmin(true)
        const { count } = await supabase
          .from('dead_letter_queue')
          .select('*', { count: 'exact', head: true })
        setDlqCount(count || 0)
      }

      // Settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)

        .single()

      if (settings) {
        setIsTelegramConnected(!!settings.telegram_chat_id)
        setNotificationMode(settings.notification_mode || 'realtime')
        setQuietHoursEnabled(settings.quiet_hours_enabled || false)
        setQuietHoursStart(settings.quiet_hours_start || '23:00')
        setQuietHoursEnd(settings.quiet_hours_end || '08:00')
        setDigestTime(settings.digest_time || '09:00')
        setChannelWebPushEnabled(settings.channel_web_push_enabled || false)
        if (settings.complexity_override) {
          setComplexityOverride(settings.complexity_override)
        }

      }

      // Web Push Support
      setWebPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    } catch (error) {
      console.error('Settings error:', error)
    } finally {
      setLoading(false)
    }
  }, [setComplexityOverride])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Handlers (Notificações) ──
  const handleToggleWebPush = async () => {
    try {
      setSavingChannel(true)
      const newValue = !channelWebPushEnabled

      // Se estiver ligando, solicitar permissão
      if (newValue) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setMessage({ type: 'error', text: 'Permissão de notificação negada pelo navegador.' })
          return
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ channel_web_push_enabled: newValue })
        .eq('user_id', user.id)


      setChannelWebPushEnabled(newValue)
      setMessage({ type: 'success', text: `Notificações Web ${newValue ? 'ativadas' : 'desativadas'}.` })
    } catch {
      setMessage({ type: 'error', text: 'Falha ao atualizar canal Web.' })
    } finally {
      setSavingChannel(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  const handleModeChange = async (mode) => {
    try {
      setSavingNotification(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ notification_mode: mode })
        .eq('user_id', user.id)

      setNotificationMode(mode)
      setMessage({ type: 'success', text: 'Modo de notificação atualizado.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar modo.' })
    } finally {
      setSavingNotification(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  const saveQuietHours = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({
          quiet_hours_enabled: quietHoursEnabled,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
        })
        .eq('user_id', user.id)

      setMessage({ type: 'success', text: 'Período silencioso salvo.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar período silencioso.' })

    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }


  const saveDigestTime = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ digest_time: digestTime })
        .eq('user_id', user.id)

      setMessage({ type: 'success', text: 'Horário do resumo salvo.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar horário.' })
    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  // ── Handlers (Integrações) ──
  const generateTelegramToken = async () => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase()
    setTelegramToken(token)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ telegram_token: token, telegram_token_created_at: new Date().toISOString() })
        .eq('user_id', user.id)
    } catch (err) {
      console.error('Token gen error:', err)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o Telegram?')) return
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ telegram_chat_id: null })
        .eq('user_id', user.id)


      setIsTelegramConnected(false)
      setMessage({ type: 'success', text: 'Telegram desconectado.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao desconectar.' })
    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  // ── Handlers (Preferências) ──
  const handleComplexityChange = async (mode) => {
    const value = mode === 'auto' ? null : mode
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase
        .from('user_settings')
        .update({ 
          complexity_override: value
        })
        .eq('user_id', user.id)

      setComplexityOverride(value)

      setMessage({ type: 'success', text: 'Preferência de visualização atualizada.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar preferência.' })
    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  const getComplexityDisplayMode = () => {
    if (overrideMode === 'simple') return 'Ativo: Modo Padrão (simplificado)'
    if (overrideMode === 'complex') return 'Ativo: Modo Detalhado'
    return `Ativo: Automático (atualmente: ${complexityMode === 'simple' ? 'Padrão' : 'Detalhado'})`
  }

  // ── Handlers (Conta) ──
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' })
      setShowPasswordForm(false)
      setNewPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm('Deseja realmente sair?')) return
    await supabase.auth.signOut()
    onNavigate('login')
  }

  // ── Render ──
  return (
    <main className="sr-view">
      <SettingsHeader 
        onNavigate={onNavigate} 
        message={message.type === 'success' ? message.text : null} 
        error={message.type === 'error' ? message.text : null} 
      />

      {loading ? (
        <div className="sr-loading">Carregando configurações...</div>
      ) : (
        <>
          <NotificationSection
            webPushSupported={webPushSupported}
            channelWebPushEnabled={channelWebPushEnabled}
            savingChannel={savingChannel}
            handleToggleWebPush={handleToggleWebPush}
            isTelegramConnected={isTelegramConnected}
            notificationMode={notificationMode}
            handleModeChange={handleModeChange}
            savingNotification={savingNotification}
            quietHoursEnabled={quietHoursEnabled}
            setQuietHoursEnabled={setQuietHoursEnabled}
            quietHoursStart={quietHoursStart}
            setQuietHoursStart={setQuietHoursStart}
            quietHoursEnd={quietHoursEnd}
            setQuietHoursEnd={setQuietHoursEnd}
            saveQuietHours={saveQuietHours}
            digestTime={digestTime}
            setDigestTime={setDigestTime}
            saveDigestTime={saveDigestTime}
          />

          <IntegrationSection
            isTelegramConnected={isTelegramConnected}
            generateTelegramToken={generateTelegramToken}
            telegramToken={telegramToken}
            handleDisconnectTelegram={handleDisconnectTelegram}
          />

          <PreferenceSection
            overrideMode={overrideMode}
            handleComplexityChange={handleComplexityChange}
            getComplexityDisplayMode={getComplexityDisplayMode}
            theme={theme}
            toggleTheme={toggleTheme}
          />

          <AccountSection
            showPasswordForm={showPasswordForm}
            setShowPasswordForm={setShowPasswordForm}
            handleUpdatePassword={handleUpdatePassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            handleLogout={handleLogout}
          />

          <AdminSection isAdmin={isAdmin} dlqCount={dlqCount} onNavigate={onNavigate} />

          <footer className="sr-footer">Dosiq v3.3.0 • Design Santuário</footer>
        </>
      )}
    </main>
  )
}
