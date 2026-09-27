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

import { useState, useMemo, useEffect, useRef } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from '@navigation/routes'
import { completeOnboarding } from '@profile/services/profileService'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { OnboardingContext } from './OnboardingContext'
import OnboardingWelcomeStep from './screens/OnboardingWelcomeStep'
import OnboardingMedicineStep from './screens/OnboardingMedicineStep'
import OnboardingTreatmentStep from './screens/OnboardingTreatmentStep'
import OnboardingStockStep from './screens/OnboardingStockStep'
import OnboardingStockInitialBalanceStep from './screens/OnboardingStockInitialBalanceStep'

// TODO(040-strict): Stack.Navigator não tipado p/ rotas dinâmicas (nível B)
const Stack: any = createStackNavigator()

// Função hoisted (não handler do componente): lê as refs passadas, sem estado de render.
function emitOnce(ref, skippedRef) {
  if (ref.current || skippedRef.current) return
  ref.current = true
  logEvent(EVENTS.ONBOARDING_COMPLETE, { surface: SURFACES.MOBILE })
}

export default function OnboardingNavigator({ onComplete }) {
  // Medicamento criado no passo 1, consumido pelo passo 2.
  const [medicine, setMedicine] = useState(null)
  // Tratamento em configuração no passo 3.
  const [treatment, setTreatment] = useState(null)
  // 065 C2 (G-4): `complete` sai UMA vez. Na opção 2 do passo de estoque `markCompleted` roda antes
  // e `finish` depois (tela de saldo) — sem a ref, a mesma conclusão contaria duas vezes.
  const completeEmitted = useRef(false)
  const skipped = useRef(false)

  // Concluir OU pular: marca onboarding_completed e entrega o app. Mesmo se a
  // marcação falhar, não prende o usuário no wizard.
  // useMemo (e não useCallback) porque o `value` do Provider é um Memo que depende destes:
  // R-010 exige Memos ANTES de Handlers, e um useCallback aqui empurraria o `value` para
  // depois de um handler (erro de lint). O par é equivalente para uma função estável.
  const finish = useMemo(() => async () => {
    await completeOnboarding()
    emitOnce(completeEmitted, skipped)
    onComplete?.()
  }, [onComplete])

  // Pular ≠ concluir (065 C2, G-4): antes o "Pular" de 3 telas chamava `finish` direto e as duas
  // saídas eram indistinguíveis. `step` = posição do header (1..3) — onde a pessoa desistiu.
  const skip = useMemo(() => async (step) => {
    skipped.current = true
    logEvent(EVENTS.ONBOARDING_SKIP, { surface: SURFACES.MOBILE, step })
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
    emitOnce(completeEmitted, skipped)
  }, [])

  const value = useMemo(
    () => ({ medicine, setMedicine, treatment, setTreatment, finish, skip, markCompleted }),
    [medicine, treatment, finish, skip, markCompleted],
  )

  // Entrou no wizard. Reabrir o app no meio conta nova tentativa (declarado, analysis-prC G-8).
  useEffect(() => {
    logEvent(EVENTS.ONBOARDING_START, { surface: SURFACES.MOBILE })
  }, [])

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
