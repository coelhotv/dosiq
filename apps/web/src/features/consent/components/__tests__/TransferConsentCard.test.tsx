// TransferConsentCard.test.tsx — cartão B em Privacidade (spec 096 T041w, PO-12/PO-UX-1).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { getStatusMock, grantMock, revokeMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  grantMock: vi.fn().mockResolvedValue({ ok: true }),
  revokeMock: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@shared/utils/supabase', () => ({ supabase: {} }))
vi.mock('@dosiq/core', async () => {
  const actual = await vi.importActual<typeof import('@dosiq/core')>('@dosiq/core')
  return { ...actual, createConsentService: () => ({ getStatus: getStatusMock, grant: grantMock, revoke: revokeMock }) }
})

import { TRANSFER_CONSENT_COPY } from '@dosiq/core'
import TransferConsentCard, { TRANSFER_CARD_COPY } from '../TransferConsentCard'
import { ENABLE_TRANSFER_COPY } from '../EnableTransferModal'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const granted = { status: 'granted', policyVersion: '0.4', updatedAt: '2026-10-21T10:00:00-03:00', stale: false }
const missing = { status: 'missing', policyVersion: null, updatedAt: null, stale: false }

describe('TransferConsentCard', () => {
  it('lê o estado de international_transfer', async () => {
    getStatusMock.mockResolvedValue(missing)
    render(<TransferConsentCard />)
    expect(await screen.findByText(TRANSFER_CARD_COPY.off)).toBeTruthy()
    expect(getStatusMock).toHaveBeenCalledWith('international_transfer')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('🔴 ligar abre a autorização completa (frase verbatim) — nunca grava direto (guarda 11)', async () => {
    getStatusMock.mockResolvedValue(missing)
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    expect(screen.getByText(ENABLE_TRANSFER_COPY.title)).toBeTruthy()
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label)).not.toBeChecked()
    expect(screen.getByText('Detalhes ›')).toBeTruthy()
    expect(grantMock).not.toHaveBeenCalled()
  })

  it('Autorizar sem marcar a caixa ⇒ erro, nada gravado', async () => {
    getStatusMock.mockResolvedValue(missing)
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByText(ENABLE_TRANSFER_COPY.authorize))
    expect(screen.getByRole('alert').textContent).toBe(ENABLE_TRANSFER_COPY.errorNoBox)
    expect(grantMock).not.toHaveBeenCalled()
  })

  it('caixa marcada + Autorizar ⇒ grant international_transfer e recarrega', async () => {
    getStatusMock.mockResolvedValueOnce(missing).mockResolvedValueOnce(granted)
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    fireEvent.click(screen.getByText(ENABLE_TRANSFER_COPY.authorize))
    await waitFor(() => expect(grantMock).toHaveBeenCalledWith('international_transfer', 'web'))
    expect(await screen.findByText(TRANSFER_CARD_COPY.on)).toBeTruthy()
  })

  it('desligar pede confirmação inline com os efeitos; "Manter ligado" não grava', async () => {
    getStatusMock.mockResolvedValue(granted)
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    expect(screen.getByText(TRANSFER_CARD_COPY.offTitle)).toBeTruthy()
    fireEvent.click(screen.getByText(TRANSFER_CARD_COPY.offKeep))
    expect(revokeMock).not.toHaveBeenCalled()
  })

  it('"Desligar" ⇒ revoke international_transfer', async () => {
    getStatusMock.mockResolvedValue(granted)
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByText(TRANSFER_CARD_COPY.offConfirm))
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('international_transfer', 'web'))
  })

  it('"Desligar" sem conexão ⇒ confirmação continua aberta com erro, interruptor segue ligado', async () => {
    getStatusMock.mockResolvedValue(granted)
    revokeMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    render(<TransferConsentCard />)
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByText(TRANSFER_CARD_COPY.offConfirm))
    expect(await screen.findByRole('alert')).toHaveTextContent(TRANSFER_CARD_COPY.offError)
    expect(screen.getByText(TRANSFER_CARD_COPY.offTitle)).toBeTruthy()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('falha de leitura ⇒ erro explícito, interruptor desabilitado (nunca "desligado")', async () => {
    getStatusMock.mockRejectedValue(new Error('net'))
    render(<TransferConsentCard />)
    expect(await screen.findByText('Tentar de novo')).toBeTruthy()
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.queryByText(TRANSFER_CARD_COPY.off)).toBeNull()
  })
})
