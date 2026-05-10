import { useState } from 'react'
import { X } from 'lucide-react'
import { signIn, signUp, sendPasswordReset } from '@shared/utils/supabase'
import './Auth.css'

function ForgotPasswordCard({ email, setEmail, onBack, onClose }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await sendPasswordReset(email)
      setEmailSent(true)
    } catch {
      setError('Erro ao enviar email de recuperação. Verifique o endereço.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {onClose && (
          <button className="auth-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        )}
        <div className="auth-header">
          <div className="logo-container">
            <img src="/dosiq-logo-verde.svg" alt="dosiq" className="auth-logo" />
          </div>
          <h1>Recuperar senha</h1>
          <p className="auth-subtitle">Informe seu email para receber o link de redefinição</p>
        </div>

        {emailSent ? (
          <div className="auth-form">
            <div className="auth-message">Verifique seu email para redefinir sua senha.</div>
            <button type="button" className="auth-submit-btn" onClick={onBack}>
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="auth-input"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <button type="button" className="toggle-auth-btn" onClick={onBack}>
              Lembrei minha senha
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Auth({ onAuthSuccess, onClose }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isForgotPassword, setIsForgotPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isLogin) {
        await signIn(email, password)
        if (onAuthSuccess) onAuthSuccess()
      } else {
        await signUp(email, password)
        setMessage('Conta criada! Verifique seu email para confirmar o cadastro.')
        setIsLogin(true)
      }
    } catch (err) {
      console.error(err)
      let msg = 'Ocorreu um erro.'
      if (err.message.includes('Invalid login credentials')) {
        msg = 'Email ou senha incorretos.'
      } else if (err.message.includes('User already registered')) {
        msg = 'Usuário já cadastrado.'
      } else if (err.message.includes('Password should be at least')) {
        msg = 'A senha deve ter pelo menos 6 caracteres.'
      }
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (isForgotPassword) {
    return (
      <ForgotPasswordCard
        email={email}
        setEmail={setEmail}
        onClose={onClose}
        onBack={() => { setIsForgotPassword(false); setError(null) }}
      />
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {onClose && (
          <button className="auth-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        )}
        <div className="auth-header">
          <div className="logo-container">
            <img src="/dosiq-logo-verde.svg" alt="dosiq" className="auth-logo" />
          </div>
          <h1>{isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Acesse sua agenda de medicamentos' : 'Comece a gerenciar sua saúde hoje'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="auth-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="auth-input"
            />
          </div>

          {isLogin && (
            <div className="auth-forgot-password-wrapper">
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => { setIsForgotPassword(true); setError(null) }}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              className="toggle-auth-btn"
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
                setMessage(null)
              }}
            >
              {isLogin ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
