// HealthConsentBlock.test.tsx — caixa A (spec 046 T006 → spec 096 v0.4).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }))
vi.mock('@dashboard/services/analyticsService', () => ({
  analyticsService: { track: trackMock },
}))

import { HEALTH_CONSENT_COPY } from '@dosiq/core'
import HealthConsentBlock from '../HealthConsentBlock'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('HealthConsentBlock', () => {
  it('caixa e frase verbatim da v0.4 são um único alvo (label)', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)
    const box = screen.getByLabelText(HEALTH_CONSENT_COPY.label)
    expect(box).not.toBeChecked() // guarda 1: nasce desmarcada
  })

  it('"Detalhes ›" abre a folha S6-A com a copy do core', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Detalhes ›'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    // a copy tem parágrafo ("\n\n"); o matcher padrão colapsa o espaço do nó, então compara o mesmo colapso
    expect(screen.getByText(HEALTH_CONSENT_COPY.details.replace(/\s+/g, ' '))).toBeTruthy()
  })

  it('marcar NÃO dispara analytics de recusa', () => {
    const onChange = vi.fn()
    render(<HealthConsentBlock checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('desmarcar dispara consent_health_declined sem PII (FR-008)', () => {
    const onChange = vi.fn()
    render(<HealthConsentBlock checked onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(false)
    expect(trackMock).toHaveBeenCalledWith('consent_health_declined', {})
  })

  it('erro: mensagem em role=alert e foco na caixa (D-8)', () => {
    const { rerender } = render(<HealthConsentBlock checked={false} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
    rerender(<HealthConsentBlock checked={false} onChange={vi.fn()} errorMessage="Marque a autorização." />)
    expect(screen.getByRole('alert').textContent).toBe('Marque a autorização.')
    expect(document.activeElement).toBe(screen.getByRole('checkbox'))
  })

  it('desabilita a caixa quando disabled=true', () => {
    render(<HealthConsentBlock checked={false} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
