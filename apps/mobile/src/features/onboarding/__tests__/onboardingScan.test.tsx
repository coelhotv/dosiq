// 066 Slice E (US7 · PO-12 · FR-029 · INV-1/INV-2) — "Seu primeiro remédio" do onboarding em 3 telas:
// Escolha (caixa | busca) → Busca 2C em tela cheia → "Confira" (form; em branco é o fallback). O leitor e
// a busca devolvem o rascunho ao "Confira", o composto ambíguo pergunta a dose e NADA é gravado antes do
// passo de estoque (só o contexto do wizard).

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import OnboardingMedicineStep from '../screens/OnboardingMedicineStep'
import OnboardingMedicineChoiceStep from '../screens/OnboardingMedicineChoiceStep'
import OnboardingMedicineSearchStep from '../screens/OnboardingMedicineSearchStep'
import { OnboardingContext } from '../OnboardingContext'

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), addListener: jest.fn(() => () => {}) }
const mockRoute: { current: any } = { current: { params: {} } }
const mockShow = jest.fn()
const mockMedicineCreate = jest.fn()
const mockLogEvent = jest.fn()
// Fluxo da busca 2C (testado no sheet): aqui só o contrato com a tela — resultados e `onSelect`.
const mockFlow: { current: any } = { current: null }
const mockFlowOptions: { current: any } = { current: null }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => mockRoute.current,
}))
jest.mock('@medications/hooks/useMedicineSearchFlow', () => ({
  useMedicineSearchFlow: (options) => {
    mockFlowOptions.current = options
    return mockFlow.current
  },
}))
jest.mock('@medications/services/medicineService', () => ({
  medicineService: { create: (...args: any[]) => mockMedicineCreate(...args) },
}))
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  }
})

// Rascunho como o leitor/busca devolvem (medicineDraftFromRow): losartana de marca, 50 mg.
function draft(over: Record<string, unknown> = {}) {
  return {
    name: 'Losartana Potássica',
    active_ingredient: 'Losartana Potássica',
    dosage_per_pill: 50,
    dosage_unit: 'mg',
    presentation: 'comprimido',
    laboratory: 'Lab X',
    anvisa_registration: '123456789',
    regulatory_category: 'Similar',
    therapeutic_class: 'Anti-hipertensivos',
    strengthLabel: '50 mg',
    displayLaboratory: 'Lab X',
    boxQuantity: 30,
    doseAmbiguous: false,
    strengthChoices: [],
    isGeneric: false,
    ...over,
  }
}

const AMBIGUOUS = {
  name: 'Amoxicilina + Clavulanato de Potassio',
  active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
  dosage_per_pill: null,
  dosage_unit: null,
  strengthLabel: '500 mg + 125 mg',
  doseAmbiguous: true,
  strengthChoices: [
    { dose: 500, unit: 'mg' },
    { dose: 125, unit: 'mg' },
  ],
  laboratory: null,
  anvisa_registration: null,
  regulatory_category: 'Genérico',
  isGeneric: true,
}

const PALLIATIVE = 'Copie o número escrito na embalagem ou na receita.'

function flow(over: Record<string, unknown> = {}) {
  return {
    query: 'Nimes',
    setQuery: jest.fn(),
    trimmed: 'Nimes',
    results: [{ id: 1, name: 'Nimesulida', activeIngredient: 'Nimesulida' }],
    hint: '1 resultado',
    picked: null,
    presentationStep: null,
    presentationKey: 'ready',
    handleSelect: jest.fn(),
    handleBack: jest.fn(),
    reset: jest.fn(),
    ...over,
  }
}

function withCtx(node) {
  const ctx = {
    medicine: null,
    setMedicine: jest.fn(),
    setMedicineSource: jest.fn(),
    skip: jest.fn(),
    treatment: null,
    setTreatment: jest.fn(),
  }
  return { ui: <OnboardingContext.Provider value={ctx as any}>{node}</OnboardingContext.Provider>, ctx }
}

function renderStep(params: Record<string, unknown> = {}) {
  mockRoute.current = { params }
  const { ui, ctx } = withCtx(<OnboardingMedicineStep />)
  return { ...render(ui), ctx }
}

beforeEach(() => {
  mockRoute.current = { params: {} }
  mockFlow.current = flow()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('Escolha (US7 cen. 1 · FR-029)', () => {
  it('a caixa é a ação principal, a busca vem abaixo e o "Pular" fica', () => {
    const r = render(withCtx(<OnboardingMedicineChoiceStep />).ui)
    expect(r.getByText('Ler o código de barras')).toBeTruthy()
    expect(r.getByText('Buscar pelo nome')).toBeTruthy()
    expect(r.getByText('Pular')).toBeTruthy()
  })

  it('o leitor abre no stack do wizard e devolve ao "Confira"', () => {
    const r = render(withCtx(<OnboardingMedicineChoiceStep />).ui)
    fireEvent.press(r.getByLabelText('Ler o código de barras da caixa'))
    expect(mockNav.navigate).toHaveBeenCalledWith('MedicineScan', {
      entryPoint: 'onboarding',
      returnTo: 'OnboardingMedicineForm',
    })
  })

  it('"Buscar pelo nome" abre a busca em tela cheia', () => {
    const r = render(withCtx(<OnboardingMedicineChoiceStep />).ui)
    fireEvent.press(r.getByLabelText('Buscar pelo nome'))
    expect(mockNav.navigate).toHaveBeenCalledWith('OnboardingMedicineSearch')
  })
})

describe('Busca 2C em tela cheia (US7 cen. 5)', () => {
  it('lista inline, marca o ponto de toque e a escolha vai ao "Confira"', () => {
    const r = render(withCtx(<OnboardingMedicineSearchStep />).ui)
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_search_opened', { surface: 'mobile', entry_point: 'onboarding' })
    fireEvent.press(r.getByLabelText('Nimesulida'))
    expect(mockFlow.current.handleSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nimesulida' }), 0)

    const selection = { anvisaItem: { name: 'Nimesulida' }, cmedDraft: draft({ name: 'Nimesulida' }) }
    act(() => mockFlowOptions.current.onSelect(selection))
    expect(mockNav.popTo).toHaveBeenCalledWith('OnboardingMedicineForm', { searchSelection: selection }, { merge: true })
  })

  it('"Não achei" abre o "Confira" em branco (fallback)', () => {
    const r = render(withCtx(<OnboardingMedicineSearchStep />).ui)
    fireEvent.press(r.getByLabelText('Não achei. Digitar à mão'))
    expect(mockNav.popTo).toHaveBeenCalledWith(
      'OnboardingMedicineForm',
      { manualEntry: expect.any(Number) },
      { merge: true },
    )
  })

  it('nome com várias concentrações mostra o passo 2 na mesma tela', () => {
    mockFlow.current = flow({
      presentationStep: { title: 'Nimesulida', options: [], preparing: true, onPick: jest.fn(), onSkip: jest.fn(), onBack: jest.fn() },
    })
    const r = render(withCtx(<OnboardingMedicineSearchStep />).ui)
    expect(r.queryByLabelText('Buscar remédio pelo nome')).toBeNull()
  })
})

describe('"Confira" com a caixa lida (US7 cen. 2 · INV-1)', () => {
  it('preenche nome/dose/unidade com o selo de origem e não grava nada', () => {
    const { getByDisplayValue, getByText, queryByText } = renderStep({ scanDraft: draft(), scanEan: '7896004778402' })
    expect(getByDisplayValue('Losartana Potássica')).toBeTruthy()
    expect(getByDisplayValue('50')).toBeTruthy()
    expect(getByText('Lido pelo código de barras')).toBeTruthy()
    expect(getByText('Confira o seu remédio')).toBeTruthy()
    expect(queryByText(PALLIATIVE)).toBeNull()
    expect(getByText('Pular')).toBeTruthy()
    expect(mockMedicineCreate).not.toHaveBeenCalled()
  })

  it('"Continuar" só guarda no contexto, com lab e registro da caixa (0 gravações antes do passo 3)', () => {
    const { getByText, ctx } = renderStep({ scanDraft: draft() })
    fireEvent.press(getByText('Continuar'))
    expect(ctx.setMedicine).toHaveBeenCalledTimes(1)
    expect(ctx.setMedicine.mock.calls[0][0]).toMatchObject({
      name: 'Losartana Potássica',
      dosage_per_pill: '50',
      dosage_unit: 'mg',
      laboratory: 'Lab X',
      anvisa_registration: '123456789',
    })
    expect(ctx.setMedicine.mock.calls[0][0]).not.toHaveProperty('ean')
    expect(mockNav.navigate).toHaveBeenCalledWith('OnboardingTreatment')
    expect(mockMedicineCreate).not.toHaveBeenCalled()
  })

  it('"Trocar" volta à escolha do caminho', () => {
    const { getByLabelText } = renderStep({ scanDraft: draft() })
    fireEvent.press(getByLabelText('Trocar remédio'))
    expect(mockNav.popTo).toHaveBeenCalledWith('OnboardingMedicine')
  })
})

describe('composto ambíguo (US7 cen. 3 · INV-2)', () => {
  it('dose vazia + escolha de 1 toque; sem escolha não avança', () => {
    const { getByText, getByLabelText, ctx } = renderStep({ scanDraft: draft(AMBIGUOUS) })
    expect(getByText('Este remédio junta mais de uma substância')).toBeTruthy()
    expect(getByText('Na embalagem: 500 mg + 125 mg')).toBeTruthy()
    fireEvent.press(getByText('Continuar'))
    expect(ctx.setMedicine).not.toHaveBeenCalled()
    expect(mockShow).toHaveBeenCalledWith('Escolha a concentração do remédio.', { variant: 'error' })

    fireEvent.press(getByLabelText('Usar 500 mg'))
    fireEvent.press(getByText('Continuar'))
    expect(ctx.setMedicine.mock.calls[0][0]).toMatchObject({ dosage_per_pill: '500', dosage_unit: 'mg' })
  })
})

describe('"Confira" com a escolha da busca (US7 cen. 5)', () => {
  it('com a embalagem escolhida, a concentração chega preenchida e a dica paliativa some', () => {
    const { getByDisplayValue, getByText, queryByText } = renderStep({
      searchSelection: { anvisaItem: { name: 'Losartana Potássica', regulatoryCategory: 'Similar' }, cmedDraft: draft() },
    })
    expect(getByDisplayValue('50')).toBeTruthy()
    expect(getByText('Preenchido pela lista da ANVISA')).toBeTruthy()
    expect(queryByText(PALLIATIVE)).toBeNull()
  })

  it('sem embalagem (offline): preenche nome + forma única e a dica fica', () => {
    const { getByDisplayValue, getByText, ctx } = renderStep({
      searchSelection: { anvisaItem: { name: 'Dipirona', regulatoryCategory: 'Generico', forms: ['comprimido'] } },
    })
    expect(getByDisplayValue('Dipirona')).toBeTruthy()
    expect(getByText(PALLIATIVE)).toBeTruthy()
    expect(ctx.setMedicine).not.toHaveBeenCalled()
  })
})

describe('"Confira" em branco (fallback de caixa/busca que não serviram)', () => {
  it('sem selo, com a dica e o "Pular"', () => {
    const { getByText, queryByText } = renderStep({ manualEntry: 1 })
    expect(getByText('Seu primeiro remédio')).toBeTruthy()
    expect(queryByText('Lido pelo código de barras')).toBeNull()
    expect(getByText(PALLIATIVE)).toBeTruthy()
    expect(getByText('Pular')).toBeTruthy()
  })
})

describe('telemetria do 1º remédio (TRACKING_PLAN §5.3)', () => {
  it('caixa: "Continuar" emite scan_confirmed 1× e marca source scan', () => {
    const { getByText, getByDisplayValue, ctx } = renderStep({ scanDraft: draft() })
    fireEvent.changeText(getByDisplayValue('50'), '25')
    fireEvent.press(getByText('Continuar'))
    fireEvent.press(getByText('Continuar'))
    const confirmed = mockLogEvent.mock.calls.filter(([n]) => n === 'scan_confirmed')
    expect(confirmed).toEqual([['scan_confirmed', { surface: 'mobile', used_existing: false, dose_edited: true }]])
    expect(ctx.setMedicineSource).toHaveBeenLastCalledWith('scan')
  })

  it('busca: source anvisa_search, sem scan_confirmed', () => {
    const { getByText, ctx } = renderStep({
      searchSelection: { anvisaItem: { name: 'Losartana Potássica', regulatoryCategory: 'Similar' }, cmedDraft: draft() },
    })
    fireEvent.press(getByText('Continuar'))
    expect(ctx.setMedicineSource).toHaveBeenCalledWith('anvisa_search')
    expect(mockLogEvent.mock.calls.map(([n]) => n)).not.toContain('scan_confirmed')
  })

  it('em branco: source manual', () => {
    const { getByText, getByLabelText, ctx } = renderStep({ manualEntry: 1 })
    fireEvent.changeText(getByLabelText('Nome do remédio'), 'Remédio X')
    fireEvent.changeText(getByLabelText('Concentração'), '10')
    fireEvent.press(getByText('Continuar'))
    expect(ctx.setMedicineSource).toHaveBeenCalledWith('manual')
  })

  it('"Não achei" emite medicine_search_dismissed com exit manual', () => {
    const r = render(withCtx(<OnboardingMedicineSearchStep />).ui)
    fireEvent.press(r.getByLabelText('Não achei. Digitar à mão'))
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_search_dismissed', {
      surface: 'mobile',
      had_query: true,
      step: 'search',
      exit: 'manual',
    })
  })
})
