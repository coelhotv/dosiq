// ChatWindowTransferGate.test.tsx — chat sem B no web (spec 096 S8b, PO-12/PO-UX-1).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { getStatusMock, grantMock, sendChatMessageMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  grantMock: vi.fn().mockResolvedValue({ ok: true }),
  sendChatMessageMock: vi.fn(),
}))
vi.mock('@shared/utils/supabase', () => ({ supabase: {} }))
vi.mock('@dosiq/core', async () => {
  const actual = await vi.importActual<typeof import('@dosiq/core')>('@dosiq/core')
  return { ...actual, createConsentService: () => ({ getStatus: getStatusMock, grant: grantMock }) }
})
vi.mock('@/features/chatbot/services/chatbotService', () => ({
  sendChatMessage: sendChatMessageMock,
  loadPersistedHistory: () => [],
  savePersistedHistory: vi.fn(),
  clearPersistedHistory: vi.fn(),
}))
vi.mock('@dashboard/hooks/useDashboardContext', () => ({
  useDashboard: () => ({ medicines: [], protocols: [], logs: [], stockSummary: [], stats: {}, doseInstances: [], stockTrackingEnabled: true }),
}))
vi.mock('../ChatWindowDrawer', () => ({
  default: ({ onSend }: { onSend: (m: string) => void }) => (
    <div data-testid="chat-drawer">
      <button type="button" onClick={() => onSend('oi')}>enviar</button>
    </div>
  ),
}))

import { CHAT_WITHOUT_TRANSFER_COPY } from '@dosiq/core'
import ChatWindow from '../ChatWindow'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const granted = { status: 'granted', policyVersion: '0.4', updatedAt: '2026-10-21T10:00:00-03:00', stale: false }
const missing = { status: 'missing', policyVersion: null, updatedAt: null, stale: false }

describe('ChatWindow — modo sem B', () => {
  it('sem B: mostra o aviso S8b, não o chat, e não chama a API', async () => {
    getStatusMock.mockResolvedValue(missing)
    render(<ChatWindow isOpen onClose={vi.fn()} />)
    expect(await screen.findByText(CHAT_WITHOUT_TRANSFER_COPY.title)).toBeInTheDocument()
    expect(screen.queryByTestId('chat-drawer')).not.toBeInTheDocument()
    expect(sendChatMessageMock).not.toHaveBeenCalled()
  })

  it('leitura do consentimento falha ⇒ trata como sem B (fail-closed)', async () => {
    getStatusMock.mockRejectedValue(new Error('rede'))
    render(<ChatWindow isOpen onClose={vi.fn()} />)
    expect(await screen.findByText(CHAT_WITHOUT_TRANSFER_COPY.title)).toBeInTheDocument()
    expect(screen.queryByTestId('chat-drawer')).not.toBeInTheDocument()
  })

  it('com B: abre o chat', async () => {
    getStatusMock.mockResolvedValue(granted)
    render(<ChatWindow isOpen onClose={vi.fn()} />)
    expect(await screen.findByTestId('chat-drawer')).toBeInTheDocument()
    expect(screen.queryByText(CHAT_WITHOUT_TRANSFER_COPY.title)).not.toBeInTheDocument()
  })

  it('"Fechar" fecha sem abrir o chat', async () => {
    getStatusMock.mockResolvedValue(missing)
    const onClose = vi.fn()
    render(<ChatWindow isOpen onClose={onClose} />)
    fireEvent.click(await screen.findByText(CHAT_WITHOUT_TRANSFER_COPY.close))
    expect(onClose).toHaveBeenCalled()
  })

  it('"Ver a autorização" abre a autorização completa da caixa B (guarda 11)', async () => {
    getStatusMock.mockResolvedValue(missing)
    render(<ChatWindow isOpen onClose={vi.fn()} />)
    fireEvent.click(await screen.findByText(CHAT_WITHOUT_TRANSFER_COPY.enable))
    expect(await screen.findByRole('dialog', { name: 'Ligar o processamento fora do Brasil' })).toBeInTheDocument()
  })

  it('403 transfer_consent_required no envio troca o chat pelo aviso', async () => {
    getStatusMock.mockResolvedValue(granted)
    sendChatMessageMock.mockResolvedValue({ response: '', error: true, transferRequired: true })
    render(<ChatWindow isOpen onClose={vi.fn()} />)
    fireEvent.click(await screen.findByText('enviar'))
    await waitFor(() => expect(screen.getByText(CHAT_WITHOUT_TRANSFER_COPY.title)).toBeInTheDocument())
    // o drawer sai pelo AnimatePresence (animação de saída) — sob carga ainda está montado no 1º frame
    await waitFor(() => expect(screen.queryByTestId('chat-drawer')).not.toBeInTheDocument())
  })
})
