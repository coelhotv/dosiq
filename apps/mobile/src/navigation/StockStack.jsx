// StockStack.jsx — stack aninhado dentro da tab Estoque
// Fase 3: inclui StockScreen como raiz (STOCK_MAIN)
// Sub-telas (StockDetail, StockAdjustment) adicionadas nas Waves 4/5
//
// ADR-036: usa `@react-navigation/stack` (JS) em vez de native-stack
// — evita crash em Android API 24 (rn-screens IndexOutOfBoundsException)

import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from './routes'
import StockScreen from '../features/stock/screens/StockScreen'
import PurchaseFormScreen from '../features/stock/screens/PurchaseFormScreen'
import PurchaseHistoryScreen from '../features/stock/screens/PurchaseHistoryScreen'

const Stack = createStackNavigator()

export default function StockStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.STOCK_MAIN} component={StockScreen} />
      <Stack.Screen name={ROUTES.PURCHASE_FORM} component={PurchaseFormScreen} />
      <Stack.Screen name={ROUTES.PURCHASE_HISTORY} component={PurchaseHistoryScreen} />
    </Stack.Navigator>
  )
}
