// OnboardingStockInitialBalanceStep — wrapper do "Estoque inicial" dentro do wizard (spec 044,
// F4b / T017, entrada 2/3).
//
// A preferência já está ON quando chega aqui (OnboardingStockStep gravou via
// chooseStockModeInOnboarding ANTES de navegar) — esta tela é coleta OPCIONAL de saldo, igual
// à web. Por isso ela conclui o onboarding (`finish()`) tanto no "Ativar estoque" quanto no
// "Cancelar": não existe passo seguinte, e cancelar aqui não desfaz a escolha do passo anterior.

import { useOnboarding } from '../OnboardingContext'
import StockInitialBalanceScreen from '@stock/screens/StockInitialBalanceScreen'

export default function OnboardingStockInitialBalanceStep() {
  const { finish } = useOnboarding()
  return <StockInitialBalanceScreen source="onboarding" onDone={finish} />
}
