// 066 Slice E (C-4, smoke 2026-10-18) — o "Continuar" do passo de estoque nunca gira para sempre: cada
// escrita tem prazo, estourado a pessoa vê o motivo e pode tentar de novo, e a nova tentativa
// reaproveita a escrita que ainda estava em voo (nada de 2º remédio/tratamento — classe do AP-283).

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import OnboardingStockStep, { WRITE_TIMEOUT_MS } from '../screens/OnboardingStockStep'
import { OnboardingContext } from '../OnboardingContext'

const mockNav = { navigate: jest.fn(), goBack: jest.fn() }
const mockShow = jest.fn()
const mockMedicineCreate = jest.fn()
const mockProtocolCreate = jest.fn()
const mockChooseStockMode = jest.fn((..._args: any[]) => Promise.resolve())

jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }))
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('@medications/services/medicineService', () => ({
  medicineService: { create: (...args: any[]) => mockMedicineCreate(...args) },
}))
jest.mock('@treatments/services/protocolService', () => ({
  protocolService: { create: (...args: any[]) => mockProtocolCreate(...args) },
}))
jest.mock('@profile/services/stockPreferenceService', () => ({
  chooseStockModeInOnboarding: (...args: any[]) => mockChooseStockMode(...args),
}))
jest.mock('@platform/notifications/pushPermission', () => ({
  enablePushAtIntent: () => Promise.resolve({ granted: true }),
}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => ({ refresh: () => Promise.resolve() }),
}))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  }
})

const TIMEOUT_TOAST = 'A conexão está demorando. Verifique a internet e toque em Continuar de novo.'

function renderStep() {
  const ctx = {
    medicine: { name: 'Losartana Potássica', dosage_per_pill: '50', dosage_unit: 'mg' },
    medicineSource: 'scan',
    treatment: { frequency: 'diário', _remind: false },
    finish: jest.fn(() => Promise.resolve()),
    skip: jest.fn(),
    markCompleted: jest.fn(() => Promise.resolve()),
  }
  const utils = render(
    <OnboardingContext.Provider value={ctx as any}>
      <OnboardingStockStep />
    </OnboardingContext.Provider>,
  )
  return { ...utils, ctx }
}

async function pressContinue(utils) {
  await act(async () => {
    fireEvent.press(utils.getByText('Continuar'))
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockProtocolCreate.mockResolvedValue({ id: 'prot-1' })
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('passo de estoque — prazo das escritas (C-4)', () => {
  it('escrita sem resposta: depois do prazo mostra o motivo e não conclui', async () => {
    mockMedicineCreate.mockReturnValue(new Promise(() => {}))
    const utils = renderStep()
    await pressContinue(utils)

    await act(async () => {
      jest.advanceTimersByTime(WRITE_TIMEOUT_MS)
    })

    expect(mockShow).toHaveBeenCalledWith(TIMEOUT_TOAST, { variant: 'error' })
    expect(mockProtocolCreate).not.toHaveBeenCalled()
    expect(utils.ctx.finish).not.toHaveBeenCalled()
  })

  it('tentar de novo reaproveita a escrita atrasada: 1 remédio só, e o onboarding conclui', async () => {
    let resolveLate: (value: any) => void = () => {}
    mockMedicineCreate.mockReturnValue(new Promise((resolve) => { resolveLate = resolve }))
    const utils = renderStep()
    await pressContinue(utils)
    await act(async () => {
      jest.advanceTimersByTime(WRITE_TIMEOUT_MS)
    })
    expect(mockShow).toHaveBeenCalledWith(TIMEOUT_TOAST, { variant: 'error' })

    // A gravação que estourou o prazo chega depois; a pessoa toca em Continuar de novo.
    await act(async () => {
      resolveLate({ id: 'med-1' })
    })
    await pressContinue(utils)

    expect(mockMedicineCreate).toHaveBeenCalledTimes(1)
    expect(mockProtocolCreate).toHaveBeenCalledTimes(1)
    expect(mockProtocolCreate.mock.calls[0][0]).toMatchObject({ medicine_id: 'med-1' })
    expect(utils.ctx.finish).toHaveBeenCalledTimes(1)
  })

  it('falha de verdade não fica presa: a próxima tentativa grava de novo', async () => {
    mockMedicineCreate.mockRejectedValueOnce(new Error('Erro de rede')).mockResolvedValueOnce({ id: 'med-2' })
    const utils = renderStep()
    await pressContinue(utils)
    expect(mockShow).toHaveBeenCalledWith('Erro de rede', { variant: 'error' })

    await pressContinue(utils)
    expect(mockMedicineCreate).toHaveBeenCalledTimes(2)
    expect(utils.ctx.finish).toHaveBeenCalledTimes(1)
  })
})
