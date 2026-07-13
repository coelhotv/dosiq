import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Box } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

/**
 * StockUpsellCard — nudge de upsell de estoque na TodayScreen (spec 044, F4b / T018).
 *
 * NÃO é modal (R-239): card inline, sem interromper o fluxo. Copy exata do mock
 * (plans/mocks_app_mobile/export/044-dose-only-mode/hoje-card-prompt-habilita-estoque.png),
 * copiada — não reescrita.
 */
interface StockUpsellCardProps {
  /** "Ativar": navega para o saldo inicial (root stack — ver ROUTES.STOCK_INITIAL_BALANCE). */
  onActivate: () => void
  /** "Agora não": dismiss local persistente (useStockUpsell) — não re-insiste. */
  onDismiss: () => void
}

export default function StockUpsellCard({ onActivate, onDismiss }: StockUpsellCardProps) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Box size={22} color={colors.brand.primary} strokeWidth={2} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Quer um aviso quando o remédio estiver acabando?</Text>
          <Text style={styles.subtitle}>
            O Dosiq passa a acompanhar seu estoque e avisa antes de faltar.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
          onPress={onActivate}
          accessibilityRole="button"
          accessibilityLabel="Ativar controle de estoque"
        >
          <Text style={styles.ctaPrimaryText}>Ativar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.ctaNeutral, pressed && styles.ctaPressed]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Agora não, dispensar aviso de estoque"
        >
          <Text style={styles.ctaNeutralText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand.mint,
    borderWidth: 1,
    borderColor: colors.primary[100],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: 20,
    marginBottom: spacing[4],
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.text.primary,
    marginBottom: 4,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  ctaPrimary: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  ctaNeutral: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  ctaNeutralText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  ctaPressed: {
    opacity: 0.85,
  },
})
