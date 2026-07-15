// PrivacyConsentSection.test.tsx — card "Consentimento" (spec 046, T012/T007).
//
// Cobre o contrato mais importante herdado do Slice A: getStatus() que LANÇA vira estado de
// ERRO na UI, nunca "Não informado" — confundir os dois ressuscitaria um revoked silenciosamente
// se um consumidor futuro decidisse agir sobre o rótulo exibido.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { getStatusMock, revokeMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  revokeMock: vi.fn(),
}))

vi.mock('@shared/utils/supabase', () => ({ supabase: {} }))
vi.mock('@dosiq/core', async () => {
  const actual = await vi.importActual<typeof import('@dosiq/core')>('@dosiq/core')
  return {
    ...actual,
    createConsentService: () => ({ getStatus: getStatusMock, revoke: revokeMock }),
  }
})

import PrivacyConsentSection from '../PrivacyConsentSection'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('PrivacyConsentSection', () => {
  it('mostra "Ativo" + data/versão quando granted', async () => {
    getStatusMock.mockResolvedValue({
      status: 'granted',
      policyVersion: '0.2',
      updatedAt: '2026-07-01T12:00:00-03:00',
      stale: false,
    })

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Ativo')).toBeTruthy()
    expect(screen.getByText(/Aceito em 01\/07\/2026 · v0\.2/)).toBeTruthy()
  })

  it('mostra "Retirado" quando revoked, sem botão de revogar', async () => {
    getStatusMock.mockResolvedValue({
      status: 'revoked',
      policyVersion: '0.2',
      updatedAt: '2026-07-05T09:00:00-03:00',
      stale: false,
    })

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Retirado')).toBeTruthy()
    expect(screen.queryByText('Retirar consentimento')).toBeNull()
  })

  it('getStatus que LANÇA vira estado de erro — NUNCA "Não informado"', async () => {
    getStatusMock.mockRejectedValue(new Error('Falha ao ler a trilha de consentimento'))

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy()
    expect(screen.queryByText('Não informado')).toBeNull()
  })

  it('revogar exige duas etapas de confirmação antes de chamar consentService.revoke', async () => {
    getStatusMock.mockResolvedValue({
      status: 'granted',
      policyVersion: '0.2',
      updatedAt: '2026-07-01T12:00:00-03:00',
      stale: false,
    })
    revokeMock.mockResolvedValue({ ok: true })

    render(<PrivacyConsentSection />)
    await screen.findByText('Ativo')

    fireEvent.click(screen.getByText('Retirar consentimento'))
    expect(revokeMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Continuar'))
    expect(revokeMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Retirar consentimento'))
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('health_data', 'web'))
  })
})
