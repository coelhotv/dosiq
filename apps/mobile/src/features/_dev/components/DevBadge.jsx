// DevBadge.jsx — badge dev-only (spec 015 onda 2). Abre o DevHub.
//
// Renderiza APENAS em __DEV__ (no-op em produção). Migrou do header de Hoje p/ o título
// do Perfil (PO 2026-06-24), já que o top-right de Hoje/Tratamentos/Estoque passou a ser
// do entry-point da IA. Co-locado em _dev p/ manter a preocupação dev isolada.

import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

export default function DevBadge() {
  const navigation = useNavigation()
  if (!__DEV__) return null
  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={() => navigation.navigate(ROUTES.DEV_HUB)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Abrir Dev Hub"
    >
      <Text style={styles.text}>DEV</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.status.warning,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.inverse,
    letterSpacing: 1,
  },
})
