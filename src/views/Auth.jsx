import { useState } from 'react'
import { signIn, signUp } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import './Auth.css'

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

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

  return (
    <div className="auth-container">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <div className="logo-container">
            <img src="/logo-new.svg" alt="Meus Remédios" className="auth-logo" />
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

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <Button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </Button>
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
