// StatusBadge.jsx — badge de status reutilizável para o mobile
// Padrão visual: fundo colorido suave com texto em cor sólida

import { View, Text, StyleSheet } from 'react-native'
import { colors, borderRadius, spacing } from '../../styles/tokens'

/**
 * @param {{
 *   label: string,
 *   type: 'success' | 'warning' | 'error' | 'info' | 'neutral',
 *   style?: any
 * }} props
 */
export default function StatusBadge({ label, type = 'neutral', style }) {
  const badgeStyle = [
    styles.badge,
    styles[`badge_${type}`],
    style
  ]

  const textStyle = [
    styles.text,
    styles[`text_${type}`]
  ]

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  
  // Success
  badge_success: { backgroundColor: colors.status.success + '20' },
  text_success: { color: colors.status.success },
  
  // Warning
  badge_warning: { backgroundColor: colors.status.warning + '20' },
  text_warning: { color: colors.status.warning },
  
  // Error
  badge_error: { backgroundColor: colors.status.error + '20' },
  text_error: { color: colors.status.error },
  
  // Info
  badge_info: { backgroundColor: colors.status.info + '20' },
  text_info: { color: colors.status.info },
  
  // Neutral
  badge_neutral: { backgroundColor: colors.neutral[200] },
  text_neutral: { color: colors.neutral[600] },
})
