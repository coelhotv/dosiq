// OnboardingNavigator — wizard de primeiro acesso (Fase 4 S4.2).
//
// Dispara no 1º login de conta sem dados (gate em Navigation). 2 passos que
// REUSAM os fluxos das Fases 1 e 2 (PO-8, zero duplicação de lógica):
//   1. Primeiro remédio  → medicineService.create (F1)
//   2. Primeiro tratamento → protocolService.create (F2)
//   3. Modo de uso (estoque sim/não) → setStockTracking (spec 044, FR-001)
// Ao concluir OU pular, marca onboarding_completed e chama onComplete (Navigation
// troca para o app autenticado — "aha moment" no Dashboard).
//
// ADR-036: JS stack (não native-stack) por compatibilidade Android API 24.

import { useState, useMemo } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from '@navigation/routes'
import { completeOnboarding } from '@profile/services/profileService'
import { OnboardingContext } from './OnboardingContext'
import OnboardingWelcomeStep from './screens/OnboardingWelcomeStep'
import OnboardingMedicineStep from './screens/OnboardingMedicineStep'
import OnboardingTreatmentStep from './screens/OnboardingTreatmentStep'
import OnboardingStockStep from './screens/OnboardingStockStep'
import OnboardingStockInitialBalanceStep from './screens/OnboardingStockInitialBalanceStep'

// TODO(040-strict): Stack.Navigator não tipado p/ rotas dinâmicas (nível B)
const Stack: any = createStackNavigator()

export default function OnboardingNavigator({ onComplete }) {
  // Medicamento criado no passo 1, consumido pelo passo 2.
  const [medicine, setMedicine] = useState(null)
  // Tratamento em configuração no passo 3.
  const [treatment, setTreatment] = useState(null)

  // Concluir OU pular: marca onboarding_completed e entrega o app. Mesmo se a
  // marcação falhar, não prende o usuário no wizard.
  const finish = useMemo(() => async () => {
    await completeOnboarding()
    onComplete?.()
  }, [onComplete])

  // Marca a conclusão SEM sair do wizard (spec 044 F4b).
  //
  // Por que existe: o passo de estoque grava medicamento + tratamento + preferência e, na
  // opção 2, passou a navegar para o saldo inicial ANTES de concluir. Isso abriu uma janela
  // (a tela inteira de saldo) em que o setup já está gravado no banco mas o onboarding não
  // está marcado como concluído — matar o app ali reabriria o wizard do ZERO, e os guards de
  // idempotência (`createdMedicineId`/`protocolCreated`) são estado de componente: morrem no
  // restart. Resultado: medicamento e tratamento DUPLICADOS (a mesma classe do AP-283, que o
  // passo novo reabriu). O saldo inicial é coleta OPCIONAL — não é o que define "terminou o
  // setup". Marca-se a conclusão assim que as escritas do setup persistem.
  const markCompleted = useMemo(() => async () => {
    await completeOnboarding()
  }, [])

  const value = useMemo(
    () => ({ medicine, setMedicine, treatment, setTreatment, finish, markCompleted }),
    [medicine, treatment, finish, markCompleted],
  )

  return (
    <OnboardingContext.Provider value={value}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTES.ONBOARDING_WELCOME} component={OnboardingWelcomeStep} />
        <Stack.Screen name={ROUTES.ONBOARDING_MEDICINE} component={OnboardingMedicineStep} />
        <Stack.Screen name={ROUTES.ONBOARDING_TREATMENT} component={OnboardingTreatmentStep} />
        <Stack.Screen name={ROUTES.ONBOARDING_STOCK} component={OnboardingStockStep} />
        {/* F4b/T017 — só navegada quando a opção 2 ("também avisar quando acabando") é
            escolhida; conclui o onboarding (finish) tanto em "Ativar estoque" quanto "Cancelar" */}
        <Stack.Screen
          name={ROUTES.ONBOARDING_STOCK_INITIAL_BALANCE}
          component={OnboardingStockInitialBalanceStep}
        />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  )
}
