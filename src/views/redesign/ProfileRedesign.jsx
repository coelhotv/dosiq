// src/views/redesign/ProfileRedesign.jsx
import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { supabase, signOut, updatePassword } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import ProfileHeaderRedesign from './profile/ProfileHeaderRedesign'
import ProfileSectionRedesign from './profile/ProfileSectionRedesign'
import ProfileLinkRedesign from './profile/ProfileLinkRedesign'
import './profile/ProfileRedesign.css'

// Definição das seções de navegação
const SECTIONS = [
  { id: 'health',   label: 'Saúde & Histórico',  icon: '📊' },
  { id: 'reports',  label: 'Relatórios & Dados',  icon: '📄' },
  { id: 'settings', label: 'Configurações',        icon: '⚙️' },
]

export default function ProfileRedesign({ onNavigate }) {
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
  const [activeSection, setActiveSection] = useState('health')

  // Effects
  useEffect(() => {
    loadProfile()
  }, [])

  // Handlers
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (!error && data) setSettings(data)
      else if (error && error.code !== 'PGRST116') console.error(error)
    } catch (err) {
      console.error(err)
      setError('Falha ao carregar os dados do perfil. Por favor, recarregue a página.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut() } catch (err) { console.error(err) }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return }
    try {
      await updatePassword(newPassword)
      showFeedback('Senha atualizada com sucesso!')
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
        .upsert({ user_id: user.id, verification_token: token, updated_at: new Date() }, { onConflict: 'user_id' })
      if (error) throw error
      setTelegramToken(token)
    } catch (err) {
      console.error(err)
      setError('Erro ao gerar token. Tente novamente.')
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Deseja desconectar o Telegram? Você parará de receber notificações.')) return
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ telegram_chat_id: null, verification_token: null, updated_at: new Date() })
        .eq('user_id', user.id)
      if (error) throw error
      setSettings((prev) => ({ ...prev, telegram_chat_id: null }))
      setTelegramToken(null)
      showFeedback('Telegram desconectado!')
    } catch (err) {
      console.error(err)
      setError('Erro ao desconectar Telegram.')
    }
  }

  const handleComplexityChange = (value) => {
    setComplexityOverride(value)
    if (value === 'auto') localStorage.removeItem('mr_complexity_override')
    else localStorage.setItem('mr_complexity_override', value)
  }

  const showFeedback = (msg) => {
    setMessage(msg)
    setError(null)
    setTimeout(() => setMessage(null), 3000)
  }

  if (isLoading) return <Loading />

  const isTelegramConnected = !!settings?.telegram_chat_id
  const initials = (user?.user_metadata?.name || user?.email || 'P')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  // Section content blocks
  const sectionHealth = (
    <ProfileSectionRedesign title="Saúde & Histórico">
      <ProfileLinkRedesign icon="📊" label="Minha Saúde"          onClick={() => onNavigate('health-history')} />
      <ProfileLinkRedesign icon="🆘" label="Cartão de Emergência" onClick={() => onNavigate('emergency')} />
      <ProfileLinkRedesign icon="👨‍⚕️" label="Modo Consulta Médica" onClick={() => onNavigate('consultation')} />
    </ProfileSectionRedesign>
  )

  const sectionReports = (
    <ProfileSectionRedesign title="Relatórios & Dados">
      <ProfileLinkRedesign icon="📄" label="Relatório PDF"  onClick={() => setIsReportModalOpen(true)} />
      <ProfileLinkRedesign icon="📤" label="Exportar Dados" onClick={() => setIsExportDialogOpen(true)} />
    </ProfileSectionRedesign>
  )

  const sectionSettings = (
    <ProfileSectionRedesign title="Configurações">
      <div className="pr-telegram">
        <div className="pr-telegram__row">
          <span className="pr-telegram__icon-wrap" aria-hidden="true">🤖</span>
          <span className="pr-telegram__label">Telegram</span>
          <span className={`pr-telegram__badge pr-telegram__badge--${isTelegramConnected ? 'connected' : 'disconnected'}`}>
            {isTelegramConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        {isTelegramConnected ? (
          <div className="pr-telegram__expand">
            <button className="pr-telegram__disconnect-btn" onClick={handleDisconnectTelegram} type="button">
              Desconectar
            </button>
          </div>
        ) : (
          <div className="pr-telegram__expand">
            {!telegramToken ? (
              <button className="pr-telegram__disconnect-btn" style={{ color: 'var(--color-primary)' }} onClick={generateTelegramToken} type="button">
                Gerar código de vínculo
              </button>
            ) : (
              <div>
                <p className="pr-telegram__code" style={{ margin: '0 0 4px' }}>
                  Envie ao bot: <code>/start {telegramToken}</code>
                </p>
                <a href={`https://t.me/meus_remedios_bot?start=${telegramToken}`} target="_blank" rel="noreferrer" className="pr-telegram__link">
                  Abrir no Telegram
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pr-density">
        <div className="pr-density__row">
          <span className="pr-density__icon-wrap" aria-hidden="true">📐</span>
          <span className="pr-density__label">Densidade</span>
          <select className="pr-density__select" value={complexityOverride} onChange={(e) => handleComplexityChange(e.target.value)} aria-label="Selecionar densidade da interface">
            <option value="auto">Automático</option>
            <option value="simple">Confortável</option>
            <option value="moderate">Normal</option>
            <option value="complex">Compacto</option>
          </select>
        </div>
      </div>

      <div className="pr-password">
        <div className="pr-password__row">
          <span className="pr-password__icon-wrap" aria-hidden="true">🔒</span>
          <span className="pr-password__label">Alterar Senha</span>
          <button className="pr-password__toggle" onClick={() => setShowPasswordForm(!showPasswordForm)} type="button">
            {showPasswordForm ? 'Cancelar' : 'Alterar'}
          </button>
        </div>
        {showPasswordForm && (
          <form className="pr-password__form" onSubmit={handleUpdatePassword}>
            <input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-password__input" autoComplete="new-password" />
            <Button type="submit" disabled={!newPassword}>Salvar</Button>
          </form>
        )}
      </div>

      {(user?.user_metadata?.role === 'admin' || settings?.telegram_chat_id === import.meta.env.VITE_ADMIN_CHAT_ID) && (
        <ProfileLinkRedesign icon="🛠️" label="Admin DLQ" onClick={() => onNavigate('admin-dlq')} />
      )}
    </ProfileSectionRedesign>
  )

  return (
    <div className="pr-view">
      {message && <div className="pr-message pr-message--success">{message}</div>}
      {error   && <div className="pr-message pr-message--error">{error}</div>}

      <div className="pr-layout">
        <aside className="pr-panel">
          <div className="pr-panel__header">
            <div className="pr-panel__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-panel__info">
              <span className="pr-panel__name">{user?.user_metadata?.name || 'Paciente'}</span>
              {user?.email && <span className="pr-panel__email">{user.email}</span>}
            </div>
          </div>

          <nav className="pr-panel__nav" aria-label="Seções do perfil">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pr-panel-nav__item${activeSection === s.id ? ' pr-panel-nav__item--active' : ''}`}
                onClick={() => setActiveSection(s.id)}
                aria-current={activeSection === s.id ? 'page' : undefined}
              >
                <span className="pr-panel-nav__icon" aria-hidden="true">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="pr-panel__logout">
            <button className="pr-panel__logout-btn" onClick={handleLogout} type="button">
              <LogOut size={16} aria-hidden="true" />
              Sair da Conta
            </button>
          </div>
        </aside>

        <div className="pr-content">
          <div className="pr-header pr-header--mobile-only">
            <div className="pr-header__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-header__info">
              <h2 className="pr-header__name">{user?.user_metadata?.name || 'Paciente'}</h2>
              {user?.email && <span className="pr-header__email">{user.email}</span>}
            </div>
          </div>

          <div data-section="health"   className="pr-section-slot" data-active={activeSection === 'health'   ? 'true' : undefined}>{sectionHealth}</div>
          <div data-section="reports"  className="pr-section-slot" data-active={activeSection === 'reports'  ? 'true' : undefined}>{sectionReports}</div>
          <div data-section="settings" className="pr-section-slot" data-active={activeSection === 'settings' ? 'true' : undefined}>{sectionSettings}</div>

          <div className="pr-logout pr-logout--mobile-only">
            <button className="pr-logout__btn" onClick={handleLogout} type="button">
              Sair da Conta
            </button>
          </div>
        </div>
      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
