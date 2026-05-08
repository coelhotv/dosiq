import { useState, useEffect } from 'react'
import { supabase, signOut, updatePassword } from '@shared/utils/supabase'
import { getNow } from '@utils/dateUtils'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import './Settings.css'

/**
 * Carrega o perfil do usuário e suas configurações do banco.
 */
async function loadUserProfile(setUser, setSettings, setIsLoading) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
    if (!error && data) setSettings(data)
    else if (error && error.code !== 'PGRST116') console.error(error)
  } catch (err) {
    console.error(err)
  } finally {
    setIsLoading(false)
  }
}

/**
 * Gera token de vínculo Telegram e salva no banco.
 */
async function createTelegramToken(userId, setTelegramToken, setError) {
  const token = Math.random().toString(36).substring(2, 8).toUpperCase()
  try {
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: userId, verification_token: token, updated_at: getNow() },
      { onConflict: 'user_id' }
    )
    if (error) throw error
    setTelegramToken(token)
  } catch (err) {
    console.error(err)
    setError('Erro ao gerar token. Tente novamente.')
  }
}

/**
 * Desconecta o Telegram do usuário.
 */
async function disconnectTelegram(userId, setSettings, setTelegramToken, setMessage, setError) {
  if (!window.confirm('Deseja realmente desconectar o Telegram? Você parará de receber notificações.')) return
  try {
    const { error } = await supabase.from('user_settings').update({ telegram_chat_id: null, verification_token: null, updated_at: getNow() }).eq('user_id', userId)
    if (error) throw error
    setSettings((prev) => ({ ...prev, telegram_chat_id: null }))
    setTelegramToken(null)
    setMessage('Telegram desconectado com sucesso!')
    setTimeout(() => setMessage(null), 3000)
  } catch (err) {
    console.error(err)
    setError('Erro ao desconectar Telegram.')
  }
}

/** Renderiza a seção de conta do usuário (email, ID e alteração de senha). */
function AccountSection({ user, newPassword, onPasswordChange, onSubmitPassword }) {
  return (
    <div className="settings-section">
      <h3>Minha Conta</h3>
      <div className="profile-info">
        <div className="info-row">
          <span className="label">Email</span>
          <span className="value">{user?.email}</span>
        </div>
        <div className="info-row">
          <span className="label">ID</span>
          <span className="value mono">{user?.id?.slice(0, 8)}...</span>
        </div>
      </div>
      <form onSubmit={onSubmitPassword} className="password-form">
        <h4>Alterar Senha</h4>
        <div className="input-group">
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={onPasswordChange}
            className="settings-input"
          />
          <Button type="submit" disabled={!newPassword}>Atualizar</Button>
        </div>
      </form>
    </div>
  )
}

/** Renderiza a seção de integração com Telegram. */
function TelegramSection({ settings, telegramToken, onGenerate, onDisconnect, onCancelToken }) {
  return (
    <div className="settings-section">
      <h3>Integração Telegram</h3>
      <p className="section-desc">Receba notificações e gerencie seus remédios pelo Telegram.</p>
      <div className="telegram-status">
        Status:
        <span className={`status-badge ${settings?.telegram_chat_id ? 'connected' : 'disconnected'}`}>
          {settings?.telegram_chat_id ? 'Conectado' : 'Não Conectado'}
        </span>
      </div>
      {settings?.telegram_chat_id ? (
        <div className="connected-actions">
          <p className="section-desc success-text">Bot vinculado com sucesso!</p>
          <Button variant="outline" className="btn-disconnect" onClick={onDisconnect}>
            Desconectar Telegram
          </Button>
        </div>
      ) : (
        <div className="connect-telegram">
          {!telegramToken ? (
            <Button onClick={onGenerate}>Gerar Código de Vínculo</Button>
          ) : (
            <div className="token-display">
              <p>Envie este comando para o bot:</p>
              <div className="code-box">/start {telegramToken}</div>
              <a href={`https://t.me/dosiq_bot?start=${telegramToken}`} target="_blank" rel="noreferrer" className="telegram-link">
                Abrir Bot no Telegram
              </a>
              <Button variant="ghost" className="btn-cancel-token" onClick={onCancelToken}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Settings({ onNavigate }) {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  useEffect(() => { loadUserProfile(setUser, setSettings, setIsLoading) }, [])

  const handleLogout = async () => {
    try { await signOut() } catch (err) { console.error(err) }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return }
    try {
      await updatePassword(newPassword)
      setMessage('Senha atualizada com sucesso!')
      setNewPassword('')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setError('Erro ao atualizar senha: ' + err.message)
    }
  }

  const generateTelegramToken = () => createTelegramToken(user.id, setTelegramToken, setError)
  const handleDisconnectTelegram = () => disconnectTelegram(user.id, setSettings, setTelegramToken, setMessage, setError)

  if (isLoading) return <Loading />

  return (
    <div className="settings-container">
      <h2 className="page-title">Configurações</h2>

      <AccountSection
        user={user}
        newPassword={newPassword}
        onPasswordChange={(e) => setNewPassword(e.target.value)}
        onSubmitPassword={handleUpdatePassword}
      />

      <TelegramSection
        settings={settings}
        telegramToken={telegramToken}
        onGenerate={generateTelegramToken}
        onDisconnect={handleDisconnectTelegram}
        onCancelToken={() => setTelegramToken(null)}
      />

      <div className="settings-section">
        <h3>Saúde e Emergência</h3>
        <p className="section-desc">Informações médicas críticas para situações de emergência.</p>
        <div className="emergency-actions">
          <Button variant="outline" onClick={() => onNavigate('emergency')}>Cartão de Emergência</Button>
          <Button variant="outline" onClick={() => onNavigate('consultation')}>Modo Consulta Médica</Button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Exportar Dados</h3>
        <p className="section-desc">Exporte seus dados em formato CSV ou JSON para backup ou análise.</p>
        <div className="export-actions">
          <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>Exportar Dados</Button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Relatórios</h3>
        <p className="section-desc">Gere relatórios em PDF com seu histórico de medicamentos e adesão.</p>
        <div className="report-actions">
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>Gerar Relatório PDF</Button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Administração</h3>
        <p className="section-desc">Ferramentas administrativas do sistema.</p>
        <div className="admin-actions">
          <Button variant="outline" onClick={() => onNavigate('admin-dlq')}>Gerenciar Notificações Falhadas (DLQ)</Button>
        </div>
      </div>

      {message && <div className="settings-message success">{message}</div>}
      {error && <div className="settings-message error">{error}</div>}

      <div className="logout-section">
        <Button variant="outline" className="logout-btn" onClick={handleLogout}>Sair da Conta</Button>
      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
