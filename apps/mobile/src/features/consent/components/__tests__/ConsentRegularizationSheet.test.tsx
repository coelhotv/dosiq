// ConsentRegularizationSheet.test.tsx — reconsentimento v0.4 bloqueante (spec 096 `dq1a`, T027m).
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const getStatusSpy = jest.fn()
  return { ...actual, __getStatusSpy: getStatusSpy, createConsentService: () => ({ getStatus: getStatusSpy }) }
})

const mockGrantV04 = jest.fn()
jest.mock('@platform/consent/useConsentGate', () => ({ useConsentGate: () => ({ grantV04: mockGrantV04 }) }))

const { __getStatusSpy: mockGetStatus } = jest.requireMock('@dosiq/core') as { __getStatusSpy: jest.Mock }
import { REGULARIZATION_V04_COPY as COPY, HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import ConsentRegularizationSheet from '../ConsentRegularizationSheet'

function renderSheet(props = {}) {
  const onConfirmed = jest.fn()
  const onDecline = jest.fn()
  render(<ConsentRegularizationSheet visible onConfirmed={onConfirmed} onDecline={onDecline} {...props} />)
  return { onConfirmed, onDecline }
}

describe('ConsentRegularizationSheet (v0.4)', () => {
  beforeEach(() => {
    mockGrantV04.mockResolvedValue({ ok: true, transferOk: true })
    mockGetStatus.mockResolvedValue({ status: 'missing', stale: false })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('não renderiza com visible=false', () => {
    render(<ConsentRegularizationSheet visible={false} onConfirmed={jest.fn()} onDecline={jest.fn()} />)
    expect(screen.queryByText(COPY.title)).toBeNull()
  })

  it('título DQ-5 A, corpo, A e B desmarcadas e rodapé dos termos; sem "Agora não" nem leitura forçada', () => {
    renderSheet()
    expect(screen.getByText(COPY.title)).toBeTruthy()
    expect(screen.getByText(COPY.termsFooter)).toBeTruthy()
    expect(screen.getByLabelText(HEALTH_CONSENT_COPY.label).props.accessibilityState.checked).toBe(false)
    expect(screen.getByLabelText(TRANSFER_CONSENT_COPY.label).props.accessibilityState.checked).toBe(false)
    expect(screen.queryByText('Agora não')).toBeNull()
    expect(screen.queryByText('Ler a nova política')).toBeNull()
  })

  it('Confirmar sem A ⇒ erro em alerta, nada gravado', () => {
    renderSheet()
    fireEvent.press(screen.getByLabelText(COPY.confirm))
    expect(screen.getByText(COPY.errorNoHealth)).toBeTruthy()
    expect(mockGrantV04).not.toHaveBeenCalled()
  })

  it('A só ⇒ grantV04 sem B (B nunca é condição)', async () => {
    const { onConfirmed } = renderSheet()
    fireEvent.press(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.press(screen.getByLabelText(COPY.confirm))
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled())
    expect(mockGrantV04).toHaveBeenCalledWith({ transfer: false })
  })

  it('A + B ⇒ grantV04 com B', async () => {
    renderSheet()
    fireEvent.press(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.press(screen.getByLabelText(TRANSFER_CONSENT_COPY.label))
    fireEvent.press(screen.getByLabelText(COPY.confirm))
    await waitFor(() => expect(mockGrantV04).toHaveBeenCalledWith({ transfer: true }))
  })

  it('falha ⇒ mensagem e não fecha', async () => {
    mockGrantV04.mockResolvedValue({ ok: false, transferOk: false })
    const { onConfirmed } = renderSheet()
    fireEvent.press(screen.getByLabelText(HEALTH_CONSENT_COPY.label))
    fireEvent.press(screen.getByLabelText(COPY.confirm))
    expect(await screen.findByText('Não foi possível registrar agora. Tente de novo.')).toBeTruthy()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('Não concordo ⇒ onDecline', () => {
    const { onDecline } = renderSheet()
    fireEvent.press(screen.getByLabelText(COPY.decline))
    expect(onDecline).toHaveBeenCalled()
  })

  it('"O que mudou ›" abre a lista', () => {
    renderSheet()
    expect(screen.queryByText(`• ${COPY.changed[0]}`)).toBeNull()
    fireEvent.press(screen.getByText(COPY.changedLink))
    expect(screen.getByText(`• ${COPY.changed[0]}`)).toBeTruthy()
  })

  it('B já vigente ⇒ caixa B some', async () => {
    mockGetStatus.mockResolvedValue({ status: 'granted', stale: false })
    renderSheet()
    expect(await screen.findByText(COPY.transferAlreadyOn)).toBeTruthy()
    expect(screen.queryByLabelText(TRANSFER_CONSENT_COPY.label)).toBeNull()
  })
})
