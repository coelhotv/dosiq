// HealthConsentBlock.test.tsx — opt-in destacado (spec 046, T006/T007).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }))
vi.mock('@dashboard/services/analyticsService', () => ({
  analyticsService: { track: trackMock },
}))

import HealthConsentBlock from '../HealthConsentBlock'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('HealthConsentBlock', () => {
  it('renderiza a copy canônica (título, label, helper)', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)

    expect(screen.getByText('Consentimento para dados de saúde')).toBeTruthy()
    expect(screen.getByLabelText(/Autorizo o dosiq a tratar meus dados de saúde/)).toBeTruthy()
    expect(screen.getByText(/Sem essa autorização o dosiq não consegue funcionar/)).toBeTruthy()
  })

  it('link da política abre em nova aba', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)

    const link = screen.getByText('Ver política de privacidade') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/politica-de-privacidade.html')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('marcar o checkbox NÃO dispara analytics de recusa', () => {
    const onChange = vi.fn()
    render(<HealthConsentBlock checked={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(true)
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('desmarcar o checkbox dispara consent_health_declined sem PII (FR-008)', () => {
    const onChange = vi.fn()
    render(<HealthConsentBlock checked onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(false)
    expect(trackMock).toHaveBeenCalledWith('consent_health_declined', {})
  })

  it('mostra a mensagem de erro só quando showError é true', () => {
    const { rerender } = render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()

    rerender(<HealthConsentBlock checked={false} onChange={vi.fn()} showError />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('desabilita o checkbox quando disabled=true', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} disabled />)

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
