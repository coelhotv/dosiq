// onboardingTreatmentStep.test.tsx — passo 3 do onboarding com presets de horário (spec 086 US-2 / PO-4)
// Framework: Jest (jest-expo) — rodar em apps/mobile/
//
// O passo não grava nada (spec 044): só guarda no contexto via `setTreatment`. Ida e volta no wizard
// remonta o passo com `treatment` do contexto — o preset reaparece porque é derivado dos horários.

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

const mockSetTreatment = jest.fn()
let mockTreatment = null
jest.mock('../OnboardingContext', () => ({
  useOnboarding: () => ({
    medicine: { id: 'm-1', name: 'Amoxicilina' },
    treatment: mockTreatment,
    setTreatment: (...args) => mockSetTreatment(...args),
    skip: jest.fn(),
  }),
}))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }) }))
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: jest.fn() }) }))
jest.mock('@features/onboarding/components/OnboardingHeader', () => ({ __esModule: true, default: () => null }))
// Rodapé usa safe-area insets (fora do escopo deste teste).
jest.mock('@shared/components/form/FormActions', () => ({ __esModule: true, default: () => null }))

let mockGate = { available: true, settled: true }
jest.mock('@treatments/hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => mockGate,
}))
// Seletores de data/hora nativos fora do escopo: o dublê mostra o rótulo (a pergunta) e mais nada.
jest.mock('@shared/components/form', () => {
  const { Text } = jest.requireActual('react-native')
  return { FormDatePicker: ({ label }) => <Text>{label}</Text>, FormTimePicker: ({ label }) => <Text>{label}</Text> }
})

import OnboardingTreatmentStep from '../screens/OnboardingTreatmentStep'

function lastSchedule() {
  const calls = mockSetTreatment.mock.calls
  return calls[calls.length - 1][0].time_schedule
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockTreatment = null
  mockGate = { available: true, settled: true }
})

describe('OnboardingTreatmentStep — presets (086)', () => {
  it('abre com 08:00 (padrão de hoje) e 1x marcado', () => {
    const { getByTestId } = render(<OnboardingTreatmentStep />)
    expect(getByTestId('schedule-preset-1x').props.accessibilityState.checked).toBe(true)
    expect(lastSchedule()).toEqual(['08:00'])
  })

  it('12 em 12h a partir de 08:00 → contexto recebe 08:00/20:00 (sem gravar no banco)', () => {
    const { getByTestId } = render(<OnboardingTreatmentStep />)
    fireEvent.press(getByTestId('schedule-preset-12h'))
    expect(lastSchedule()).toEqual(['08:00', '20:00'])
  })

  it('voltar ao passo 3 com 8/8 no contexto → 8/8 marcado e horários preservados', () => {
    mockTreatment = {
      medicine_id: 'm-1', name: 'Amoxicilina', dosage_per_intake: 1, frequency: 'diário', weekdays: [],
      time_schedule: ['07:00', '15:00', '23:00'], start_date: '2026-09-29',
    }
    const { getByTestId } = render(<OnboardingTreatmentStep />)
    expect(getByTestId('schedule-preset-8h').props.accessibilityState.checked).toBe(true)
    expect(lastSchedule()).toEqual(['07:00', '15:00', '23:00'])
  })

  it('"Semanal" esconde os presets (FR-008; renomeado de "Dias da semana" — E-9)', () => {
    const { getByText, queryByTestId, queryByText } = render(<OnboardingTreatmentStep />)
    expect(queryByText('Dias da semana')).toBeNull()
    fireEvent.press(getByText('Semanal'))
    expect(queryByTestId('schedule-presets')).toBeNull()
  })
})

describe('OnboardingTreatmentStep — Mensal (086 FR-022 / PO-4b)', () => {
  it('trava false ⇒ só "Todo dia" e "Semanal"', () => {
    mockGate = { available: false, settled: true }
    const { queryByTestId, getByTestId } = render(<OnboardingTreatmentStep />)
    expect(queryByTestId('frequency-segment-mensal_30')).toBeNull()
    expect(getByTestId('frequency-segment-semanal')).toBeTruthy()
  })

  it('trava ainda sem resposta ⇒ esqueleto, sem segmentos (D-8: nada salta sob o dedo)', () => {
    mockGate = { available: false, settled: false }
    const { getByTestId, queryByTestId } = render(<OnboardingTreatmentStep />)
    expect(getByTestId('frequency-skeleton')).toBeTruthy()
    expect(queryByTestId('frequency-segment-diário')).toBeNull()
  })

  it('Mensal ⇒ intervalo_dias/30 no contexto, número à vista, pergunta da próxima dose, sem presets', () => {
    const { getByTestId, getByText, queryByTestId } = render(<OnboardingTreatmentStep />)
    fireEvent.press(getByTestId('frequency-segment-mensal_30'))
    const last = mockSetTreatment.mock.calls[mockSetTreatment.mock.calls.length - 1][0]
    expect(last).toMatchObject({ frequency: 'intervalo_dias', interval_days: 30 })
    expect(getByText('A cada 30 dias, a partir da próxima dose.')).toBeTruthy()
    expect(getByText('Quando é a próxima dose?')).toBeTruthy()
    expect(queryByTestId('schedule-presets')).toBeNull()
    expect(getByTestId('frequency-segment-mensal_30').props.accessibilityState.checked).toBe(true)
  })

  it('Mensal → Todo dia limpa interval_days (sem 23514 no passo 4 — E-4)', () => {
    const { getByTestId } = render(<OnboardingTreatmentStep />)
    fireEvent.press(getByTestId('frequency-segment-mensal_30'))
    fireEvent.press(getByTestId('frequency-segment-diário'))
    const last = mockSetTreatment.mock.calls[mockSetTreatment.mock.calls.length - 1][0]
    expect(last).toMatchObject({ frequency: 'diário', interval_days: null })
  })

  it('voltar ao passo com Mensal no contexto e trava hoje false ⇒ Mensal segue marcado', () => {
    mockGate = { available: false, settled: false }
    mockTreatment = {
      medicine_id: 'm-1', name: 'Mesigyna', dosage_per_intake: 1, frequency: 'intervalo_dias', interval_days: 30,
      weekdays: [], time_schedule: ['08:00'], start_date: '2026-10-20',
    }
    const { getByTestId } = render(<OnboardingTreatmentStep />)
    expect(getByTestId('frequency-segment-mensal_30').props.accessibilityState.checked).toBe(true)
  })
})
