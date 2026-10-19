// 066 D2 (PO-4 · PO-10 · FR-027 · INV-6) — "Ler a caixa" no registro de compra. A caixa do mesmo remédio
// sugere quantidade, laboratório e EAN, todos editáveis; similar pergunta antes; outro remédio não
// mexe no form e abre o sheet de alerta (C-14). O remédio travado nunca muda sozinho. Compra sem leitura continua igual.

import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import PurchaseFormScreen from '../PurchaseFormScreen'

const mockCreatePurchase = jest.fn()
const mockCreateLiquidPurchase = jest.fn()
const mockGetById = jest.fn()
const mockNav = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), popTo: jest.fn() }
const mockRoute: { current: any } = { current: { params: {} } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => mockRoute.current,
}))
jest.mock('@stock/hooks/useStockMutation', () => ({
  useStockMutation: () => ({
    createPurchase: mockCreatePurchase,
    createLiquidPurchase: mockCreateLiquidPurchase,
    updatePurchase: jest.fn(),
    isLoading: false,
  }),
}))
jest.mock('@medications/services/medicineService', () => ({
  medicineService: { getById: (...args: any[]) => mockGetById(...args) },
}))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  }
})

const MED_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const EAN = '7896004703398'

// Remédio travado: genérico cadastrado sem laboratório (o laboratório de genérico é da compra).
const TRAVADO = {
  id: MED_ID,
  name: 'Amoxicilina + Clavulanato',
  active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
  dosage_per_pill: '500',
  dosage_unit: 'mg',
  presentation: 'comprimido',
  anvisa_registration: null,
  regulatory_category: 'Genérico',
  laboratory: null,
}

// Rascunho como o scanner devolve: amoxicilina+clavulanato genérico EMS, X 21.
function scanDraft(over: Record<string, unknown> = {}) {
  return {
    name: 'Amoxicilina + Clavulanato de Potassio',
    active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
    dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido',
    laboratory: null, anvisa_registration: null, regulatory_category: 'Genérico', therapeutic_class: null,
    strengthLabel: '500 mg + 125 mg', displayLaboratory: 'EMS', boxQuantity: 21,
    boxVolumeMl: null, boxUnits: null, boxContainer: null,
    doseAmbiguous: false, strengthChoices: [], isGeneric: true, ...over,
  }
}

const AMATO_EAN = '7891234567895'
const AMATO = scanDraft({ name: 'Amato', active_ingredient: 'Topiramato', strengthLabel: '25 mg', dosage_per_pill: 25 })

const BASE_PARAMS = { mode: 'create', medicineId: MED_ID, medicineName: 'Amoxicilina + Clavulanato' }

// Abre a compra, espera o remédio carregar e devolve a leitura como o popTo do scanner faz.
async function renderAndScan(draft: any, medicine: any = TRAVADO, extra: Record<string, unknown> = {}) {
  mockGetById.mockResolvedValue(medicine)
  mockRoute.current = { params: { ...BASE_PARAMS } }
  const utils = render(<PurchaseFormScreen />)
  await waitFor(() => expect(mockGetById).toHaveBeenCalled())
  await act(async () => {})
  mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: draft, scanEan: EAN, ...extra } }
  utils.rerender(<PurchaseFormScreen />)
  await act(async () => {})
  return utils
}

beforeEach(() => {
  mockRoute.current = { params: { ...BASE_PARAMS } }
  mockCreatePurchase.mockResolvedValue({})
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('"Ler a caixa" na compra (PO-4)', () => {
  it('abre o leitor devolvendo à compra', async () => {
    mockGetById.mockResolvedValue(TRAVADO)
    const { getByLabelText } = render(<PurchaseFormScreen />)
    await act(async () => {})
    fireEvent.press(getByLabelText('Ler a caixa'))
    expect(mockNav.navigate).toHaveBeenCalledWith('MedicineScan', { entryPoint: 'purchase_form', returnTo: 'PurchaseForm' })
  })

  it('mesmo remédio: sugere 21, EMS e o EAN; a pessoa corrige e vale o que ela afirmou (INV-6)', async () => {
    const { getByDisplayValue, getByText, getAllByText } = await renderAndScan(scanDraft())
    expect(getByDisplayValue('21')).toBeTruthy()
    expect(getByDisplayValue('EMS')).toBeTruthy()
    expect(getByDisplayValue(EAN)).toBeTruthy()
    expect(getByText(/Preenchido pela caixa/)).toBeTruthy()
    expect(mockCreatePurchase).not.toHaveBeenCalled()

    fireEvent.changeText(getByDisplayValue('21'), '42')
    fireEvent.changeText(getByDisplayValue('EMS'), 'Medley')
    await act(async () => {
      fireEvent.press(getAllByText('Registrar compra').at(-1))
    })
    expect(mockCreatePurchase).toHaveBeenCalledTimes(1)
    expect(mockCreatePurchase.mock.calls[0][0]).toMatchObject({
      medicine_id: MED_ID, quantity: 42, laboratory: 'Medley', ean: EAN,
    })
  })

  it('líquido: preenche laboratório e EAN, não sugere volume como contagem (R-3)', async () => {
    const xarope = { ...TRAVADO, dosage_unit: 'mg/ml', presentation: 'liquido', dosage_per_pill: '50' }
    const { getByDisplayValue, queryByDisplayValue } = await renderAndScan(
      scanDraft({ dosage_unit: 'mg/ml', dosage_per_pill: 50, presentation: 'liquido', boxQuantity: 240 }),
      xarope,
    )
    expect(getByDisplayValue('EMS')).toBeTruthy()
    expect(getByDisplayValue(EAN)).toBeTruthy()
    expect(queryByDisplayValue('240')).toBeNull()
  })

  it('injetável: sugere frascos, volume por frasco e embalagem lidos da caixa; a pessoa corrige o nº de canetas', async () => {
    const caneta = { ...TRAVADO, dosage_unit: 'mg/ml', presentation: 'injetavel', dosage_per_pill: '1.34', regulatory_category: 'Novo', laboratory: 'Novo Nordisk' }
    const { getByDisplayValue, getAllByText } = await renderAndScan(
      scanDraft({ dosage_unit: 'mg/ml', dosage_per_pill: 1.34, presentation: 'injetavel', boxQuantity: 1, boxVolumeMl: 1.5, boxUnits: 1, boxContainer: 'caneta', displayLaboratory: 'Novo Nordisk' }),
      caneta,
    )
    expect(getByDisplayValue('1,5')).toBeTruthy()
    fireEvent.changeText(getByDisplayValue('1'), '2')
    await act(async () => {
      fireEvent.press(getAllByText('Registrar compra').at(-1))
    })
    expect(mockCreateLiquidPurchase).toHaveBeenCalledTimes(1)
    expect(mockCreateLiquidPurchase.mock.calls[0][0]).toMatchObject({
      medicineId: MED_ID, numBottles: 2, volumePerBottle: 1.5, injectionContainer: 'caneta', ean: EAN,
    })
  })

  it('compra sem leitura não muda: sem ean no payload além de null (guard)', async () => {
    mockGetById.mockResolvedValue(TRAVADO)
    const { getByPlaceholderText, getAllByText } = render(<PurchaseFormScreen />)
    await act(async () => {})
    fireEvent.changeText(getByPlaceholderText('0'), '30')
    await act(async () => {
      fireEvent.press(getAllByText('Registrar compra').at(-1))
    })
    expect(mockCreatePurchase.mock.calls[0][0]).toMatchObject({ quantity: 30, ean: null, laboratory: null })
  })

  it('edição: sem "Ler a caixa" e sem campo de código', async () => {
    mockGetById.mockResolvedValue(TRAVADO)
    mockRoute.current = {
      params: { mode: 'edit', medicineId: MED_ID, purchaseId: 'p-1', purchase: { quantity_bought: 30, purchase_date: '2026-10-01' } },
    }
    const { queryByLabelText, queryByText } = render(<PurchaseFormScreen />)
    await act(async () => {})
    expect(queryByLabelText('Ler a caixa')).toBeNull()
    expect(queryByText('Código de barras')).toBeNull()
  })
})

describe('caixa de outro remédio (PO-10)', () => {
  it('outra substância: sheet de alerta com os dois nomes e nada preenchido (C-14)', async () => {
    const { getByText, queryByDisplayValue } = await renderAndScan(
      scanDraft({ name: 'Losartana Potássica', active_ingredient: 'Losartana Potássica', strengthLabel: '50 mg', dosage_per_pill: 50 }),
    )
    expect(getByText('Esta caixa é de outro remédio')).toBeTruthy()
    expect(getByText(/Você leu Losartana Potássica 50 mg, mas esta compra é de Amoxicilina \+ Clavulanato\./)).toBeTruthy()
    expect(queryByDisplayValue('21')).toBeNull()
    expect(queryByDisplayValue('EMS')).toBeNull()
    expect(queryByDisplayValue(EAN)).toBeNull()
    expect(getByText('Amoxicilina + Clavulanato')).toBeTruthy()
  })

  it('mesma substância em outra força: também é outro remédio', async () => {
    const { getByText, queryByDisplayValue } = await renderAndScan(scanDraft({ dosage_per_pill: 875, strengthLabel: '875 mg + 125 mg' }))
    expect(getByText('Esta caixa é de outro remédio')).toBeTruthy()
    expect(queryByDisplayValue('21')).toBeNull()
  })

  it('similar (cadastro antigo sem forma nem dose): pergunta; "Usar dados da caixa" preenche', async () => {
    const antigo = { ...TRAVADO, presentation: null, dosage_per_pill: null, dosage_unit: null }
    const { getByText, getByDisplayValue, queryByDisplayValue } = await renderAndScan(scanDraft(), antigo)
    expect(getByText('Parece o mesmo remédio')).toBeTruthy()
    expect(getByText(/A caixa lida é de Amoxicilina \+ Clavulanato de Potassio 500 mg \+ 125 mg\./)).toBeTruthy()
    expect(queryByDisplayValue('EMS')).toBeNull()
    fireEvent.press(getByText('Usar dados da caixa'))
    expect(getByDisplayValue('EMS')).toBeTruthy()
    expect(getByDisplayValue(EAN)).toBeTruthy()
    expect(getByDisplayValue('21')).toBeTruthy()
  })

  it('similar: "Não usar" deixa tudo intacto', async () => {
    const antigo = { ...TRAVADO, presentation: null, dosage_per_pill: null, dosage_unit: null }
    const { getByText, queryByText, queryByDisplayValue } = await renderAndScan(scanDraft(), antigo)
    fireEvent.press(getByText('Não usar'))
    expect(mockNav.goBack).not.toHaveBeenCalled()
    expect(queryByText('Parece o mesmo remédio')).toBeNull()
    expect(queryByDisplayValue('EMS')).toBeNull()
    expect(queryByDisplayValue(EAN)).toBeNull()
  })

  it('similar já escolhido no "Qual destes?" da aba Estoque (scanConfirmed): preenche sem perguntar de novo', async () => {
    const antigo = { ...TRAVADO, presentation: null, dosage_per_pill: null, dosage_unit: null }
    const { queryByText, getByDisplayValue } = await renderAndScan(scanDraft(), antigo, { scanConfirmed: true })
    expect(queryByText('Parece o mesmo remédio')).toBeNull()
    expect(getByDisplayValue('EMS')).toBeTruthy()
    expect(getByDisplayValue(EAN)).toBeTruthy()
  })

  it('scanConfirmed não transforma outro remédio em preenchimento', async () => {
    const { getByText, queryByDisplayValue } = await renderAndScan(scanDraft({ dosage_per_pill: 875, strengthLabel: '875 mg' }), TRAVADO, { scanConfirmed: true })
    expect(getByText('Esta caixa é de outro remédio')).toBeTruthy()
    expect(queryByDisplayValue('EMS')).toBeNull()
  })

  it('2ª leitura idêntica substitui a 1ª (smoke 1.6, C-12)', async () => {
    const utils = await renderAndScan(scanDraft())
    expect(utils.getByDisplayValue('EMS')).toBeTruthy()
    mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: scanDraft({ displayLaboratory: 'Medley', boxQuantity: 14 }), scanEan: '7891234567895' } }
    utils.rerender(<PurchaseFormScreen />)
    await act(async () => {})
    expect(utils.getByDisplayValue('Medley')).toBeTruthy()
    expect(utils.getByDisplayValue('14')).toBeTruthy()
  })

  // C-14 (smoke 2026-10-18): antes a 2ª leitura de outro remédio zerava o form com um aviso que não
  // parecia alerta; a pessoa achava que a troca de caixa não funcionava.
  it('2ª leitura de outro remédio não mexe no que a 1ª preencheu e abre o sheet (C-14)', async () => {
    const utils = await renderAndScan(scanDraft())
    mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: AMATO, scanEan: AMATO_EAN } }
    utils.rerender(<PurchaseFormScreen />)
    await act(async () => {})
    expect(utils.getByText('Esta caixa é de outro remédio')).toBeTruthy()
    expect(utils.getByDisplayValue('EMS')).toBeTruthy()
    expect(utils.getByDisplayValue('21')).toBeTruthy()
    expect(utils.getByDisplayValue(EAN)).toBeTruthy()
  })

  it('"Continuar com" fecha o sheet e mantém a compra como estava (C-14)', async () => {
    const utils = await renderAndScan(scanDraft())
    mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: AMATO, scanEan: AMATO_EAN } }
    utils.rerender(<PurchaseFormScreen />)
    await act(async () => {})
    fireEvent.press(utils.getByText('Continuar com Amoxicilina + Clavulanato'))
    expect(utils.queryByText('Esta caixa é de outro remédio')).toBeNull()
    expect(utils.getByDisplayValue('EMS')).toBeTruthy()
    expect(mockNav.popTo).not.toHaveBeenCalled()
  })

  it('"Registrar compra de" devolve a caixa lida à aba Estoque, sem gravar nada (C-14)', async () => {
    const utils = await renderAndScan(scanDraft())
    mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: AMATO, scanEan: AMATO_EAN } }
    utils.rerender(<PurchaseFormScreen />)
    await act(async () => {})
    fireEvent.press(utils.getByText('Registrar compra de Amato 25 mg'))
    expect(mockNav.popTo).toHaveBeenCalledWith('StockMain', { scanDraft: AMATO, scanEan: AMATO_EAN }, { merge: true })
    expect(mockCreatePurchase).not.toHaveBeenCalled()
  })

  it('o que a pessoa editou não é tocado por leitura de outro remédio (INV-6)', async () => {
    const utils = await renderAndScan(scanDraft())
    fireEvent.changeText(utils.getByDisplayValue('21'), '42')
    mockRoute.current = { params: { ...BASE_PARAMS, scanDraft: AMATO, scanEan: AMATO_EAN } }
    utils.rerender(<PurchaseFormScreen />)
    await act(async () => {})
    fireEvent.press(utils.getByText('Continuar com Amoxicilina + Clavulanato'))
    expect(utils.getByDisplayValue('42')).toBeTruthy()
    expect(utils.getByDisplayValue('EMS')).toBeTruthy()
  })
})
