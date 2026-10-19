// 066 D2 (PO-13 · FR-030) — "Ler a caixa" na aba Estoque: a compra começa pela caixa. Um idêntico abre a
// compra preenchida; vários perguntam "Qual destes?"; nenhum oferece cadastrar com os dados da caixa ou
// cancelar. Nada é gravado aqui.

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import StockScreen from '../StockScreen'

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }
const mockRoute: { current: any } = { current: { params: {} } }
const mockRefresh = jest.fn(() => Promise.resolve())
const mockMedicines: { current: any } = { current: { data: [], loading: false, refresh: mockRefresh } }
const mockCrossTab = jest.fn()
const mockPurchaseSheet = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => mockRoute.current,
  useFocusEffect: () => {},
}))
jest.mock('@stock/hooks/useStock', () => ({
  useStock: () => ({ data: { active: [], inactive: [] }, loading: false, error: null, stale: false, refreshing: false, refresh: jest.fn() }),
}))
jest.mock('@medications/hooks/useMedicines', () => ({ useMedicines: () => mockMedicines.current }))
jest.mock('@navigation/navigateCrossTab', () => ({ navigateCrossTab: (...a: any[]) => mockCrossTab(...a) }))
jest.mock('@shared/components/ui/ScreenContainer', () => ({ children }) => <>{children}</>)
jest.mock('@features/chatbot/components/ChatEntryButton', () => () => null)
jest.mock('@stock/components/PurchaseMedicineSheet', () => (props: any) => {
  mockPurchaseSheet(props)
  return null
})
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }
})

function scanDraft(over: Record<string, unknown> = {}) {
  return {
    name: 'Amoxicilina + Clavulanato de Potassio', active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
    dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido', laboratory: null, anvisa_registration: null,
    regulatory_category: 'Genérico', therapeutic_class: null, strengthLabel: '500 mg + 125 mg', displayLaboratory: 'EMS',
    boxQuantity: 21, doseAmbiguous: false, strengthChoices: [], isGeneric: true, ...over,
  }
}

const AMOX = {
  id: 'm1', name: 'Amoxicilina + Clavulanato', active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
  dosage_per_pill: '500', dosage_unit: 'mg', presentation: 'comprimido', anvisa_registration: null,
}
const AMOX_ANTIGO = { ...AMOX, id: 'm2', name: 'Amoxicilina', presentation: null, dosage_per_pill: null, dosage_unit: null }
const LOSARTANA = { ...AMOX, id: 'm3', name: 'Losartana', active_ingredient: 'Losartana Potássica', dosage_per_pill: '50' }
const EAN = '7896004703398'

function renderWithScan(medicines: any[], draft = scanDraft()) {
  mockMedicines.current = { data: medicines, loading: false, refresh: mockRefresh }
  mockRoute.current = { params: { scanDraft: draft, scanEan: EAN } }
  return render(<StockScreen />)
}

const lastSheetProps = () => mockPurchaseSheet.mock.calls.at(-1)?.[0]

beforeEach(() => {
  mockRoute.current = { params: {} }
  mockMedicines.current = { data: [], loading: false, refresh: mockRefresh }
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('"Ler a caixa" na aba Estoque (PO-13)', () => {
  it('a pill abre o leitor devolvendo à aba Estoque', () => {
    const { getByLabelText } = render(<StockScreen />)
    fireEvent.press(getByLabelText('Ler a caixa'))
    expect(mockNav.navigate).toHaveBeenCalledWith('MedicineScan', { entryPoint: 'stock_list', returnTo: 'StockMain' })
  })

  it('um idêntico: abre a compra travada nele, com a leitura (sem sheet)', async () => {
    const { queryByText } = renderWithScan([LOSARTANA, AMOX])
    await act(async () => {})
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.objectContaining({
      mode: 'create', medicineId: 'm1', medicineName: 'Amoxicilina + Clavulanato', scanEan: EAN,
    }))
    expect(mockNav.navigate.mock.calls[0][1].scanDraft).toMatchObject({ boxQuantity: 21 })
    expect(queryByText('Qual destes?')).toBeNull()
  })

  it('vários: "Qual destes?" exige escolher; a escolha abre a compra como confirmada', async () => {
    const { getByText, getByLabelText } = renderWithScan([AMOX, { ...AMOX, id: 'm4', name: 'Amoxicilina EMS' }])
    await act(async () => {})
    expect(getByText('Qual destes?')).toBeTruthy()
    fireEvent.press(getByText('Registrar compra'))
    expect(mockNav.navigate).not.toHaveBeenCalled()
    fireEvent.press(getByLabelText(/Amoxicilina EMS 500 mg, idêntico/))
    fireEvent.press(getByText('Registrar compra'))
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.objectContaining({ medicineId: 'm4', scanConfirmed: true, scanEan: EAN }))
  })

  // C-16: um similar só abre a compra SEM scanConfirmed — o cartão da compra pergunta antes de preencher.
  // C-17 (smoke Android): remédio cadastrado com a aba já montada não estava na lista velha.
  it('recarrega a lista do banco antes de resolver a leitura (C-17)', async () => {
    mockRefresh.mockImplementationOnce(async () => {
      mockMedicines.current = { data: [AMOX], loading: false, refresh: mockRefresh }
    })
    const { queryByText } = renderWithScan([])
    await act(async () => {})
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(queryByText('Este remédio ainda não está cadastrado')).toBeNull()
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.objectContaining({ medicineId: AMOX.id }))
  })

  it('um similar só: abre a compra sem confirmação (a compra pergunta)', async () => {
    renderWithScan([AMOX_ANTIGO])
    await act(async () => {})
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.not.objectContaining({ scanConfirmed: true }))
  })

  it('nenhum: "Cadastrar com os dados da caixa" abre o cadastro preenchido', async () => {
    const { getByText } = renderWithScan([LOSARTANA])
    await act(async () => {})
    expect(getByText('Este remédio ainda não está cadastrado')).toBeTruthy()
    fireEvent.press(getByText('Cadastrar com os dados da caixa'))
    expect(mockCrossTab).toHaveBeenCalledWith('Tratamentos', 'MedicineCreate', { scanDraft: expect.objectContaining({ boxQuantity: 21 }) })
    expect(mockNav.navigate).not.toHaveBeenCalled()
  })

  it('nenhum: "Cancelar" fecha sem navegar', async () => {
    const { getByText, queryByText } = renderWithScan([])
    await act(async () => {})
    fireEvent.press(getByText('Cancelar'))
    expect(queryByText('Este remédio ainda não está cadastrado')).toBeNull()
    expect(mockCrossTab).not.toHaveBeenCalled()
    expect(mockNav.navigate).not.toHaveBeenCalled()
  })

  it('lista de remédios ainda carregando: espera, não conclui "não cadastrado"', async () => {
    mockMedicines.current = { data: null, loading: true, refresh: mockRefresh }
    mockRoute.current = { params: { scanDraft: scanDraft(), scanEan: EAN } }
    const { queryByText, rerender } = render(<StockScreen />)
    await act(async () => {})
    expect(queryByText('Este remédio ainda não está cadastrado')).toBeNull()
    mockMedicines.current = { data: [AMOX], loading: false, refresh: mockRefresh }
    rerender(<StockScreen />)
    await act(async () => {})
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.objectContaining({ medicineId: 'm1' }))
  })

  it('"digitar" no leitor abre o seletor do FAB', async () => {
    render(<StockScreen />)
    expect(lastSheetProps().visible).toBe(false)
    mockRoute.current = { params: { manualEntry: 123 } }
    const { rerender } = render(<StockScreen />)
    rerender(<StockScreen />)
    expect(lastSheetProps().visible).toBe(true)
  })

  it('FAB "Registrar compra" continua abrindo o seletor (guard)', () => {
    const { getByLabelText } = render(<StockScreen />)
    fireEvent.press(getByLabelText('Registrar compra'))
    expect(lastSheetProps().visible).toBe(true)
  })

  it('"Qual destes?" mostra o laboratório da marca, não o do genérico, e nunca a categoria', async () => {
    const marca = { ...AMOX, id: 'm5', name: 'Clavulin', laboratory: 'GSK', regulatory_category: 'Novo' }
    const generico = { ...AMOX, id: 'm6', laboratory: 'EMS', regulatory_category: 'Genérico' }
    // Dois genéricos idênticos ⇒ "Qual destes?"; a marca (outra marca, C-16) entra como parecido.
    const { getByText, queryByText } = renderWithScan([marca, generico, { ...generico, id: 'm8' }])
    await act(async () => {})
    expect(getByText('GSK')).toBeTruthy()
    expect(queryByText('EMS')).toBeNull()
    expect(queryByText(/Novo|Genérico/)).toBeNull()
  })

  it('cadastro à mão sem princípio ativo, mesma dose: abre a compra dele (que pergunta) em vez de oferecer cadastro duplicado', async () => {
    const manual = { ...AMOX, id: 'm7', name: 'Amoxicilina', active_ingredient: null }
    const { queryByText } = renderWithScan([manual])
    await act(async () => {})
    expect(queryByText('Este remédio ainda não está cadastrado')).toBeNull()
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.objectContaining({ medicineId: 'm7' }))
    expect(mockNav.navigate).toHaveBeenCalledWith('PurchaseForm', expect.not.objectContaining({ scanConfirmed: true }))
  })
})
