// RootTabs.jsx — tab navigator principal do MVP mobile (H5.1)
// 4 tabs: Hoje | Tratamentos | Estoque | Perfil
// ADR-028: StyleSheet (não NativeWind)
// ADR-023: sem font weights < 400

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { ROUTES } from './routes'
import TodayScreen from '../features/dashboard/screens/TodayScreen'
import TreatmentsStack from './TreatmentsStack'
import StockScreen from '../features/stock/screens/StockScreen'
import ProfileStack from './ProfileStack'

const Tab = createBottomTabNavigator()

// Ícones como texto — simples e sem dependências extras
// H5.8 pode substituir por @expo/vector-icons se necessário
const TAB_ICONS = {
  [ROUTES.TODAY]: '🗓',
  [ROUTES.TREATMENTS]: '💊',
  [ROUTES.STOCK]: '📦',
  [ROUTES.PROFILE]: '👤',
}

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600', // ADR-023: mínimo 400
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarIcon: ({ color, size }) => (
          <Text style={{ fontSize: size - 4, color }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen
        name={ROUTES.TODAY}
        component={TodayScreen}
        options={{ title: 'Hoje' }}
      />
      <Tab.Screen
        name={ROUTES.TREATMENTS}
        component={TreatmentsStack}
        options={{ title: 'Tratamentos' }}
      />
      <Tab.Screen
        name={ROUTES.STOCK}
        component={StockScreen}
        options={{ title: 'Estoque' }}
      />
      <Tab.Screen
        name={ROUTES.PROFILE}
        component={ProfileStack}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  )
}
