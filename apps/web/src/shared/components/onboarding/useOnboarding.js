/**
 * Hook useOnboarding - Hook personalizado para acessar o contexto de onboarding
 *
 * @module useOnboarding
 */

import { useContext } from 'react'
import { OnboardingContext } from './OnboardingContext'

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding deve ser usado dentro de OnboardingProvider')
  }
  return context
}
