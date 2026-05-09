import { useState } from 'react'
import { supabase } from '@shared/utils/supabase'

export default function ResetPasswordView({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('Erro ao atualizar senha. Tente solicitar um novo link de recuperação.')
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>✓</div>
          <h2 style={styles.title}>Senha alterada!</h2>
          <p style={styles.desc}>Sua senha foi redefinida com sucesso.</p>
          <button style={styles.btn} onClick={onComplete}>Continuar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Nova senha</h2>
        <p style={styles.desc}>Escolha uma senha segura para sua conta.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nova senha (mínimo 8 caracteres)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={styles.input}
            disabled={loading}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: 'var(--color-surface)',
    borderRadius: '16px',
    padding: '40px 32px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--color-primary-subtle, #e6f4f1)',
    color: 'var(--color-primary, #006A5E)',
    fontSize: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    marginBottom: '8px',
  },
  desc: {
    fontSize: '14px',
    color: 'var(--color-text-secondary)',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    fontSize: '15px',
    marginBottom: '12px',
    background: 'var(--color-surface-elevated, #fff)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  },
  error: {
    color: 'var(--color-error, #dc2626)',
    fontSize: '13px',
    marginBottom: '12px',
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: 'var(--color-primary, #006A5E)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
}
