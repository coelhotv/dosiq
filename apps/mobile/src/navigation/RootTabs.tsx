// RootTabs.jsx — tab navigator principal do MVP mobile (H5.1)
// 4 tabs: Hoje | Tratamentos | Estoque | Perfil
// ADR-028: StyleSheet (não NativeWind)
// ADR-023: sem font weights < 400
// Iconografia: lucide-react-native — mesmos ícones do BottomNavRedesign.jsx e Sidebar.jsx web

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, Pill, Package, User } from 'lucide-react-native'
import { ROUTES } from './routes'
import TodayScreen from '../features/dashboard/screens/TodayScreen'
import TreatmentsStack from './TreatmentsStack'
import StockStack from './StockStack'
import ProfileStack from './ProfileStack'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { colors } from '../shared/styles/tokens'

// TODO(040-strict): createBottomTabNavigator<any>() — sem ParamList tipada, overload exige `id`
const Tab = createBottomTabNavigator<any>()

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
  // Spec 044 F3: enquanto `ready === false` não sabemos se a Estoque deve existir —
  // não renderizar as tabs evita o piscar da aba pro usuário dose-only (AP-277).
  const { enabled: stockEnabled, ready: stockReady } = useStockTracking()

  if (!stockReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.tab.activeTint} size="large" />
      </View>
    )
  }

  return (
    <Tab.Navigator
      id="RootTabs"
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
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Re-tap na tab ativa enquanto em sub-tela → volta para a raiz do stack.
            // Necessário em createStackNavigator (JS) — native-stack faria por padrão.
            const isFocused = navigation.isFocused()
            // TODO(040-strict): route.state/e.preventDefault não tipados p/ tabPress genérico
            const tabState = (route as any).state
            const isOnSubScreen = tabState && tabState.index > 0
            if (isFocused && isOnSubScreen) {
              (e as any).preventDefault()
              navigation.navigate(ROUTES.TREATMENTS, { screen: ROUTES.TREATMENTS_LIST })
            }
          },
        })}
      />
      {stockEnabled && (
        <Tab.Screen
          name={ROUTES.STOCK}
          component={StockStack}
          options={{ title: 'Estoque' }}
          listeners={({ navigation, route }) => ({
            tabPress: (e) => {
              // Re-tap na tab ativa enquanto em sub-tela → volta para a raiz do stack.
              // Necessário em createStackNavigator (JS) — native-stack faria por padrão.
              const isFocused = navigation.isFocused()
              // TODO(040-strict): route.state/e.preventDefault não tipados p/ tabPress genérico
              const tabState = (route as any).state
              const isOnSubScreen = tabState && tabState.index > 0
              if (isFocused && isOnSubScreen) {
                (e as any).preventDefault()
                navigation.navigate(ROUTES.STOCK, { screen: ROUTES.STOCK_MAIN })
              }
            },
          })}
        />
      )}
      <Tab.Screen
        name={ROUTES.PROFILE}
        component={ProfileStack}
        options={{ title: 'Perfil' }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const isFocused = navigation.isFocused()
            // TODO(040-strict): route.state/e.preventDefault não tipados p/ tabPress genérico
            const tabState = (route as any).state
            const isOnSubScreen = tabState && tabState.index > 0
            if (isFocused && isOnSubScreen) {
              (e as any).preventDefault()
              navigation.navigate(ROUTES.PROFILE, { screen: ROUTES.PROFILE_MAIN })
            }
          },
        })}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tab.bgDefault,
  },
})
