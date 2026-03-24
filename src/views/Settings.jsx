import { useState, useEffect } from 'react'
import { supabase, signOut, updatePassword } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import { useRedesign } from '@shared/hooks/useRedesign'
import styles from './Settings.module.css'
import './Settings.css'

export default function Settings({ onNavigate }) {
  const { isRedesignEnabled, toggleRedesign } = useRedesign()
  const isDevMode = typeof localStorage !== 'undefined' && localStorage.getItem('mr_dev_mode') === '1'
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

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
        .single() // Might fail if no settings exist yet

      if (!error && data) {
        setSettings(data)
      } else if (error && error.code !== 'PGRST116') {
        // Ignore "not found"
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
      // App.jsx will handle redirect due to auth state change
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
      setMessage('Senha atualizada com sucesso!')
      setNewPassword('')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setError('Erro ao atualizar senha: ' + err.message)
    }
  }

  const generateTelegramToken = async () => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase()

    try {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          verification_token: token,
          updated_at: new Date(),
        },
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
    if (
      !window.confirm(
        'Deseja realmente desconectar o Telegram? Você parará de receber notificações.'
      )
    )
      return

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          telegram_chat_id: null,
          verification_token: null,
          updated_at: new Date(),
        })
        .eq('user_id', user.id)

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

  if (isLoading) return <Loading />

  return (
    <div className="settings-container">
      <h2 className="page-title">Configurações</h2>

      <div className="settings-section glass-card">
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

        <form onSubmit={handleUpdatePassword} className="password-form">
          <h4>Alterar Senha</h4>
          <div className="input-group">
            <input
              type="password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="settings-input"
            />
            <Button type="submit" disabled={!newPassword}>
              Atualizar
            </Button>
          </div>
        </form>
      </div>

      <div className="settings-section glass-card">
        <h3>Integração Telegram</h3>
        <p className="section-desc">Receba notificações e gerencie seus remédios pelo Telegram.</p>

        <div className="telegram-status">
          Status:
          <span
            className={`status-badge ${settings?.telegram_chat_id ? 'connected' : 'disconnected'}`}
          >
            {settings?.telegram_chat_id ? 'Conectado' : 'Não Conectado'}
          </span>
        </div>

        {settings?.telegram_chat_id ? (
          <div className="connected-actions">
            <p className="section-desc success-text">Bot vinculado com sucesso!</p>
            <Button variant="outline" className="btn-disconnect" onClick={handleDisconnectTelegram}>
              Desconectar Telegram
            </Button>
          </div>
        ) : (
          <div className="connect-telegram">
            {!telegramToken ? (
              <Button onClick={generateTelegramToken}>Gerar Código de Vínculo</Button>
            ) : (
              <div className="token-display">
                <p>Envie este comando para o bot:</p>
                <div className="code-box">/start {telegramToken}</div>
                <a
                  href={`https://t.me/meus_remedios_bot?start=${telegramToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="telegram-link"
                >
                  Abrir Bot no Telegram
                </a>
                <Button
                  variant="ghost"
                  className="btn-cancel-token"
                  onClick={() => setTelegramToken(null)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="settings-section glass-card">
        <h3>Saúde e Emergência</h3>
        <p className="section-desc">Informações médicas críticas para situações de emergência.</p>

        <div className="emergency-actions">
          <Button variant="outline" onClick={() => onNavigate('emergency')}>
            Cartão de Emergência
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('consultation')}
            className={styles.consultationButton}
          >
            Modo Consulta Médica
          </Button>
        </div>
      </div>

      <div className="settings-section glass-card">
        <h3>Exportar Dados</h3>
        <p className="section-desc">
          Exporte seus dados em formato CSV ou JSON para backup ou análise.
        </p>

        <div className="export-actions">
          <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
            Exportar Dados
          </Button>
        </div>
      </div>

      <div className="settings-section glass-card">
        <h3>Relatórios</h3>
        <p className="section-desc">
          Gere relatórios em PDF com seu histórico de medicamentos e adesão.
        </p>

        <div className="report-actions">
          <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
            Gerar Relatório PDF
          </Button>
        </div>
      </div>

      <div className="settings-section glass-card">
        <h3>Administração</h3>
        <p className="section-desc">Ferramentas administrativas do sistema.</p>

        <div className="admin-actions">
          <Button variant="outline" onClick={() => onNavigate('admin-dlq')}>
            Gerenciar Notificações Falhadas (DLQ)
          </Button>
        </div>
      </div>

      {/* Toggle oculto para preview do redesign — visível apenas em dev mode */}
      {isDevMode && (
        <div className="settings-section glass-card">
          <h3>Preview: Redesign</h3>
          <p className="section-desc">
            Ativa o preview do redesign "Santuário Terapêutico" para esta sessão.
            Persiste via localStorage. Desativar com ?redesign=0 na URL.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <Button
              variant={isRedesignEnabled ? 'primary' : 'outline'}
              onClick={toggleRedesign}
            >
              {isRedesignEnabled ? 'Redesign ATIVO' : 'Ativar Redesign'}
            </Button>
            {isRedesignEnabled && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Visual novo ativo — recarregue para ver todas as mudanças
              </span>
            )}
          </div>
        </div>
      )}

      {message && <div className="settings-message success">{message}</div>}
      {error && <div className="settings-message error">{error}</div>}

      <div className="logout-section">
        <Button variant="outline" className="logout-btn" onClick={handleLogout}>
          Sair da Conta
        </Button>
      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />

      {/* Modal de Geração de Relatórios */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
