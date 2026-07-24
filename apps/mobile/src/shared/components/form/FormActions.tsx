import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

export default function FormActions({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading,
  secondaryLabel = undefined,
  onSecondary = undefined,
  destructive = false,
}) {
  // Cor de fundo do botão primário (destruidor ou normal)
  const primaryBgColor = destructive ? colors.status.error : colors.primary[700]
  // Footer sticky fora de SafeAreaView bottom nos callers (edges=['top']) — edge-to-edge
  // Android 16 desenha por baixo da gesture bar sem este inset (T041, spec 055 PR 1.4).
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.row, { paddingBottom: Math.max(spacing[3], insets.bottom) }]}>
      {/* Botão primário */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: primaryBgColor },
          (primaryDisabled || primaryLoading) && styles.buttonDisabled,
        ]}
        onPress={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        activeOpacity={0.8}
      >
        {primaryLoading ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Text style={styles.primaryLabel}>{primaryLabel}</Text>
        )}
      </TouchableOpacity>

      {/* Botão secundário (opcional) */}
      {secondaryLabel ? (
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { borderColor: colors.border.default },
          ]}
          onPress={onSecondary}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  primaryButton: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text.inverse,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.bg.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: {
    fontWeight: '600',
    fontSize: 15,
    color: colors.text.primary,
  },
})
