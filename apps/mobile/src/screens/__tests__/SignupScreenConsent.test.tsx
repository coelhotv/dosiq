// SignupScreenConsent.test.tsx — S3 sem caixa de consentimento (spec 096 B3, T040d).
// A autorização A saiu do cadastro (vai ao S1 do onboarding); a conta nasce sem intenção no metadata.

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { HEALTH_CONSENT_COPY } from '@dosiq/core'

const mockSignUp = jest.fn((..._a: any[]) => Promise.resolve({ success: true }))
jest.mock('../../platform/auth/authService', () => ({
  signUpWithEmail: (...a: any[]) => mockSignUp(...a),
  verifyOtpWithEmail: jest.fn(),
}))
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }
})

import SignupScreen from '../SignupScreen'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('SignupScreen (S3, v0.4)', () => {
  it('sem caixa de dados de saúde; texto novo e rodapé dos Termos', () => {
    render(<SignupScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />)
    expect(screen.queryByLabelText(HEALTH_CONSENT_COPY.label)).toBeNull()
    expect(screen.getByText(/ficam guardados no Brasil/)).toBeTruthy()
    expect(screen.getByText('Termos de Uso')).toBeTruthy()
    expect(screen.getByText('Política de Privacidade')).toBeTruthy()
  })
})

// Quem ainda chama `materializeSignupIntent` no mobile: só o gate (contas criadas pela web).
it('submit chama signUp sem opções de consentimento', async () => {
  render(<SignupScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />)
  const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput)
  fireEvent.changeText(inputs[0], 'novo@example.com')
  fireEvent.changeText(inputs[1], 'Senha123!')
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: /Continuar|Criar/ })) })
  expect(mockSignUp).toHaveBeenCalledWith('novo@example.com', 'Senha123!', 'Senha123!')
})
