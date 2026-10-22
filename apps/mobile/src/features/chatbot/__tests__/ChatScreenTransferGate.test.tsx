// ChatScreenTransferGate.test.tsx — chat sem a autorização B (spec 096 B3, T068 / PO-12).
// Sem B: aviso S8b, 0 contexto do paciente e 0 POST ao chatbot. Leitura falha = sem B. 403 troca o
// chat pelo aviso. "Ver a autorização" abre a autorização completa (guarda 11).

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'
import { CHAT_WITHOUT_TRANSFER_COPY as COPY, ENABLE_TRANSFER_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => {} }))
jest.mock('../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }
})
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const getStatus = jest.fn()
  const grant = jest.fn()
  return { ...actual, __spies: { getStatus, grant }, createConsentService: () => ({ getStatus, grant }) }
})
const mockRefresh = jest.fn()
jest.mock('@platform/consent/useConsentGate', () => ({ useConsentGate: () => ({ refresh: mockRefresh }) }))
const mockBuildContext = jest.fn(() => Promise.resolve('ctx'))
const mockSend = jest.fn()
jest.mock('../services/chatbotService', () => ({
  buildMobilePatientContext: () => mockBuildContext(),
  sendChatMessage: (...a) => mockSend(...a),
}))
jest.mock('../services/chatHistoryStore', () => ({
  loadHistory: () => Promise.resolve([]),
  saveHistory: jest.fn(),
  clearHistory: jest.fn(),
}))
jest.mock('@shared/utils/haptics', () => ({ lightTap: jest.fn() }))

const { __spies: spies } = jest.requireMock('@dosiq/core') as { __spies: { getStatus: jest.Mock; grant: jest.Mock } }
import ChatScreen from '../screens/ChatScreen'

const nav = { goBack: jest.fn() }

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ChatScreen — gate da autorização B', () => {
  it('sem B ⇒ aviso, 0 contexto e 0 envio', async () => {
    spies.getStatus.mockResolvedValue({ status: 'missing' })
    render(<ChatScreen navigation={nav} />)
    expect(await screen.findByText(COPY.title)).toBeTruthy()
    expect(mockBuildContext).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('leitura de B falha ⇒ sem B (fail-closed)', async () => {
    spies.getStatus.mockRejectedValue(new Error('offline'))
    render(<ChatScreen navigation={nav} />)
    expect(await screen.findByText(COPY.title)).toBeTruthy()
    expect(mockBuildContext).not.toHaveBeenCalled()
  })

  it('Fechar volta', async () => {
    spies.getStatus.mockResolvedValue({ status: 'revoked' })
    render(<ChatScreen navigation={nav} />)
    fireEvent.press(await screen.findByLabelText(COPY.close))
    expect(nav.goBack).toHaveBeenCalled()
  })

  it('"Ver a autorização" abre a frase completa da caixa B; autorizar abre o chat', async () => {
    spies.getStatus.mockResolvedValue({ status: 'missing' })
    spies.grant.mockResolvedValue({ ok: true })
    render(<ChatScreen navigation={nav} />)
    fireEvent.press(await screen.findByLabelText(COPY.enable))
    expect(screen.getByText(ENABLE_TRANSFER_COPY.title)).toBeTruthy()
    fireEvent.press(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    await act(async () => { fireEvent.press(screen.getByLabelText(ENABLE_TRANSFER_COPY.authorize)) })
    expect(spies.grant).toHaveBeenCalledWith('international_transfer', 'mobile')
    expect(mockRefresh).toHaveBeenCalled()
    await waitFor(() => expect(mockBuildContext).toHaveBeenCalled())
  })

  it('com B ⇒ conversa monta; 403 do servidor troca para o aviso', async () => {
    spies.getStatus.mockResolvedValue({ status: 'granted' })
    mockSend.mockResolvedValue({ response: '', error: true, transferRequired: true })
    render(<ChatScreen navigation={nav} />)
    await waitFor(() => expect(mockBuildContext).toHaveBeenCalled())
    const chip = await screen.findAllByLabelText(/Sugestão:/)
    await act(async () => { fireEvent.press(chip[0]) })
    expect(await screen.findByText(COPY.title)).toBeTruthy()
  })
})
