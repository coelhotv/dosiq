// TransferConsent.test.tsx — caixa B no mobile (spec 096 B3: T067 `enableB`, T041m `priv-*`, T040f ponte).

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'
import { ENABLE_TRANSFER_COPY, TRANSFER_CONSENT_COPY, TRANSFER_TOGGLE_COPY } from '@dosiq/core'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const getStatus = jest.fn()
  const grant = jest.fn()
  const revoke = jest.fn()
  return { ...actual, __spies: { getStatus, grant, revoke }, createConsentService: () => ({ getStatus, grant, revoke }) }
})
const mockRefresh = jest.fn()
jest.mock('@platform/consent/useConsentGate', () => ({ useConsentGate: () => ({ refresh: mockRefresh }) }))

const { __spies: spies } = jest.requireMock('@dosiq/core') as { __spies: Record<string, jest.Mock> }
import EnableTransferSheet from '../EnableTransferSheet'
import TransferConsentCard from '../TransferConsentCard'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('EnableTransferSheet (enableB)', () => {
  it('Autorizar sem caixa ⇒ erro, 0 gravação', async () => {
    const onAuthorize = jest.fn()
    render(<EnableTransferSheet onAuthorize={onAuthorize} onCancel={jest.fn()} />)
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label)).toBeTruthy()
    await act(async () => { fireEvent.press(screen.getByLabelText(ENABLE_TRANSFER_COPY.authorize)) })
    expect(screen.getByText(ENABLE_TRANSFER_COPY.errorNoBox)).toBeTruthy()
    expect(onAuthorize).not.toHaveBeenCalled()
  })

  it('rejeição sai do loading com erro', async () => {
    const onAuthorize = jest.fn(() => Promise.reject(new Error('rede')))
    render(<EnableTransferSheet onAuthorize={onAuthorize} onCancel={jest.fn()} />)
    fireEvent.press(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    await act(async () => { fireEvent.press(screen.getByLabelText(ENABLE_TRANSFER_COPY.authorize)) })
    expect(screen.getByText('Não foi possível registrar agora. Tente de novo.')).toBeTruthy()
  })
})

describe('TransferConsentCard (priv-*)', () => {
  it('desligado ⇒ texto off; ligar abre a autorização completa e grava B', async () => {
    spies.getStatus.mockResolvedValueOnce({ status: 'missing' }).mockResolvedValue({ status: 'granted' })
    spies.grant.mockResolvedValue({ ok: true })
    render(<TransferConsentCard />)
    expect(await screen.findByText(TRANSFER_TOGGLE_COPY.off)).toBeTruthy()
    await act(async () => { fireEvent(screen.getByLabelText(TRANSFER_TOGGLE_COPY.toggle), 'valueChange', true) })
    expect(screen.getByText(ENABLE_TRANSFER_COPY.title)).toBeTruthy()
    fireEvent.press(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    await act(async () => { fireEvent.press(screen.getByLabelText(ENABLE_TRANSFER_COPY.authorize)) })
    expect(spies.grant).toHaveBeenCalledWith('international_transfer', 'mobile')
    expect(mockRefresh).toHaveBeenCalled()
    expect(await screen.findByText(TRANSFER_TOGGLE_COPY.on)).toBeTruthy()
  })

  it('desligar pede confirmação âmbar; Manter ligado não grava', async () => {
    spies.getStatus.mockResolvedValue({ status: 'granted' })
    render(<TransferConsentCard />)
    await screen.findByText(TRANSFER_TOGGLE_COPY.on)
    await act(async () => { fireEvent(screen.getByLabelText(TRANSFER_TOGGLE_COPY.toggle), 'valueChange', false) })
    expect(screen.getByText(TRANSFER_TOGGLE_COPY.offTitle)).toBeTruthy()
    fireEvent.press(screen.getByLabelText(TRANSFER_TOGGLE_COPY.offKeep))
    expect(spies.revoke).not.toHaveBeenCalled()
  })

  it('Desligar falha ⇒ confirmação fica aberta com erro', async () => {
    spies.getStatus.mockResolvedValue({ status: 'granted' })
    spies.revoke.mockResolvedValue({ ok: false })
    render(<TransferConsentCard />)
    await screen.findByText(TRANSFER_TOGGLE_COPY.on)
    await act(async () => { fireEvent(screen.getByLabelText(TRANSFER_TOGGLE_COPY.toggle), 'valueChange', false) })
    await act(async () => { fireEvent.press(screen.getByLabelText(TRANSFER_TOGGLE_COPY.offConfirm)) })
    expect(screen.getByText(TRANSFER_TOGGLE_COPY.offError)).toBeTruthy()
    expect(screen.getByText(TRANSFER_TOGGLE_COPY.offTitle)).toBeTruthy()
  })

  it('leitura falha ⇒ erro explícito, nunca "desligado"', async () => {
    spies.getStatus.mockRejectedValue(new Error('offline'))
    render(<TransferConsentCard />)
    await waitFor(() => expect(screen.getByText('Não foi possível carregar. Tentar de novo')).toBeTruthy())
    expect(screen.queryByText(TRANSFER_TOGGLE_COPY.off)).toBeNull()
  })
})
