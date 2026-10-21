// AuthFieldValidation.test.tsx — validação própria em PT do login/cadastro (smoke 096 B2): sem o balão
// nativo do navegador ("Please fill out this field"), erro abaixo do campo e foco no primeiro inválido.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { signUpMock, signInMock } = vi.hoisted(() => ({
  signUpMock: vi.fn().mockResolvedValue({}),
  signInMock: vi.fn().mockResolvedValue({}),
}))
vi.mock('@shared/utils/supabase', () => ({
  signIn: signInMock, signUp: signUpMock, sendPasswordReset: vi.fn(), verifyOtp: vi.fn(), captureDeviceTimezone: vi.fn(),
}))
vi.mock('@dashboard/services/analyticsService', () => ({ analyticsService: { track: vi.fn() } }))

import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import Auth, { AUTH_FIELD_ERRORS } from '../Auth'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const submitSignup = () => fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

describe('Auth — validação dos campos', () => {
  it('form sem validação nativa (noValidate)', () => {
    const { container } = render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    expect(container.querySelector('form.auth-form')).toHaveAttribute('novalidate')
  })

  it('tudo vazio ⇒ erros em PT nos dois campos, foco no e-mail, nada enviado', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    submitSignup()
    expect(screen.getByText(AUTH_FIELD_ERRORS.emailEmpty)).toBeInTheDocument()
    expect(screen.getByText(AUTH_FIELD_ERRORS.passwordEmpty)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('e-mail sem formato e senha curta (cadastro) ⇒ mensagens específicas', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'eu@dosiq' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123' } })
    submitSignup()
    expect(screen.getByText(AUTH_FIELD_ERRORS.emailInvalid)).toBeInTheDocument()
    expect(screen.getByText(AUTH_FIELD_ERRORS.passwordShort)).toBeInTheDocument()
  })

  it('e-mail ok e senha vazia ⇒ foco na senha', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    submitSignup()
    expect(document.activeElement).toBe(screen.getByLabelText('Senha'))
  })

  it('digitar limpa o erro do campo', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    submitSignup()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a' } })
    expect(screen.queryByText(AUTH_FIELD_ERRORS.emailEmpty)).not.toBeInTheDocument()
  })

  it('campos válidos ⇒ segue para o gate da caixa A', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret123' } })
    submitSignup()
    expect(document.activeElement).toBe(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('login não exige mínimo de 6 na senha (senhas antigas)', () => {
    render(<Auth defaultLogin onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.queryByText(AUTH_FIELD_ERRORS.passwordShort)).not.toBeInTheDocument()
    expect(signInMock).toHaveBeenCalledWith('a@b.com', '123')
  })
})
