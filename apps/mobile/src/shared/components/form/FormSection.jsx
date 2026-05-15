import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing } from '@shared/styles/tokens'

export default function FormSection({ title, description, children, style }) {
  return (
    <View style={[styles.wrapper, style]}>
      {/* Título em maiúsculas com estilo eyebrow */}
      {title ? (
        <Text style={styles.title}>{title.toUpperCase()}</Text>
      ) : null}

      {/* Descrição (secundária) */}
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {/* Container dos campos com gap entre eles */}
      <View style={styles.fieldsContainer}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  fieldsContainer: {
    gap: spacing[4],
  },
})
