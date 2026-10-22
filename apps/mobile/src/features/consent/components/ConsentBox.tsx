// ConsentBox.tsx — caixa de consentimento da v0.4 (spec 096: `dq2a`, `dq1a`, `enableB`; espelho do
// ConsentBox web).
//
// Uma caixa = uma autorização (guarda 2). Pill OBRIGATÓRIA (A, verde da marca) / OPCIONAL (B, neutro).
// Caixa e frase são UM alvo (`checkbox` com o texto como nome falado). Nasce desmarcada (guarda 1).
// "Detalhes ›" à direita, na linha do título (guarda 8) — quem abre a folha é o host (`onDetails`),
// porque a folha precisa cobrir a tela inteira e, dentro de um Modal, não pode ser outro Modal (iOS).
// Erro: o CTA nunca fica cinza (D-8) — tocar sem marcar leva o foco do leitor de tela à caixa e a
// mensagem sai como `alert`.

import { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, AccessibilityInfo, findNodeHandle } from 'react-native'
import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export type ConsentBoxVariant = 'health' | 'transfer'

interface ConsentBoxProps {
  variant: ConsentBoxVariant
  checked: boolean
  onChange: (checked: boolean) => void
  onDetails: () => void
  disabled?: boolean
  errorMessage?: string | null
}

const META = {
  health: { pill: 'OBRIGATÓRIA', label: HEALTH_CONSENT_COPY.label },
  transfer: { pill: 'OPCIONAL', label: TRANSFER_CONSENT_COPY.label },
} as const

export default function ConsentBox({
  variant,
  checked,
  onChange,
  onDetails,
  disabled = false,
  errorMessage = null,
}: ConsentBoxProps) {
  const rowRef = useRef<View>(null)
  const { pill, label } = META[variant]

  useEffect(() => {
    if (!errorMessage) return
    const node = rowRef.current ? findNodeHandle(rowRef.current) : null
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
  }, [errorMessage])

  return (
    <View style={[styles.card, errorMessage ? styles.cardError : null]}>
      <View style={styles.header}>
        <View style={[styles.pill, variant === 'health' ? styles.pillRequired : styles.pillOptional]}>
          <Text style={[styles.pillText, variant === 'health' ? styles.pillTextRequired : styles.pillTextOptional]}>
            {pill}
          </Text>
        </View>
        <Pressable onPress={onDetails} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Detalhes da autorização ${pill.toLowerCase()}`}>
          <Text style={styles.details}>Detalhes ›</Text>
        </Pressable>
      </View>

      <Pressable
        ref={rowRef}
        onPress={() => !disabled && onChange(!checked)}
        disabled={disabled}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={label}
        accessibilityHint={errorMessage ?? undefined}
      >
        <View style={[styles.box, checked && styles.boxChecked, errorMessage ? styles.boxError : null]}>
          {checked ? <View style={styles.boxDot} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>

      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {errorMessage}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.card,
  },
  cardError: {
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.full },
  pillRequired: { backgroundColor: colors.brand.primary },
  pillOptional: { backgroundColor: colors.neutral[100] },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, fontFamily: typography.fontFamily.bold },
  pillTextRequired: { color: colors.text.inverse },
  pillTextOptional: { color: colors.neutral[600] },
  details: { fontSize: 14, fontWeight: '600', color: colors.brand.primary },
  // Alvo ≥ 48 px: a linha inteira (caixa + frase) é o toque.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
  },
  boxChecked: { backgroundColor: colors.brand.primary },
  boxError: { borderColor: colors.status.error },
  boxDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.text.inverse },
  label: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text.primary },
  error: { fontSize: 13, fontWeight: '600', color: colors.status.error },
})
