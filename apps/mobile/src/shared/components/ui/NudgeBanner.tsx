import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { X } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

/**
 * Banner de nudge genérico para mobile.
 * Recebe o nudge ativo e callbacks de ação/dismiss.
 * Visibilidade controlada externamente (useNudges).
 */
export default function NudgeBanner({ nudge, onAction, onDismiss }) {
  if (!nudge) return null

  const payload = nudge.action_payload ?? {}
  const emoji = payload.emoji ?? null
  const ctaLabel = payload.label ?? 'Ver mais'

  return (
    <View style={styles.banner} accessibilityRole="alert">
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <View style={styles.content}>
        <Text style={styles.title}>{nudge.title}</Text>
        <Text style={styles.body}>{nudge.body}</Text>
        {nudge.action_type !== 'dismiss_only' && onAction && (
          <TouchableOpacity
            onPress={() => onAction(nudge)}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            <Text style={styles.cta}>{ctaLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onDismiss?.(nudge)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dispensar aviso"
      >
        <X size={18} color={colors.text.secondary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
    padding: spacing[4],
    marginHorizontal: 16,
    marginBottom: spacing[4],
  },
  emoji: {
    fontSize: 24,
    marginRight: 2,
    lineHeight: 28,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  cta: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
