import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, getUserId } from '../../lib/supabase'

const OnboardingContext = createContext(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding deve ser usado dentro de OnboardingProvider')
  }
  return context
}

export function OnboardingProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [onboardingData, setOnboardingData] = useState({
    medicine: null,
    protocol: null,
    telegramConnected: false
  })

  const TOTAL_STEPS = 4

  // Verifica se o onboarding já foi completado
  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      setIsLoading(true)
      const userId = await getUserId()
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao verificar status do onboarding:', error)
        setIsOpen(true)
        return
      }

      // Se não existir registro ou onboarding_completed for false/null, mostra o wizard
      if (!data || data.onboarding_completed !== true) {
        setIsOpen(true)
      }
    } catch (error) {
      console.error('Erro ao verificar onboarding:', error)
      setIsOpen(true)
    } finally {
      setIsLoading(false)
    }
  }

  const completeOnboarding = useCallback(async () => {
    try {
      const userId = await getUserId()
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        console.error('Erro ao salvar status do onboarding:', error)
        return false
      }

      setIsOpen(false)
      setCurrentStep(0)
      return true
    } catch (error) {
      console.error('Erro ao completar onboarding:', error)
      return false
    }
  }, [])

  const skipOnboarding = useCallback(async () => {
    return await completeOnboarding()
  }, [completeOnboarding])

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1))
  }, [TOTAL_STEPS])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  const goToStep = useCallback((step) => {
    setCurrentStep(Math.max(0, Math.min(step, TOTAL_STEPS - 1)))
  }, [TOTAL_STEPS])

  const updateOnboardingData = useCallback((key, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const value = {
    isOpen,
    setIsOpen,
    currentStep,
    totalSteps: TOTAL_STEPS,
    isLoading,
    onboardingData,
    updateOnboardingData,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    skipOnboarding
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export default OnboardingProvider