// 066 D1 (PO-2 · PO-6 · PO-11 · FR-016/FR-017 · INV-1/INV-6 · RC3 A) — o form é a confirmação do
// código de barras: aplica o rascunho devolvido pelo scanner, deixa tudo editável, pergunta "É este
// que você já tem?" quando há candidato e só o botão grava. O cadastro por scan nunca cria compra.

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import MedicineFormScreen from '../MedicineFormScreen'

const mockCreate = jest.fn()
const mockLogEvent = jest.fn()
const mockNav = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }
const mockRoute: { current: any } = { current: { params: {} } }
const mockMedicines: { current: { data: any[] | null; loading: boolean } } = { current: { data: [], loading: false } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => mockRoute.current,
}))
jest.mock('@medications/hooks/useMedicineMutation', () => ({
  useMedicineMutation: () => ({ create: mockCreate, update: jest.fn(), isLoading: false }),
}))
jest.mock('@medications/hooks/useMedicines', () => ({
  useMedicines: () => mockMedicines.current,
}))
jest.mock('@medications/components/MedicineAnvisaSheet', () => ({ MedicineAnvisaSheet: () => null }))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))
// 066 D2 · PO-4 guard: o cadastro por scan nunca chama o repositório de compra, com estoque ON ou OFF.
const mockStockTracking = { current: false }
const mockPurchaseCalls = jest.fn()
jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => ({ enabled: mockStockTracking.current, isEnabled: mockStockTracking.current, loading: false }),
}))
jest.mock('@stock/services/stockService', () => ({
  stockService: new Proxy({}, { get: (_t, name) => (...args: any[]) => mockPurchaseCalls(name, ...args) }),
}))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  }
})

// Rascunho como o scanner devolve (medicineDraftFromRow): amoxicilina+clavulanato genérico EMS, X 21.
function scanDraft(over: Record<string, unknown> = {}) {
  return {
    name: 'Amoxicilina + Clavulanato de Potassio',
    active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
    dosage_per_pill: 500,
    dosage_unit: 'mg',
    presentation: 'comprimido',
    laboratory: null,
    anvisa_registration: null,
    regulatory_category: 'Genérico',
    therapeutic_class: 'Antibióticos',
    strengthLabel: '500 mg + 125 mg',
    displayLaboratory: 'EMS',
    boxQuantity: 21,
    doseAmbiguous: false,
    strengthChoices: [],
    isGeneric: true,
    ...over,
  }
}

const EXISTING = {
  id: 'med-1',
  name: 'Amoxicilina + Clavulanato',
  active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
  dosage_per_pill: '500',
  dosage_unit: 'mg',
  presentation: 'comprimido',
  anvisa_registration: null,
}

function renderScanned(draft = scanDraft()) {
  mockRoute.current = { params: { scanDraft: draft } }
  return render(<MedicineFormScreen />)
}

beforeEach(() => {
  mockRoute.current = { params: {} }
  mockMedicines.current = { data: [], loading: false }
  mockCreate.mockResolvedValue({ id: 'new' })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('modo lido (PO-2 · INV-6)', () => {
  it('aplica a caixa no form, avisa a origem e não grava nada antes do botão', () => {
    const { getByText, getByDisplayValue } = renderScanned()
    expect(getByText('Confira antes de salvar')).toBeTruthy()
    expect(getByText('Lido pelo código de barras')).toBeTruthy()
    expect(getByText('Toque em qualquer campo para corrigir.')).toBeTruthy()
    expect(getByDisplayValue('Amoxicilina + Clavulanato de Potassio')).toBeTruthy()
    expect(getByDisplayValue('500')).toBeTruthy()
    expect(getByText('Na embalagem: 500 mg + 125 mg')).toBeTruthy()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('genérico: laboratório exibido como "caixa desta vez" e não persistido (FR-017 / D11)', async () => {
    const { getByText } = renderScanned()
    expect(getByText('Caixa desta vez: EMS')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const [payload, options] = mockCreate.mock.calls[0]
    expect(payload).toMatchObject({ dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido', anvisa_registration: null })
    expect(payload.laboratory || null).toBeNull()
    expect(options).toMatchObject({ goBack: true, source: 'scan' })
  })

  it('a pessoa corrige a dose antes de salvar: vale o que ela afirmou (INV-6) e o evento só diz que mudou', async () => {
    const { getByDisplayValue, getByText } = renderScanned()
    fireEvent.changeText(getByDisplayValue('500'), '875')
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate.mock.calls[0][0].dosage_per_pill).toBe(875)
    expect(mockLogEvent).toHaveBeenCalledWith('scan_confirmed', expect.objectContaining({ dose_edited: true, used_existing: false }))
    for (const [, props] of mockLogEvent.mock.calls) {
      expect(JSON.stringify(props)).not.toMatch(/Amoxicilina|EMS|875|500/)
    }
  })

  it('dose ambígua: chega vazia e exige a escolha (INV-2)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = renderScanned(
      scanDraft({ dosage_per_pill: null, doseAmbiguous: true, strengthChoices: [{ dose: 500, unit: 'mg' }, { dose: 125, unit: 'mg' }] }),
    )
    expect(getByText('Este remédio junta mais de uma substância')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate).not.toHaveBeenCalled()
    alert.mockRestore()
  })

  it('cadastro sem scan não muda: sem título de conferência, source manual, nenhuma pergunta (guard PO-6)', async () => {
    mockMedicines.current = { data: [EXISTING], loading: false }
    const { queryByText, getByText, getByLabelText } = render(<MedicineFormScreen />)
    expect(queryByText('Confira antes de salvar')).toBeNull()
    expect(queryByText('É este que você já tem?')).toBeNull()
    fireEvent.changeText(getByLabelText(/Nome/), 'Algo')
    fireEvent.changeText(getByLabelText(/Concentração/), '10')
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ source: 'manual' })
  })

  it('"Ler o código de barras" abre o scanner a partir do form', () => {
    const { getByLabelText } = render(<MedicineFormScreen />)
    fireEvent.press(getByLabelText('Ler o código de barras'))
    expect(mockNav.navigate).toHaveBeenCalledWith('MedicineScan', { entryPoint: 'medicine_form' })
  })

  it('"Escanear caixa" da lista chega com startScan e abre o scanner uma vez', () => {
    mockRoute.current = { params: { startScan: true } }
    render(<MedicineFormScreen />)
    expect(mockNav.setParams).toHaveBeenCalledWith({ startScan: undefined })
    expect(mockNav.navigate).toHaveBeenCalledWith('MedicineScan', { entryPoint: 'medicines_list' })
  })
})

describe('volta manual do scanner (C-D1-3)', () => {
  it('manualEntry rola até "Identificação" e não aplica caixa nenhuma', () => {
    const { ScrollView } = require('react-native')
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
    mockRoute.current = { params: { manualEntry: 123 } }
    const { queryByText } = render(<MedicineFormScreen />)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: true }))
    expect(queryByText('Confira antes de salvar')).toBeNull()
    scrollTo.mockRestore()
  })
})

describe('"É este que você já tem?" (PO-6 · D-4)', () => {
  it('com candidato, salvar sem responder é impossível e "Sim, é este" não cria nada', async () => {
    mockMedicines.current = { data: [EXISTING], loading: false }
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText, getByLabelText } = renderScanned()
    expect(getByText('É este que você já tem?')).toBeTruthy()
    // "Sim, é este" desabilitado até escolher
    fireEvent.press(getByText('Sim, é este'))
    expect(alert).not.toHaveBeenCalled()
    fireEvent.press(getByLabelText(/Amoxicilina \+ Clavulanato 500 mg, idêntico/))
    fireEvent.press(getByText('Sim, é este'))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Você já tem este remédio', expect.stringContaining('Nada novo foi criado'), expect.any(Array))
    expect(mockLogEvent).toHaveBeenCalledWith('scan_confirmed', expect.objectContaining({ used_existing: true }))
    alert.mockRestore()
  })

  it('"Não, cadastrar como novo" segue no form e cria 1', async () => {
    mockMedicines.current = { data: [EXISTING], loading: false }
    const { getByText, queryByText } = renderScanned()
    fireEvent.press(getByText('Não, cadastrar como novo'))
    expect(queryByText('É este que você já tem?')).toBeNull()
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('✕ sai sem gravar (INV-1)', () => {
    mockMedicines.current = { data: [EXISTING], loading: false }
    const { getAllByLabelText } = renderScanned()
    fireEvent.press(getAllByLabelText('Fechar sem salvar')[0])
    expect(mockNav.goBack).toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('genérico ambíguo (sem dose) ainda acha o candidato pela concentração possível (CP-6)', () => {
    mockMedicines.current = { data: [EXISTING], loading: false }
    const { getByText } = renderScanned(
      scanDraft({ dosage_per_pill: null, doseAmbiguous: true, strengthChoices: [{ dose: 500, unit: 'mg' }, { dose: 125, unit: 'mg' }] }),
    )
    expect(getByText('É este que você já tem?')).toBeTruthy()
  })

  it('lista ainda carregando não pula a pergunta (FM-7)', async () => {
    mockMedicines.current = { data: null, loading: true }
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByText } = renderScanned()
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Um momento', expect.any(String))
    alert.mockRestore()
  })

  it('remédio diferente na lista não vira candidato', () => {
    mockMedicines.current = { data: [{ ...EXISTING, id: 'm2', name: 'Losartana', active_ingredient: 'Losartana', dosage_per_pill: '50' }], loading: false }
    const { queryByText } = renderScanned()
    expect(queryByText('É este que você já tem?')).toBeNull()
  })
})

describe('cadastro por scan nunca cria compra (066 D2 · PO-4 guard)', () => {
  it.each([false, true])('estoque %s: salvar o cadastro lido não toca o repositório de compra', async (on) => {
    mockStockTracking.current = on
    const { getByText } = renderScanned()
    await act(async () => {
      fireEvent.press(getByText('Criar medicamento'))
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockPurchaseCalls).not.toHaveBeenCalled()
  })
})
