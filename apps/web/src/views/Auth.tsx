import { useState } from 'react'
import { X } from 'lucide-react'
import { signIn, signUp, sendPasswordReset, verifyOtp, captureDeviceTimezone } from '@shared/utils/supabase'
import HealthConsentBlock from '@features/consent/components/HealthConsentBlock'
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

function VerifyOtpCard({
  otpToken,
  setOtpToken,
  isLoading,
  error,
  message,
  onClose,
  onSubmit,
  onBack,
}) {
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

        <form onSubmit={onSubmit} className="auth-form">
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
          <button type="button" className="auth-submit-btn" style={{ backgroundColor: 'var(--color-surface-container, #eceeef)', color: 'var(--color-on-surface, #191c1d)', marginTop: '8px' }} onClick={onBack}>
            Voltar ao login
          </button>
        </form>
      </div>
    </div>
  )
}

function AuthHeader({ isLogin }) {
  return (
    <div className="auth-header">
      <div className="logo-container">
        <img src="/dosiq-logo-verde.svg" alt="dosiq" className="auth-logo" />
      </div>
      <h1>{isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
      <p className="auth-subtitle">
        {isLogin ? 'Acesse sua agenda de medicamentos' : 'Comece a gerenciar sua saúde hoje'}
      </p>
    </div>
  )
}

function AuthFooter({ isLogin, setIsLogin, setError, setMessage }) {
  return (
    <div className="auth-footer">
      <p>
        {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
        <button
          type="button"
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
  )
}

function resolveAuthErrorMessage(err) {
  if (err?.message?.includes('Invalid login credentials')) {
    return 'Email ou senha incorretos.'
  }
  if (err?.message?.includes('User already registered')) {
    return 'Usuário já cadastrado.'
  }
  if (err?.message?.includes('Password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }
  return 'Ocorreu um erro.'
}

export default function Auth({ onAuthSuccess, onClose, defaultLogin = true }) {
  // Produto recém-lançado: o happy path da landing é o cadastro (defaultLogin=false).
  // Usuários antigos alternam para login pelo "Já tem uma conta? Entrar".
  const [isLogin, setIsLogin] = useState(defaultLogin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpToken, setOtpToken] = useState('')
  // 046 T005 — opt-in de dado de saúde. Nasce DESMARCADO: consentimento pré-marcado não é
  // consentimento (LGPD art. 8º §4 — tem que ser manifestação livre e inequívoca do titular).
  const [healthConsent, setHealthConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Gate de submit (FR-002): sem opt-in, o cadastro não sai daqui. Barrar ANTES do signUp é o
    // que dá sentido ao "consentimento é condição de uso" — criar a conta e só depois pedir
    // deixaria uma conta órfã, sem base legal para tratar o dado que ela já teria começado a gerar.
    if (!isLogin && !healthConsent) {
      setConsentError(true)
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isLogin) {
        await signIn(email, password)
        if (onAuthSuccess) onAuthSuccess()
      } else {
        await signUp(email, password, { healthConsent })
        setIsVerifyingOtp(true)
        setMessage('Conta criada! Enviamos um link e um código de confirmação para o seu e-mail.')
      }
    } catch (err) {
      console.error(err)
      setError(resolveAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleConsentChange = (checked) => {
    setHealthConsent(checked)
    if (checked) setConsentError(false)
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
      // F4.3f.0: captura o fuso do device agora (conta confirmada) — antes do
      // onboarding, cobre quem pula o wizard. Best-effort (R-253).
      await captureDeviceTimezone()
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
      <VerifyOtpCard
        otpToken={otpToken}
        setOtpToken={setOtpToken}
        isLoading={isLoading}
        error={error}
        message={message}
        onClose={onClose}
        onSubmit={handleVerifySignUpOtp}
        onBack={() => {
          setIsVerifyingOtp(false)
          setIsLogin(true)
          setError(null)
          setMessage(null)
        }}
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
        <AuthHeader isLogin={isLogin} />

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

          {/* Opt-in de dado de saúde — só no cadastro. Destacado por exigência legal (art. 11):
              não pode estar embutido num aceite genérico de termos. */}
          {!isLogin && (
            <HealthConsentBlock
              checked={healthConsent}
              onChange={handleConsentChange}
              disabled={isLoading}
              showError={consentError}
            />
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <AuthFooter
          isLogin={isLogin}
          setIsLogin={setIsLogin}
          setError={setError}
          setMessage={setMessage}
        />
      </div>
    </div>
  )
}
