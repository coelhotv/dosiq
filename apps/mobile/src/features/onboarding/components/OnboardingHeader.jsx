// OnboardingHeader — cabeçalho do wizard: voltar (opcional) + progress dots + Pular.
// Mock: mock-onboarding-passo2/3.

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing } from '@shared/styles/tokens'

export default function OnboardingHeader({ step, totalSteps = 2, onBack, onSkip }) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.dots}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Pular onboarding"
          >
            <Text style={styles.skip}>Pular</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  side: {
    width: 56,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.default,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.brand.primary,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
})
