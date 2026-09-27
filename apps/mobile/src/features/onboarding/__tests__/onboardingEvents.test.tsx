// onboardingEvents.test.tsx — start/skip/complete do wizard (spec 065 PR C2 / G-4 / PO-5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import React from 'react'
import { render, act } from '@testing-library/react-native'

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

const mockCompleteOnboarding = jest.fn(() => Promise.resolve())
jest.mock('@profile/services/profileService', () => ({
  completeOnboarding: () => mockCompleteOnboarding(),
}))

// Navigator renderiza todas as telas; cada tela é uma sonda que expõe o contexto do wizard.
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component: C }) => <C />,
  }),
}))

// A sonda vive NA factory: o import do navigator é içado e roda antes de qualquer const do arquivo.
jest.mock('../screens/OnboardingWelcomeStep', () => ({
  __esModule: true,
  default: () => {
    const { useOnboarding } = require('../OnboardingContext')
    global.__onbCtx = useOnboarding()
    return null
  },
}))
jest.mock('../screens/OnboardingMedicineStep', () => ({ __esModule: true, default: () => null }))
jest.mock('../screens/OnboardingTreatmentStep', () => ({ __esModule: true, default: () => null }))
jest.mock('../screens/OnboardingStockStep', () => ({ __esModule: true, default: () => null }))
jest.mock('../screens/OnboardingStockInitialBalanceStep', () => ({ __esModule: true, default: () => null }))

import OnboardingNavigator from '../OnboardingNavigator'

function names() {
  return mockLogEvent.mock.calls.map(([n]) => n)
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  global.__onbCtx = null
})

describe('OnboardingNavigator — eventos', () => {
  it('mount emite onboarding_start uma vez', () => {
    render(<OnboardingNavigator onComplete={jest.fn()} />)
    expect(names()).toEqual(['onboarding_start'])
  })

  it('markCompleted + finish (opção 2 do estoque) → UM onboarding_complete', async () => {
    const onComplete = jest.fn()
    render(<OnboardingNavigator onComplete={onComplete} />)
    await act(async () => { await global.__onbCtx.markCompleted() })
    await act(async () => { await global.__onbCtx.finish() })
    expect(names().filter((n) => n === 'onboarding_complete')).toHaveLength(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('pular emite skip{step} e ZERO complete (antes eram a mesma função)', async () => {
    const onComplete = jest.fn()
    render(<OnboardingNavigator onComplete={onComplete} />)
    await act(async () => { await global.__onbCtx.skip(2) })
    expect(mockLogEvent).toHaveBeenCalledWith('onboarding_skip', { surface: 'mobile', step: 2 })
    expect(names()).not.toContain('onboarding_complete')
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
