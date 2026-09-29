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

import OnboardingTreatmentStep from '../screens/OnboardingTreatmentStep'

function lastSchedule() {
  const calls = mockSetTreatment.mock.calls
  return calls[calls.length - 1][0].time_schedule
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockTreatment = null
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

  it('"Dias da semana" esconde os presets (FR-008)', () => {
    const { getByText, queryByTestId } = render(<OnboardingTreatmentStep />)
    fireEvent.press(getByText('Dias da semana'))
    expect(queryByTestId('schedule-presets')).toBeNull()
  })
})
