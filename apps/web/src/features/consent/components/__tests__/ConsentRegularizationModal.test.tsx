// ConsentRegularizationModal.test.tsx — reconsentimento v0.4 bloqueante (spec 096 `rec-web`, T027w).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { grantV04Mock } = vi.hoisted(() => ({ grantV04Mock: vi.fn().mockResolvedValue({ ok: true, transferOk: true }) }))
vi.mock('@shared/hooks/useConsentGate', () => ({
  useConsentGate: () => ({ grantV04: grantV04Mock }),
}))
vi.mock('@dashboard/services/analyticsService', () => ({ analyticsService: { track: vi.fn() } }))
const { getStatusMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn().mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false }),
}))
vi.mock('@shared/utils/supabase', () => ({ supabase: {} }))
vi.mock('@dosiq/core', async () => {
  const actual = await vi.importActual<typeof import('@dosiq/core')>('@dosiq/core')
  return { ...actual, createConsentService: () => ({ getStatus: getStatusMock }) }
})

import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY, REGULARIZATION_V04_COPY } from '@dosiq/core'
import ConsentRegularizationModal from '../ConsentRegularizationModal'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const renderModal = (props: Partial<{ onConfirmed: () => void; onDecline: () => void }> = {}) =>
  render(<ConsentRegularizationModal visible onConfirmed={props.onConfirmed ?? vi.fn()} onDecline={props.onDecline ?? vi.fn()} />)

describe('ConsentRegularizationModal (v0.4)', () => {
  it('não renderiza quando visible=false', () => {
    const { container } = render(<ConsentRegularizationModal visible={false} onConfirmed={vi.fn()} onDecline={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('título DQ-5 A, caixas A e B desmarcadas, rodapé de termos — e sem "Agora não"', () => {
    renderModal()
    expect(screen.getByText(REGULARIZATION_V04_COPY.title)).toBeTruthy()
    expect(screen.getByLabelText(HEALTH_CONSENT_COPY.label)).not.toBeChecked()
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label)).not.toBeChecked()
    expect(screen.getByText(REGULARIZATION_V04_COPY.termsFooter)).toBeTruthy()
    expect(screen.queryByText('Agora não')).toBeNull()
  })

  it('"O que mudou ›" expande a lista', () => {
    renderModal()
    expect(screen.queryByText(REGULARIZATION_V04_COPY.changed[3])).toBeNull()
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.changedLink))
    expect(screen.getByText(REGULARIZATION_V04_COPY.changed[3])).toBeTruthy()
  })

  it('🔴 Confirmar sem A ⇒ erro na caixa, nada gravado', () => {
    renderModal()
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.confirm))
    expect(screen.getByRole('alert').textContent).toBe(REGULARIZATION_V04_COPY.errorNoHealth)
    expect(grantV04Mock).not.toHaveBeenCalled()
  })

  it('A sem B ⇒ confirma (B nunca é condição — guarda 4)', async () => {
    const onConfirmed = vi.fn()
    renderModal({ onConfirmed })
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.confirm))
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(grantV04Mock).toHaveBeenCalledWith({ transfer: false })
  })

  it('A + B ⇒ grava as duas', async () => {
    renderModal()
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.click(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.confirm))
    await waitFor(() => expect(grantV04Mock).toHaveBeenCalledWith({ transfer: true }))
  })

  it('falha ao gravar ⇒ mensagem, não fecha', async () => {
    grantV04Mock.mockResolvedValueOnce({ ok: false, transferOk: false })
    const onConfirmed = vi.fn()
    renderModal({ onConfirmed })
    fireEvent.click(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.confirm))
    expect(await screen.findByText('Não foi possível registrar agora. Tente de novo.')).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('"Não concordo" ⇒ onDecline, sem gravar', () => {
    const onDecline = vi.fn()
    renderModal({ onDecline })
    fireEvent.click(screen.getByText(REGULARIZATION_V04_COPY.decline))
    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(grantV04Mock).not.toHaveBeenCalled()
  })

  it('B já ligado na v0.4 ⇒ sem a caixa B, com o aviso de que já está ligado (smoke 2.6)', async () => {
    getStatusMock.mockResolvedValueOnce({ status: 'granted', policyVersion: '0.4', updatedAt: '2026-10-21T05:00:00-03:00', stale: false })
    renderModal()
    expect(await screen.findByText(REGULARIZATION_V04_COPY.transferAlreadyOn)).toBeTruthy()
    expect(screen.queryByLabelText(TRANSFER_CONSENT_COPY.label)).toBeNull()
  })
})
