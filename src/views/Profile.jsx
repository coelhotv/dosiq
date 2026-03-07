import { useState, useEffect } from 'react'
import { supabase, signOut, updatePassword } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import ProfileHeader from './profile/ProfileHeader'
import ProfileSection from './profile/ProfileSection'
import ProfileLink from './profile/ProfileLink'
import './profile/Profile.css'

export default function Profile({ onNavigate }) {
  // States
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [complexityOverride, setComplexityOverride] = useState(
    () => localStorage.getItem('mr_complexity_override') || 'auto'
  )

  // Effects
  useEffect(() => {
    loadProfile()
  }, [])

  // Handlers
  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!error && data) {
        setSettings(data)
      } else if (error && error.code !== 'PGRST116') {
        console.error(error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres')
      return
    }
    try {
      await updatePassword(newPassword)
      showMessage('Senha atualizada com sucesso!')
      setNewPassword('')
      setShowPasswordForm(false)
    } catch (err) {
      setError('Erro ao atualizar senha: ' + err.message)
    }
  }

  const generateTelegramToken = async () => {
    const token = window.crypto.randomUUID().split('-')[0].toUpperCase()
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, verification_token: token, updated_at: new Date() },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      setTelegramToken(token)
    } catch (err) {
      console.error(err)
      setError('Erro ao gerar token. Tente novamente.')
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Deseja desconectar o Telegram? Você parará de receber notificações.'))
      return
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ telegram_chat_id: null, verification_token: null, updated_at: new Date() })
        .eq('user_id', user.id)
      if (error) throw error
      setSettings((prev) => ({ ...prev, telegram_chat_id: null }))
      setTelegramToken(null)
      showMessage('Telegram desconectado!')
    } catch (err) {
      console.error(err)
      setError('Erro ao desconectar Telegram.')
    }
  }

  const handleComplexityChange = (value) => {
    setComplexityOverride(value)
    if (value === 'auto') {
      localStorage.removeItem('mr_complexity_override')
    } else {
      localStorage.setItem('mr_complexity_override', value)
    }
  }

  const showMessage = (msg) => {
    setMessage(msg)
    setError(null)
    setTimeout(() => setMessage(null), 3000)
  }

  if (isLoading) return <Loading />

  const isTelegramConnected = !!settings?.telegram_chat_id

  return (
    <div className="profile-view">
      <ProfileHeader name={user?.user_metadata?.name} email={user?.email} />

      {message && <div className="profile-message profile-message--success">✅ {message}</div>}
      {error && <div className="profile-message profile-message--error">❌ {error}</div>}

      {/* Saúde & Histórico */}
      <ProfileSection title="Saúde & Histórico">
        <ProfileLink icon="📊" label="Minha Saúde" onClick={() => onNavigate('health-history')} />
        <ProfileLink
          icon="🆘"
          label="Cartão de Emergência"
          onClick={() => onNavigate('emergency')}
        />
        <ProfileLink icon="👨‍⚕️" label="Modo Consulta" onClick={() => onNavigate('consultation')} />
      </ProfileSection>

      {/* Relatórios & Dados */}
      <ProfileSection title="Relatórios & Dados">
        <ProfileLink icon="📄" label="Relatório PDF" onClick={() => setIsReportModalOpen(true)} />
        <ProfileLink icon="📤" label="Exportar Dados" onClick={() => setIsExportDialogOpen(true)} />
      </ProfileSection>

      {/* Configurações */}
      <ProfileSection title="Configurações">
        {/* Telegram */}
        <div className="profile-telegram">
          <div className="profile-telegram__row">
            <span className="profile-telegram__icon">🤖</span>
            <span className="profile-telegram__label">Telegram</span>
            <span
              className={`profile-telegram__badge profile-telegram__badge--${isTelegramConnected ? 'connected' : 'disconnected'}`}
            >
              {isTelegramConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          {isTelegramConnected ? (
            <div style={{ paddingLeft: 40, marginTop: 'var(--space-2)' }}>
              <button
                className="medicine-orphan-card__cta"
                style={{ color: '#ff453a' }}
                onClick={handleDisconnectTelegram}
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div style={{ paddingLeft: 40, marginTop: 'var(--space-2)' }}>
              {!telegramToken ? (
                <button className="medicine-orphan-card__cta" onClick={generateTelegramToken}>
                  Gerar código de vínculo
                </button>
              ) : (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: '0 0 4px' }}>
                    Envie ao bot: <code>/start {telegramToken}</code>
                  </p>
                  <a
                    href={`https://t.me/meus_remedios_bot?start=${telegramToken}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Abrir no Telegram
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Densidade da interface */}
        <div className="profile-complexity">
          <div className="profile-complexity__row">
            <span className="profile-complexity__icon">📐</span>
            <span className="profile-complexity__label">Densidade</span>
            <select
              className="profile-complexity__select"
              value={complexityOverride}
              onChange={(e) => handleComplexityChange(e.target.value)}
            >
              <option value="auto">Automático</option>
              <option value="simple">Confortável</option>
              <option value="moderate">Normal</option>
              <option value="complex">Compacto</option>
            </select>
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="profile-password">
          <div className="profile-password__row">
            <span className="profile-password__icon">🔒</span>
            <span className="profile-password__label">Alterar Senha</span>
            <button
              className="profile-password__toggle"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              {showPasswordForm ? 'Cancelar' : 'Alterar'}
            </button>
          </div>
          {showPasswordForm && (
            <form className="profile-password__form" onSubmit={handleUpdatePassword}>
              <input
                type="password"
                placeholder="Nova senha (min. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="profile-password__input"
              />
              <Button type="submit" disabled={!newPassword}>
                Salvar
              </Button>
            </form>
          )}
        </div>

        {/* Admin DLQ — visível apenas para admins */}
        {user?.user_metadata?.role === 'admin' && (
          <ProfileLink icon="🛠️" label="Admin DLQ" onClick={() => onNavigate('admin-dlq')} />
        )}
      </ProfileSection>

      {/* Logout */}
      <div className="profile-logout">
        <button className="profile-logout__btn" onClick={handleLogout}>
          Sair da Conta
        </button>
      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />

      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
