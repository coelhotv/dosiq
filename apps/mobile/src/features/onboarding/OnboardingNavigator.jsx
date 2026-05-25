// OnboardingNavigator — wizard de primeiro acesso (Fase 4 S4.2).
//
// Dispara no 1º login de conta sem dados (gate em Navigation). 2 passos que
// REUSAM os fluxos das Fases 1 e 2 (PO-8, zero duplicação de lógica):
//   1. Primeiro remédio  → medicineService.create (F1)
//   2. Primeiro tratamento → protocolService.create (F2)
// Ao concluir OU pular, marca onboarding_completed e chama onComplete (Navigation
// troca para o app autenticado — "aha moment" no Dashboard).
//
// ADR-036: JS stack (não native-stack) por compatibilidade Android API 24.

import { useState, useCallback, useMemo } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from '@navigation/routes'
import { completeOnboarding } from '@profile/services/profileService'
import { OnboardingContext } from './OnboardingContext'
import OnboardingMedicineStep from './screens/OnboardingMedicineStep'
import OnboardingTreatmentStep from './screens/OnboardingTreatmentStep'

const Stack = createStackNavigator()

export default function OnboardingNavigator({ onComplete }) {
  // Medicamento criado no passo 1, consumido pelo passo 2.
  const [medicine, setMedicine] = useState(null)

  // Concluir OU pular: marca onboarding_completed e entrega o app. Mesmo se a
  // marcação falhar, não prende o usuário no wizard.
  const finish = useCallback(async () => {
    await completeOnboarding()
    onComplete?.()
  }, [onComplete])

  const value = useMemo(
    () => ({ medicine, setMedicine, finish }),
    [medicine, finish],
  )

  return (
    <OnboardingContext.Provider value={value}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTES.ONBOARDING_MEDICINE} component={OnboardingMedicineStep} />
        <Stack.Screen name={ROUTES.ONBOARDING_TREATMENT} component={OnboardingTreatmentStep} />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  )
}
