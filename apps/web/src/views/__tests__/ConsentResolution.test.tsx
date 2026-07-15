// ConsentResolution.test.tsx — tela travada de resolução da revogação (spec 046, T010/T007).
//
// Foco: anti-deadlock (R2/F8) — export e exclusão sempre presentes; export abre INLINE (fechar
// volta pra cá, sem sidebar durante a trava); e "voltar a consentir" mostra a tela de opt-in
// (checkbox informado, art. 11), nunca concede num clique.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { grantMock } = vi.hoisted(() => ({ grantMock: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@shared/hooks/useConsentGate', () => ({
  useConsentGate: () => ({ grant: grantMock }),
}))

// Marcadores: o conteúdo do dialog/prompt tem testes próprios; aqui só o roteamento da tela.
vi.mock('@features/export/components/ExportDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>EXPORT_DIALOG</div> : null),
}))
vi.mock('@features/consent/components/ConsentPrompt', () => ({
  default: () => <div>CONSENT_PROMPT</div>,
}))

import ConsentResolution from '../ConsentResolution'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('ConsentResolution', () => {
  it('expõe as 3 saídas anti-deadlock (exportar, excluir, re-consentir)', () => {
    render(<ConsentResolution onNavigate={vi.fn()} />)

    expect(screen.getByLabelText('Exportar meus dados')).toBeTruthy()
    expect(screen.getByLabelText('Excluir minha conta')).toBeTruthy()
    expect(screen.getByLabelText('Voltar a consentir')).toBeTruthy()
  })

  it('exportar abre o dialog INLINE (não navega — sem sidebar na trava, navegar deixaria sem volta)', () => {
    const onNavigate = vi.fn()
    render(<ConsentResolution onNavigate={onNavigate} />)

    fireEvent.click(screen.getByLabelText('Exportar meus dados'))

    expect(screen.getByText('EXPORT_DIALOG')).toBeTruthy()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('excluir navega para account-settings', () => {
    const onNavigate = vi.fn()
    render(<ConsentResolution onNavigate={onNavigate} />)

    fireEvent.click(screen.getByLabelText('Excluir minha conta'))

    expect(onNavigate).toHaveBeenCalledWith('account-settings')
  })

  it('🔴 "voltar a consentir" mostra a tela de opt-in (checkbox) — NÃO concede num clique', () => {
    render(<ConsentResolution onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Voltar a consentir'))

    // Consentimento informado (art. 11): o titular revê a copy e marca o checkbox no ConsentPrompt.
    expect(screen.getByText('CONSENT_PROMPT')).toBeTruthy()
    expect(grantMock).not.toHaveBeenCalled()
  })
})
