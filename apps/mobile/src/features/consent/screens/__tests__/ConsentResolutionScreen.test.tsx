// ConsentResolutionScreen.test.tsx — tela travada de resolução (spec 046, T010/T007).
//
// Foco: anti-deadlock (R2/F8) — export/excluir/reconsentir SEMPRE presentes. Dois contratos que
// mudaram no smoke:
//  - export abre o sheet INLINE (fechar volta pra cá, não pro hub);
//  - "voltar a consentir" NÃO concede num clique — mostra a tela de opt-in (checkbox informado,
//    art. 11): reativar com um toque seria consentimento presumido.
import { render, fireEvent, screen } from '@testing-library/react-native'

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

const mockGateRefresh = jest.fn()
jest.mock('@platform/consent/useConsentGate', () => ({
  useConsentGate: () => ({ refresh: mockGateRefresh }),
}))

// Sheet e prompt são mockados por marcadores — o foco aqui é o roteamento da tela, não o conteúdo
// deles (que têm testes próprios).
jest.mock('@features/export/components/ExportSheet', () => {
  const { Text } = jest.requireActual('react-native')
  return { __esModule: true, default: () => <Text>EXPORT_SHEET</Text> }
})
jest.mock('@features/consent/components/ConsentPrompt', () => {
  const { Text } = jest.requireActual('react-native')
  return { __esModule: true, default: () => <Text>CONSENT_PROMPT</Text> }
})

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  const grantSpy = jest.fn()
  return { ...actual, __grantSpy: grantSpy, createConsentService: () => ({ grant: grantSpy }) }
})

const { __grantSpy: mockGrant } = jest.requireMock('@dosiq/core') as { __grantSpy: jest.Mock }
import ConsentResolutionScreen from '../ConsentResolutionScreen'

describe('ConsentResolutionScreen', () => {
  beforeEach(() => {
    mockGrant.mockReset()
    mockGrant.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('expõe as 3 saídas anti-deadlock', () => {
    render(<ConsentResolutionScreen />)

    expect(screen.getByLabelText('Exportar meus dados')).toBeTruthy()
    expect(screen.getByLabelText('Excluir minha conta')).toBeTruthy()
    expect(screen.getByLabelText('Voltar a consentir')).toBeTruthy()
  })

  it('exportar abre o sheet INLINE (não navega pro hub — fechar volta pra resolução)', () => {
    render(<ConsentResolutionScreen />)

    fireEvent.press(screen.getByLabelText('Exportar meus dados'))

    expect(screen.getByText('EXPORT_SHEET')).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('excluir navega para DeleteAccount', () => {
    render(<ConsentResolutionScreen />)

    fireEvent.press(screen.getByLabelText('Excluir minha conta'))

    expect(mockNavigate).toHaveBeenCalledWith('DeleteAccount')
  })

  it('🔴 "voltar a consentir" mostra a tela de opt-in (checkbox) — NÃO concede num clique', () => {
    render(<ConsentResolutionScreen />)

    fireEvent.press(screen.getByLabelText('Voltar a consentir'))

    // Mostra o ConsentPrompt (consentimento informado), sem chamar grant direto do botão.
    expect(screen.getByText('CONSENT_PROMPT')).toBeTruthy()
    expect(mockGrant).not.toHaveBeenCalled()
  })
})
