// RootTabs.jsx — tab navigator principal do MVP mobile (H5.1)
// 4 tabs: Hoje | Tratamentos | Estoque | Perfil
// ADR-028: StyleSheet (não NativeWind)
// ADR-023: sem font weights < 400
// Iconografia: lucide-react-native — mesmos ícones do BottomNavRedesign.jsx e Sidebar.jsx web

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, Pill, Package, User } from 'lucide-react-native'
import { ROUTES } from './routes'
import TodayScreen from '../features/dashboard/screens/TodayScreen'
import TreatmentsStack from './TreatmentsStack'
import StockScreen from '../features/stock/screens/StockScreen'
import ProfileStack from './ProfileStack'
import { colors } from '../shared/styles/tokens'

const Tab = createBottomTabNavigator()

// Mesmos ícones do BottomNavRedesign.jsx e Sidebar.jsx da web (lucide-react)
// Calendar → Hoje | Pill → Tratamentos | Package → Estoque | User → Perfil
const TAB_ICONS = {
  [ROUTES.TODAY]: Calendar,
  [ROUTES.TREATMENTS]: Pill,
  [ROUTES.STOCK]: Package,
  [ROUTES.PROFILE]: User,
}

export default function RootTabs() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const Icon = TAB_ICONS[route.name]
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600', // ADR-023: mínimo 400
          },
          tabBarActiveTintColor: colors.tab.activeTint,
          tabBarInactiveTintColor: colors.tab.inactiveTint,
          tabBarStyle: {
            backgroundColor: colors.tab.bgDefault,
            borderTopColor: colors.border.default,
            borderTopWidth: 1,
            // R4-H01: ajustar padding/height para Edge-to-Edge (Android) e Home Indicator (iOS)
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12),
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 60 + insets.bottom : 72 + insets.bottom,
          },
          tabBarIcon: ({ color, size }) => Icon
            ? <Icon size={size} color={color} strokeWidth={1.75} />
            : null,
        }
      }}
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
