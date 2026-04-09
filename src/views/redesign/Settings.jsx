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
} from 'lucide-react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { validatePasswordChange } from '@schemas/authSchema'
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
export default function SettingsRedesign({ onNavigate }) {
  // ═══ States ═══
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // ═══ Hooks ═══
  const { mode: complexityMode, medicineCount, overrideMode, setOverride } = useComplexityMode()

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
          onClick={() => onNavigate?.('profile')}
          aria-label="Voltar"
          type="button"
        >
          ←
        </button>
        <h1 className="sr-header__title">Configurações</h1>
      </div>

      {/* ── Feedback messages ── */}
      {message && <div className="sr-message sr-message--success">{message}</div>}
      {error && <div className="sr-message sr-message--error">{error}</div>}

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
                    href="https://t.me/meus_remedios_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sr-telegram__link"
                  >
                    Abrir no Telegram →
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sr-telegram__badge sr-telegram__badge--connected">● Conectado</div>
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
              Alterar →
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
              Ver Alertas →
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
        MEUS REMÉDIOS V{import.meta.env.VITE_APP_VERSION || '4.0.0'} • {currentYear}
      </footer>
    </div>
  )
}
