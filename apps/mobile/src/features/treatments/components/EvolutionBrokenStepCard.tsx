// EvolutionBrokenStepCard.tsx — card de "escada quebrada" na Evolução do tratamento (spec 029 §7.3).
// Componente PURO de apresentação: sem rede, sem hook de dados, sem navegação própria — só props
// e callbacks. Substitui uma etapa futura na timeline quando o medicamento dela foi excluído ou
// arquivado. Tom AMBER (mesma família de EvolutionOverdueBanner) — nunca deixa o estado quebrado
// sem uma saída: o botão é sempre nomeado ("Editar etapa N"), nunca genérico ("Corrigir").

import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { TriangleAlert } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface EvolutionBrokenStepCardProps {
  /** Número (1-based) da etapa futura afetada. */
  stepNumber: number
  /** Nome do medicamento excluído/arquivado que a etapa referenciava. */
  medicineName: string
  /** "Editar etapa N" — leva à edição da etapa para escolher outro medicamento. */
  onEdit: () => void
}

export default function EvolutionBrokenStepCard({ stepNumber, medicineName, onEdit }: EvolutionBrokenStepCardProps) {
  const title = `O medicamento ${medicineName} foi excluído.`
  const body = 'Edite a etapa para escolher o medicamento. Até lá, a evolução segue normalmente na etapa vigente.'

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${title} ${body}`}>
      <View style={styles.header}>
        <TriangleAlert size={17} color={colors.status.warning} strokeWidth={1.9} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Editar etapa ${stepNumber}`}
      >
        <Text style={styles.ctaText}>Editar etapa {stepNumber}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.status.warningLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.warningLight,
    padding: spacing[3],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.status.warning,
  },
  body: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 18,
  },
  cta: {
    minHeight: 48,
    alignSelf: 'flex-start',
    backgroundColor: colors.status.warning,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[1],
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  ctaPressed: {
    opacity: 0.85,
  },
})
