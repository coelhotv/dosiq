// OnboardingContext — estado compartilhado do wizard de primeiro acesso (S4.2).
// Carrega o medicamento criado no passo 1 para o passo 2 e expõe finish().

import { createContext, useContext } from 'react'

export const OnboardingContext = createContext(null)

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding deve ser usado dentro de OnboardingNavigator')
  return ctx
}
