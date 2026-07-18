// EvolutionBadge.tsx — badge da Evolução do tratamento, ÚNICO estilo em toda superfície
// (listagem, detalhe, timeline) — spec 029 §2 / F4. Deriva da escada N2 via getEvolutionBadge
// (nunca da coluna N1 titration_status, deprecada).
//
// Cores (mock titration-screens.jsx): "Em evolução" e "Estável" = primary/teal (diferem só pelo
// ícone: evolução ↑ vs check); "Tratamento pausado" = neutro (a evolução acompanha o tratamento).

import { View, Text, StyleSheet } from 'react-native'
 
import * as LucideIcons from 'lucide-react-native'
import { getEvolutionBadge, type TitrationStepLike } from '@dosiq/core'
import { colors, spacing } from '@shared/styles/tokens'

const { TrendingUp, Check } = LucideIcons as any

interface Props {
  steps: TitrationStepLike[] | null | undefined
  paused?: boolean
}

export default function EvolutionBadge({ steps, paused = false }: Props) {
  if (paused) {
    return (
      <View style={[styles.badge, styles.neutral]}>
        <Text style={[styles.text, styles.textNeutral]}>Tratamento pausado</Text>
      </View>
    )
  }
  const badge = getEvolutionBadge(steps)
  const evolving = badge.key === 'em_evolucao'
  // "Em evolução" = azul (secundária/info); "Estável" = teal (primary). Cores distintas dão
  // diferenciação escaneável na lista de tratamentos (pedido do PO no smoke F4).
  return (
    <View style={[styles.badge, evolving ? styles.info : styles.primary]} accessibilityRole="text">
      {evolving ? (
        <TrendingUp size={12} color={colors.status.info} strokeWidth={2.6} />
      ) : (
        <Check size={12} color={colors.primary[700]} strokeWidth={2.8} />
      )}
      <Text style={[styles.text, evolving ? styles.textInfo : styles.textPrimary]}>{badge.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: 999,
  },
  primary: { backgroundColor: colors.primary[100] },
  info: { backgroundColor: colors.status.infoLight },
  neutral: { backgroundColor: colors.neutral[100] },
  text: { fontSize: 11, fontWeight: '700' },
  textPrimary: { color: colors.primary[700] },
  textInfo: { color: colors.status.info },
  textNeutral: { color: colors.text.secondary },
})
