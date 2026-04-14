// SectionCard.jsx — container agrupador com título opcional
// Padroniza o espaçamento e bordas das sessões do app

import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '../../styles/tokens'

/**
 * @param {{
 *   title?: string,
 *   children: React.ReactNode,
 *   style?: any,
 *   headerAction?: React.ReactNode
 * }} props
 */
export default function SectionCard({ title, children, style, headerAction }) {
  return (
    <View style={[styles.container, style]}>
      {(title || headerAction) && (
        <View style={styles.header}>
          {title && (
            typeof title === 'string' ? (
              <Text style={styles.title}>{title}</Text>
            ) : (
              <View style={styles.titleContainer}>{title}</View>
            )
          )}
          {headerAction && <View>{headerAction}</View>}
        </View>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing[2],
  },
  content: {
    // Espaçamento interno extra se necessário
  }
})
