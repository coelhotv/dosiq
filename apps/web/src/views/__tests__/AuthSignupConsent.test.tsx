// AuthSignupConsent.test.tsx — signup web `dq4a` (spec 096 T051, PO-13/PO-UX-1).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn().mockResolvedValue({}) }))
vi.mock('@shared/utils/supabase', () => ({
  signIn: vi.fn(), signUp: signUpMock, sendPasswordReset: vi.fn(), verifyOtp: vi.fn(), captureDeviceTimezone: vi.fn(),
}))
vi.mock('@dashboard/services/analyticsService', () => ({ analyticsService: { track: vi.fn() } }))

import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import Auth from '../Auth'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('Auth — signup v0.4', () => {
  it('caixas A e B desmarcadas + rodapé de termos v0.4', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText(HEALTH_CONSENT_COPY.label)).not.toBeChecked()
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label)).not.toBeChecked()
    expect(screen.getByText(/Ao criar a conta, você aceita os/).textContent).toContain('(v0.4)')
  })

  it('🔴 sem A ⇒ não cria conta, erro com foco na caixa', () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fillAndSubmit()
    expect(signUpMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Marque a autorização de dados de saúde para criar a conta.')
    expect(document.activeElement).toBe(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
  })

  it('A sem B ⇒ cria conta (B nunca é condição — guarda 4)', async () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fillAndSubmit()
    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith('a@b.com', 'secret123', { healthConsent: true, transferConsent: false }))
  })

  it('A + B ⇒ intenção de B viaja no signup', async () => {
    render(<Auth defaultLogin={false} onAuthSuccess={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.click(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    fillAndSubmit()
    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith('a@b.com', 'secret123', { healthConsent: true, transferConsent: true }))
  })
})
