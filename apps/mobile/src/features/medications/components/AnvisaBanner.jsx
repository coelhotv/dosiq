// AnvisaBanner.jsx — Banner verde para busca ANVISA no create medicine form
// Componente puro (sem state, sem effects)

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Search } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'

export function AnvisaBanner({ onPress }) {
  const handlePress = () => {
    lightTap()
    onPress?.()
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Ícone Search */}
      <View style={styles.iconContainer}>
        <Search size={20} color={colors.primary[700]} strokeWidth={2.5} />
      </View>

      {/* Bloco de textos */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>Buscar na base ANVISA</Text>
        <Text style={styles.subtitle}>
          Preenche nome, princípio ativo e categoria automaticamente
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: spacing[3],
    marginTop: 2, // Align com primeira linha de texto
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
})
