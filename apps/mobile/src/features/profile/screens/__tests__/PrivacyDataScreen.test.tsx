// PrivacyDataScreen.test.tsx — hub "Privacidade e dados" (spec 008, Adendo 2026-07-13).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { render, fireEvent, act } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import PrivacyDataScreen from '../PrivacyDataScreen'

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSetParams = jest.fn()
const mockRouteParams = { current: undefined }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setParams: mockSetParams }),
  useRoute: () => ({ params: mockRouteParams.current }),
}))

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('../../../export/components/ExportSheet', () => {
  const MockView = require('react-native').View
  return (props) => <MockView testID="export-sheet" {...props} />
})

// PrivacyConsentSection (T012) tem teste próprio — aqui é só um placeholder pra não puxar
// consentService/supabase real dentro deste suite.
jest.mock('../../components/PrivacyConsentSection', () => {
  const MockView = require('react-native').View
  return () => <MockView testID="privacy-consent-section" />
})

// A linha de Política mostra a VERSÃO PUBLICADA vigente (CURRENT_POLICY_VERSION), não mais
// "quando você aceitou" (T019b: essa info é da seção Consentimento). Fonte síncrona do core —
// requireActual garante o valor real.
import { CURRENT_POLICY_VERSION } from '@dosiq/core'

describe('PrivacyDataScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams.current = undefined
  })

  // Atalho do banner "exporte antes de excluir" (FR-009): chega no hub com o sheet JÁ aberto.
  describe('param openExport (vindo da exclusão de conta)', () => {
    it('abre o sheet na chegada', () => {
      mockRouteParams.current = { openExport: true }

      const { getByTestId } = render(<PrivacyDataScreen />)

      expect(getByTestId('export-sheet').props.visible).toBe(true)
    })

    it('consome o param — uma volta futura ao hub não reabre o sheet sozinho', () => {
      mockRouteParams.current = { openExport: true }

      render(<PrivacyDataScreen />)

      expect(mockSetParams).toHaveBeenCalledWith({ openExport: undefined })
    })

    it('sem o param, o hub abre com o sheet fechado', () => {
      const { queryByTestId } = render(<PrivacyDataScreen />)

      expect(queryByTestId('export-sheet')).toBeNull()
      expect(mockSetParams).not.toHaveBeenCalled()
    })
  })

  it('renderiza as 3 seções (Seus dados, Transparência, Zona de risco)', () => {
    const { getByText } = render(<PrivacyDataScreen />)

    expect(getByText('SEUS DADOS')).toBeTruthy()
    expect(getByText('TRANSPARÊNCIA')).toBeTruthy()
    expect(getByText('ZONA DE RISCO')).toBeTruthy()
    expect(getByText('Exportar dados')).toBeTruthy()
    expect(getByText('Política de privacidade')).toBeTruthy()
    expect(getByText('Excluir conta definitivamente')).toBeTruthy()
  })

  it('CTA "Exportar dados" abre o sheet de export', () => {
    const { getByText, getByTestId, queryByTestId } = render(<PrivacyDataScreen />)

    expect(queryByTestId('export-sheet')).toBeNull()
    fireEvent.press(getByText('Exportar dados'))

    expect(getByTestId('export-sheet').props.visible).toBe(true)
  })

  // O escopo/período é escolha DAQUELA exportação: o sheet DESMONTA ao fechar, então a próxima
  // abertura nasce no estado original (reset por remontagem, nunca por effect — AP-285).
  it('fechar o sheet desmonta (próxima abertura nasce zerada)', () => {
    const { getByText, getByTestId, queryByTestId } = render(<PrivacyDataScreen />)

    fireEvent.press(getByText('Exportar dados'))
    const sheet = getByTestId('export-sheet')

    act(() => sheet.props.onClose())

    expect(queryByTestId('export-sheet')).toBeNull()
  })

  it('linha de exclusão navega pra DELETE_ACCOUNT', () => {
    const { getByText } = render(<PrivacyDataScreen />)

    fireEvent.press(getByText('Excluir conta definitivamente'))

    expect(mockNavigate).toHaveBeenCalledWith('DeleteAccount')
  })

  it('política de privacidade abre webview', () => {
    const { getByText } = render(<PrivacyDataScreen />)

    fireEvent.press(getByText('Política de privacidade'))

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://dosiq.app/politica-de-privacidade',
    )
  })

  it('Transparência mostra a versão publicada vigente, não a data/versão do aceite', () => {
    const { getByText, queryByText } = render(<PrivacyDataScreen />)

    expect(getByText(`Versão vigente: v${CURRENT_POLICY_VERSION}`)).toBeTruthy()
    // A info de "quando você aceitou" mudou de casa (agora só na seção Consentimento).
    expect(queryByText(/Aceito em/)).toBeNull()
  })
})
