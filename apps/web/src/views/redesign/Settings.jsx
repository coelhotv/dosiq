import { useState, useEffect, useCallback } from 'react'
import {
  Webhook,
  MonitorCog,
  UserKey,
  ShieldUser,
  Form,
  Wand2,
  Grid3x2,
  LogOut,
  Bell,
  Smartphone,
  Globe,
  Send,
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { validatePasswordChange } from '@schemas/authSchema'
import { userSettingsNotificationSchema } from '@schemas/userSettingsSchema'
import { webpushService } from '@shared/services/webpushService'
import Button from '@shared/components/ui/Button'
import './settings/SettingsRedesign.css'

/**
 * SettingsRedesign — View independente de Configurações (Wave 10A)
 *
 * Extrai da Wave 9 ProfileRedesign: Telegram, Densidade, Senha, Admin DLQ, Logout.
 * Acessível via ícone ⚙️ no header do Perfil.
 *
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback para navegação ('profile', 'admin-dlq', etc.)
 */
export default function Settings({ onNavigate }) {
  // ═══ States ═══
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // ═══ Notification States (Wave N2) ═══
  const [channelWebPushEnabled, setChannelWebPushEnabled] = useState(false)
  const [notificationMode, setNotificationMode] = useState('realtime')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')
  const [digestTime, setDigestTime] = useState('07:00')
  const [savingChannel, setSavingChannel] = useState(false)
  const [savingNotification, setSavingNotification] = useState(false)

  // ═══ Hooks ═══
  const { mode: complexityMode, medicineCount, overrideMode, setOverride } = useComplexityMode()
  const webPushSupported = typeof window !== 'undefined' && 'PushManager' in window

  // ═══ Helper Functions ═══
  const showFeedback = useCallback((msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }, [])

  // ═══ Handlers ═══
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true)
      const userId = await getUserId()
      const { data: authData } = await supabase.auth.getUser()
      setUser(authData?.user ?? null)

      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Erro ao carregar settings:', settingsError.message)
      } else {
        setSettings(settingsData ?? {})
        if (settingsData?.telegram_token) {
          setTelegramToken(settingsData.telegram_token)
        }
        // Load notification settings
        if (settingsData?.notification_mode) {
          setNotificationMode(settingsData.notification_mode)
        }
        if (settingsData?.channel_web_push_enabled) {
          setChannelWebPushEnabled(settingsData.channel_web_push_enabled)
        }
        if (settingsData?.quiet_hours_start && settingsData?.quiet_hours_end) {
          setQuietHoursEnabled(true)
          setQuietHoursStart(settingsData.quiet_hours_start)
          setQuietHoursEnd(settingsData.quiet_hours_end)
        }
        if (settingsData?.digest_time) {
          setDigestTime(settingsData.digest_time)
        }
      }
    } catch (err) {
      setError('Erro ao carregar perfil: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateTelegramToken = useCallback(async () => {
    try {
      const token = crypto.randomUUID()
      const userId = await getUserId()
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, telegram_token: token }, { onConflict: 'user_id' })
      if (error) throw error
      setTelegramToken(token)
      showFeedback('Código gerado! Copie e envie ao bot.')
    } catch (err) {
      setError('Erro ao gerar código: ' + err.message)
    }
  }, [showFeedback])

  const handleDisconnectTelegram = useCallback(async () => {
    if (!window.confirm('Desconectar do Telegram?')) return
    try {
      const userId = await getUserId()
      const { error } = await supabase
        .from('user_settings')
        .update({ telegram_chat_id: null })
        .eq('user_id', userId)
      if (error) throw error
      setTelegramToken(null)
      setSettings((prev) => ({ ...prev, telegram_chat_id: null }))
      showFeedback('Desconectado do Telegram.')
    } catch (err) {
      setError('Erro ao desconectar: ' + err.message)
    }
  }, [showFeedback])

  const handleComplexityChange = useCallback(
    (newMode) => {
      setOverride(newMode === 'auto' ? null : newMode)
      showFeedback(
        `Modo alterado para ${newMode === 'auto' ? 'Automático' : newMode === 'simple' ? 'Padrão' : 'Detalhado'}.`
      )
    },
    [setOverride, showFeedback]
  )

  const handleUpdatePassword = useCallback(
    async (e) => {
      e.preventDefault()

      // Validação com Zod (de acordo com diretrizes do projeto)
      const validation = validatePasswordChange({ newPassword })
      if (!validation.success) {
        setError(validation.error)
        return
      }

      try {
        const { error } = await supabase.auth.updateUser({ password: validation.data.newPassword })
        if (error) throw error
        setNewPassword('')
        setShowPasswordForm(false)
        showFeedback('Senha alterada com sucesso!')
      } catch (err) {
        setError('Erro ao alterar senha: ' + err.message)
      }
    },
    [newPassword, showFeedback]
  )

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      onNavigate?.('landing')
    } catch (err) {
      setError('Erro ao sair: ' + err.message)
    }
  }, [onNavigate])

  const handleToggleWebPush = useCallback(async (e) => {
    const enabled = e.target.checked
    setSavingChannel(true)
    try {
      const userId = await getUserId()
      if (enabled) {
        await webpushService.subscribe()
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            channel_web_push_enabled: enabled,
          },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      setChannelWebPushEnabled(enabled)
      showFeedback(enabled ? 'Push web ativado' : 'Push web desativado')
    } catch (err) {
      console.error('[Settings] webpush toggle error', err)
      setError('Erro ao configurar push web: ' + err.message)
    } finally {
      setSavingChannel(false)
    }
  }, [showFeedback])

  const handleModeChange = useCallback(
    async (mode) => {
      const v = userSettingsNotificationSchema.shape.notification_mode.safeParse(mode)
      if (!v.success) { setError('Modo inválido'); return }
      setSavingNotification(true)
      try {
        const userId = await getUserId()
        setNotificationMode(mode)
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: userId,
              notification_mode: mode,
            },
            { onConflict: 'user_id' }
          )
        if (error) throw error
        showFeedback('Modo alterado com sucesso')
      } catch (err) {
        console.error('[Settings] mode change error', err)
        setError('Erro ao alterar modo: ' + err.message)
      } finally {
        setSavingNotification(false)
      }
    },
    [showFeedback]
  )

  const saveQuietHours = useCallback(async () => {
    if (quietHoursEnabled && (!quietHoursStart || !quietHoursEnd)) {
      setError('Preencha os horários')
      return
    }
    if (quietHoursEnabled) {
      const v = userSettingsNotificationSchema.pick({ quiet_hours_start: true, quiet_hours_end: true })
        .safeParse({ quiet_hours_start: quietHoursStart, quiet_hours_end: quietHoursEnd })
      if (!v.success) { setError(v.error.errors[0]?.message ?? 'Horário inválido'); return }
    }
    try {
      const userId = await getUserId()
      const start = quietHoursEnabled ? quietHoursStart : null
      const end = quietHoursEnabled ? quietHoursEnd : null

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            quiet_hours_start: start,
            quiet_hours_end: end,
          },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      showFeedback('Horários salvos')
    } catch (err) {
      console.error('[Settings] quiet hours error', err)
      setError('Erro ao salvar horários: ' + err.message)
    }
  }, [quietHoursEnabled, quietHoursStart, quietHoursEnd, showFeedback])

  const saveDigestTime = useCallback(async () => {
    if (!digestTime) {
      setError('Selecione um horário')
      return
    }
    try {
      const userId = await getUserId()
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            digest_time: digestTime,
          },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      showFeedback('Horário do resumo salvo')
    } catch (err) {
      console.error('[Settings] digest time error', err)
      setError('Erro ao salvar horário: ' + err.message)
    }
  }, [digestTime, showFeedback])

  // ═══ Effects ═══
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // ═══ Render ═══
  if (isLoading) {
    return (
      <div className="sr-view">
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Carregando...</div>
      </div>
    )
  }

  const getComplexityDisplayMode = () => {
    if (overrideMode === 'simple') return `Modo atual: Padrão (manual)`
    if (overrideMode === 'complex') return `Modo atual: Detalhado (manual)`
    const autoMode = complexityMode === 'complex' ? 'Detalhado' : 'Padrão'
    return `Modo atual: Automático (${autoMode} — ${medicineCount} tratamento${medicineCount !== 1 ? 's' : ''} ativos)`
  }

  const currentYear = new Date().getFullYear()

  const isTelegramConnected =
    settings?.telegram_chat_id !== null && settings?.telegram_chat_id !== undefined

  const isAdmin =
    user?.user_metadata?.role === 'admin' ||
    String(settings?.telegram_chat_id) === import.meta.env.VITE_ADMIN_CHAT_ID

  return (
    <div className="sr-view">
      {/* ── Header com back button ── */}
      <div className="sr-header">
        <button
          className="sr-header__back"
          onClick={() => onNavigate('dashboard')}
          type="button"
          aria-label="Voltar"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="sr-header__title">Configurações</h1>
      </div>

      {/* ── Feedback messages ── */}
      {message && <div className="sr-message sr-message--success">{message}</div>}
      {error && <div className="sr-message sr-message--error">{error}</div>}


      {/* ═══ NOTIFICAÇÕES ═══ */}
      <section className="sr-section">
        <h3 className="sr-section__title">
          <Bell size={24} /> Notificações
        </h3>

        {/* ── Seção: Canais ── */}
        <div className="sr-section__card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Canais
          </h4>

          {/* App (push nativo) — informativo */}
          <div className="settings-row settings-row--info">
            <div className="settings-row-label">
              <span className="settings-row-icon">
                <Smartphone size={18} />
              </span>
              <div>
                <span className="settings-row-title">App (push)</span>
                <span className="settings-row-subtitle">Gerenciado pelo aplicativo móvel</span>
              </div>
            </div>
            <span className="settings-badge settings-badge--info">App</span>
          </div>

          {/* Web (PWA) — switch funcional */}
          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-row-icon">
                <Globe size={18} />
              </span>
              <div>
                <span className="settings-row-title">Web (PWA)</span>
                <span className="settings-row-subtitle">
                  {webPushSupported
                    ? channelWebPushEnabled
                      ? 'Ativo neste navegador'
                      : 'Inativo neste navegador'
                    : 'Não suportado neste navegador'}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              className="settings-toggle"
              checked={channelWebPushEnabled}
              disabled={!webPushSupported || savingChannel}
              onChange={handleToggleWebPush}
              aria-label="Ativar notificações Web (PWA)"
            />
          </div>

          {/* Telegram — status */}
          <div className="settings-row settings-row--info">
            <div className="settings-row-label">
              <span className="settings-row-icon">
                <Send size={18} />
              </span>
              <div>
                <span className="settings-row-title">Telegram</span>
                <span className="settings-row-subtitle">Status de integração</span>
              </div>
            </div>
            <span
              className={`settings-badge ${
                isTelegramConnected ? 'settings-badge--success' : 'settings-badge--muted'
              }`}
            >
              {isTelegramConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {/* Email — disabled */}
          <div className="settings-row settings-row--disabled">
            <div className="settings-row-label">
              <span className="settings-row-icon">
                <Mail size={18} />
              </span>
              <div>
                <span className="settings-row-title">Email</span>
                <span className="settings-row-subtitle">Em breve</span>
              </div>
            </div>
            <span className="settings-badge settings-badge--muted">Em breve</span>
          </div>
        </div>

        {/* ── Seção: Modo de notificação ── */}
        <div className="sr-section__card" style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Modo de notificação
          </h4>
          {[
            {
              value: 'realtime',
              label: 'Tempo real',
              desc: 'Receba cada lembrete no momento certo',
            },
            {
              value: 'digest_morning',
              label: 'Resumo matinal',
              desc: 'Um resumo por dia no horário escolhido',
            },
            {
              value: 'silent',
              label: 'Silencioso',
              desc: 'Sem envios externos, apenas no app',
            },
          ].map(({ value, label, desc }) => (
            <label key={value} className="settings-radio-row">
              <input
                type="radio"
                name="notification_mode"
                value={value}
                checked={notificationMode === value}
                onChange={() => handleModeChange(value)}
                disabled={savingNotification}
              />
              <div>
                <span className="settings-radio-label">{label}</span>
                <span className="settings-radio-desc">{desc}</span>
              </div>
            </label>
          ))}
        </div>

        {/* ── Seção: Não me incomode ── */}
        <div className="sr-section__card" style={{ marginTop: '1rem' }}>
          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-row-title">Não me incomode</span>
              <span className="settings-row-subtitle">
                Silenciar notificações externas neste período
              </span>
            </div>
            <input
              type="checkbox"
              className="settings-toggle"
              checked={quietHoursEnabled}
              onChange={(e) => setQuietHoursEnabled(e.target.checked)}
              aria-label="Ativar não me incomode"
            />
          </div>
          {quietHoursEnabled && (
            <div className="settings-time-row">
              <label className="settings-time-label">
                Das{' '}
                <input
                  type="time"
                  className="settings-time-input"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                />
              </label>
              <span className="settings-time-sep">às</span>
              <label className="settings-time-label">
                <input
                  type="time"
                  className="settings-time-input"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                />
              </label>
              <button
                className="settings-btn-save"
                onClick={saveQuietHours}
                type="button"
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* ── Seção: Hora do resumo (condicional) ── */}
        {notificationMode === 'digest_morning' && (
          <div className="sr-section__card" style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
              Hora do resumo
            </h4>
            <div className="settings-time-row">
              <label className="settings-time-label">
                Enviar às{' '}
                <input
                  type="time"
                  className="settings-time-input"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                />
              </label>
              <button
                className="settings-btn-save"
                onClick={saveDigestTime}
                type="button"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ═══ INTEGRAÇÕES ═══ */}
      <section className="sr-section">
        <h3 className="sr-section__title">
          <Webhook size={24} /> Integrações
        </h3>

        <div className="sr-section__card">
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Telegram
          </h3>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', opacity: 0.6 }}>
            Receba lembretes de medicação e alertas diretamente no seu chat.
          </p>

          {!isTelegramConnected ? (
            <>
              <button
                className="sr-telegram__button sr-telegram__button--primary"
                onClick={generateTelegramToken}
                type="button"
              >
                Gerar Código de Vínculo
              </button>
              {telegramToken && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.5rem 0' }}>
                    Envie ao bot:{' '}
                    <code
                      style={{
                        fontSize: '0.75rem',
                        background: 'rgba(0,0,0,0.05)',
                        padding: '2px 4px',
                        borderRadius: '3px',
                      }}
                    >
                      /start {telegramToken}
                    </code>
                  </p>
                  <a
                    href="https://t.me/dosiq_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sr-telegram__link"
                  >
                    Abrir no Telegram <ArrowRight size={14} style={{ marginLeft: 4 }} />
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sr-telegram__badge sr-telegram__badge--connected">
                <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Conectado
              </div>
              <button
                className="sr-telegram__button sr-telegram__button--danger"
                onClick={handleDisconnectTelegram}
                type="button"
              >
                Desconectar
              </button>
            </>
          )}
        </div>
      </section>

      {/* ═══ PREFERÊNCIAS ═══ */}
      <section className="sr-section">
        <h3 className="sr-section__title">
          <MonitorCog size={24} /> Preferências
        </h3>

        <div className="sr-section__card">
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Densidade da Interface
          </h3>

          <div className="sr-density__options">
            <button
              className={`sr-density__option ${overrideMode === 'simple' ? 'sr-density__option--selected' : ''}`}
              onClick={() => handleComplexityChange('simple')}
              type="button"
            >
              <Form size={24} className="sr-density__option-icon" />
              <div className="sr-density__option-label">Padrão</div>
              <div className="sr-density__option-desc">Textos maiores e foco no essencial</div>
            </button>

            <button
              className={`sr-density__option ${overrideMode === null ? 'sr-density__option--selected' : ''}`}
              onClick={() => handleComplexityChange('auto')}
              type="button"
            >
              <Wand2 size={24} className="sr-density__option-icon" />
              <div className="sr-density__option-label">Automático</div>
              <div className="sr-density__option-desc">Ajusta baseado nos seus tratamentos</div>
            </button>

            <button
              className={`sr-density__option ${overrideMode === 'complex' ? 'sr-density__option--selected' : ''}`}
              onClick={() => handleComplexityChange('complex')}
              type="button"
            >
              <Grid3x2 size={24} className="sr-density__option-icon" />
              <div className="sr-density__option-label">Detalhado</div>
              <div className="sr-density__option-desc">Gráficos detalhados e visões técnicas</div>
            </button>
          </div>

          <div className="sr-density__current">{getComplexityDisplayMode()}</div>
        </div>
      </section>

      {/* ═══ SEGURANÇA ═══ */}
      <section className="sr-section">
        <h3 className="sr-section__title">
          <UserKey size={24} /> Segurança
        </h3>

        <div className="sr-section__card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Alterar Senha
          </h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', opacity: 0.5 }}>
            Última alteração: --
          </p>

          {!showPasswordForm ? (
            <button
              className="sr-password__toggle"
              onClick={() => setShowPasswordForm(true)}
              type="button"
            >
              Alterar <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </button>
          ) : (
            <form className="sr-password__form" onSubmit={handleUpdatePassword}>
              <input
                type="password"
                className="sr-password__input"
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="submit" className="sr-password__button sr-password__button--primary">
                  Salvar
                </button>
                <button
                  type="button"
                  className="sr-password__button sr-password__button--secondary"
                  onClick={() => {
                    setShowPasswordForm(false)
                    setNewPassword('')
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ═══ ÁREA ADMINISTRATIVA (condicional) ═══ */}
      {isAdmin && (
        <section className="sr-section">
          <h3 className="sr-section__title">
            <ShieldUser size={24} /> Área Administrativa{' '}
            <span className="sr-admin__badge">ACESSO RESTRITO</span>
          </h3>

          <div className="sr-section__card sr-admin">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
              Dead Letter Queue (DLQ)
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', opacity: 0.6 }}>
              Gerenciar falhas de sincronização e alertas do sistema.
            </p>
            <button
              className="sr-admin__button"
              onClick={() => onNavigate?.('admin-dlq')}
              type="button"
            >
              Ver Alertas <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </section>
      )}

      {/* ═══ LOGOUT ═══ */}
      <div className="sr-logout">
        <button className="sr-logout__btn" onClick={handleLogout} type="button">
          <LogOut size={18} />
          Sair da Conta
        </button>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="sr-footer">
        Dosiq V{import.meta.env.VITE_APP_VERSION || '4.0.0'} • {currentYear}
      </footer>
    </div>
  )
}
