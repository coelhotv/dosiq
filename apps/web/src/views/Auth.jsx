import { useState } from 'react'
import { X } from 'lucide-react'
import { signIn, signUp, sendPasswordReset, verifyOtp } from '@shared/utils/supabase'
import './Auth.css'

function ForgotPasswordCard({ email, setEmail, onBack, onClose }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const [otpToken, setOtpToken] = useState('')

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const tokenClean = otpToken.trim()
    if ((tokenClean.length !== 6 && tokenClean.length !== 8) || isNaN(Number(tokenClean))) {
      setError('O código deve conter 6 ou 8 dígitos numéricos.')
      setIsLoading(false)
      return
    }
    try {
      localStorage.setItem('@dosiq/recovery-flow', 'true')
      await verifyOtp(email, tokenClean, 'recovery')
    } catch (err) {
      console.error(err)
      localStorage.removeItem('@dosiq/recovery-flow')
      setError('Código inválido ou expirado. Verifique o e-mail ou solicite novo link.')
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
          <p className="auth-subtitle">Informe seu email para receber o código de redefinição</p>
        </div>

        {emailSent ? (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            <div className="auth-message" style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
              Enviamos um link de confirmação para o seu e-mail. Você pode clicar nele para entrar automaticamente ou, se preferir, digitar o código de confirmação abaixo:
            </div>
            
            <div className="form-group">
              <label htmlFor="forgot-otp">Código de Confirmação</label>
              <input
                id="forgot-otp"
                type="text"
                maxLength={8}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="Código"
                required
                disabled={isLoading}
                className="auth-input"
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontFamily: 'monospace' }}
              />
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? 'Validando...' : 'Validar código e redefinir senha'}
            </button>
            <button type="button" className="auth-submit-btn" style={{ backgroundColor: 'var(--color-surface-container, #eceeef)', color: 'var(--color-on-surface, #191c1d)', marginTop: '8px' }} onClick={onBack}>
              Voltar ao login
            </button>
          </form>
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
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpToken, setOtpToken] = useState('')

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
        setIsVerifyingOtp(true)
        setMessage('Conta criada! Enviamos um link e um código de confirmação para o seu e-mail.')
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

  const handleVerifySignUpOtp = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const tokenClean = otpToken.trim()
    if ((tokenClean.length !== 6 && tokenClean.length !== 8) || isNaN(Number(tokenClean))) {
      setError('O código deve conter 6 ou 8 dígitos numéricos.')
      setIsLoading(false)
      return
    }
    try {
      await verifyOtp(email, tokenClean, 'signup')
      if (onAuthSuccess) onAuthSuccess()
    } catch (err) {
      console.error(err)
      setError('Código inválido ou expirado. Verifique o código enviado no e-mail.')
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

  if (isVerifyingOtp) {
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
            <h1>Confirmar Conta</h1>
            <p className="auth-subtitle">Digite o código de confirmação enviado para seu e-mail</p>
          </div>

          <form onSubmit={handleVerifySignUpOtp} className="auth-form">
            <div className="auth-message" style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
              Enviamos um link de ativação para o seu e-mail. Se preferir confirmar direto na tela, digite o código abaixo:
            </div>

            <div className="form-group">
              <label htmlFor="signup-otp">Código de Confirmação</label>
              <input
                id="signup-otp"
                type="text"
                maxLength={8}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="Código"
                required
                disabled={isLoading}
                className="auth-input"
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontFamily: 'monospace' }}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-message">{message}</div>}

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Confirmar e entrar'}
            </button>
            <button type="button" className="auth-submit-btn" style={{ backgroundColor: 'var(--color-surface-container, #eceeef)', color: 'var(--color-on-surface, #191c1d)', marginTop: '8px' }} onClick={() => { setIsVerifyingOtp(false); setIsLogin(true); setError(null); setMessage(null) }}>
              Voltar ao login
            </button>
          </form>
        </div>
      </div>
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
