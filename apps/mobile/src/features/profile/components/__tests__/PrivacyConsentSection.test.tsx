// PrivacyConsentSection.test.tsx — card "Consentimento" no hub (spec 046, T012/T007).
//
// getStatus() que LANÇA vira estado de ERRO explícito, nunca "Não informado" — mesmo cuidado
// do Slice A (AP-290): confundir os dois abriria caminho pra tratar rede instável como titular
// que nunca se manifestou.
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  // useFocusEffect roda o callback na montagem (equivalente a useEffect no teste).
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(cb, [cb])
  },
}))

// Mocks auto-contidos (spies nascem dentro da factory) — evita ambiguidade de hoisting do
// babel-plugin-jest-hoist com referência a variável externa.
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const getStatusSpy = jest.fn()
  const revokeSpy = jest.fn()
  return {
    ...actual,
    __getStatusSpy: getStatusSpy,
    __revokeSpy: revokeSpy,
    createConsentService: () => ({ getStatus: getStatusSpy, revoke: revokeSpy }),
  }
})

const { __getStatusSpy: mockGetStatus, __revokeSpy: mockRevoke } = jest.requireMock('@dosiq/core') as {
  __getStatusSpy: jest.Mock
  __revokeSpy: jest.Mock
}

// O card reavalia o GUARD RAIZ (gate compartilhado) após revogar — sem isto o app não travaria.
const mockGateRefresh = jest.fn()
jest.mock('@platform/consent/useConsentGate', () => ({
  useConsentGate: () => ({ refresh: mockGateRefresh }),
}))

import PrivacyConsentSection from '../PrivacyConsentSection'

describe('PrivacyConsentSection', () => {
  beforeEach(() => {
    mockGetStatus.mockReset()
    mockRevoke.mockReset()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('mostra "Ativo" + data/versão quando granted', async () => {
    mockGetStatus.mockResolvedValue({
      status: 'granted',
      policyVersion: '0.3',
      updatedAt: '2026-07-01T12:00:00-03:00',
      stale: false,
    })

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Ativo')).toBeTruthy()
    expect(screen.getByText(/Aceito em 01\/07\/2026 · v0\.3/)).toBeTruthy()
  })

  it('mostra "Retirado" sem botão de revogar', async () => {
    mockGetStatus.mockResolvedValue({
      status: 'revoked',
      policyVersion: '0.3',
      updatedAt: '2026-07-05T09:00:00-03:00',
      stale: false,
    })

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Retirado')).toBeTruthy()
    expect(screen.queryByText('Retirar consentimento')).toBeNull()
  })

  it('estado "missing" oferece "Autorizar agora" que NAVEGA para a tela de opt-in (não concede direto)', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })

    render(<PrivacyConsentSection />)
    const botao = await screen.findByLabelText('Autorizar tratamento de dados de saúde')

    fireEvent.press(botao)

    // Navega para a tela completa (consentimento informado, art. 11) — não chama grant aqui.
    expect(mockNavigate).toHaveBeenCalledWith('ConsentPrompt')
  })

  it('getStatus que LANÇA vira erro explícito — NUNCA "Não informado"', async () => {
    mockGetStatus.mockRejectedValue(new Error('Falha ao ler a trilha de consentimento'))

    render(<PrivacyConsentSection />)

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy()
    expect(screen.queryByText('Não informado')).toBeNull()
  })

  it('revogar exige duas etapas antes de chamar consentService.revoke', async () => {
    mockGetStatus.mockResolvedValue({
      status: 'granted',
      policyVersion: '0.3',
      updatedAt: '2026-07-01T12:00:00-03:00',
      stale: false,
    })
    mockRevoke.mockResolvedValue({ ok: true })

    render(<PrivacyConsentSection />)
    await screen.findByText('Ativo')

    fireEvent.press(screen.getByLabelText('Retirar consentimento'))
    expect(mockRevoke).not.toHaveBeenCalled()

    fireEvent.press(screen.getByLabelText('Continuar retirada'))
    expect(mockRevoke).not.toHaveBeenCalled()

    fireEvent.press(screen.getByLabelText('Confirmar retirada de consentimento'))
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('health_data', 'mobile'))
  })

  it('🔴 revogar reavalia o GUARD RAIZ na hora — senão o app seguiria navegável (bug do smoke)', async () => {
    mockGetStatus.mockResolvedValue({ status: 'granted', policyVersion: '0.3', updatedAt: '2026-07-01T12:00:00-03:00', stale: false })
    mockRevoke.mockResolvedValue({ ok: true })

    render(<PrivacyConsentSection />)
    await screen.findByText('Ativo')

    fireEvent.press(screen.getByLabelText('Retirar consentimento'))
    fireEvent.press(screen.getByLabelText('Continuar retirada'))
    fireEvent.press(screen.getByLabelText('Confirmar retirada de consentimento'))

    await waitFor(() => expect(mockGateRefresh).toHaveBeenCalled())
  })
})
