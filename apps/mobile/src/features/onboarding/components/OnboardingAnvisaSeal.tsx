// OnboardingAnvisaSeal — selo "Lista oficial da ANVISA" no rodapé do passo "Seu primeiro remédio".
//
// 066 E (C-6, PO 2026-10-18): a base oficial já processada é diferencial frente aos apps internacionais
// (sem nenhuma customização para o Brasil) e estava como letra miúda (13 px cinza). Fica no RODAPÉ — junto
// dos cards competiria com as opções —, mas com destaque: escudo e título na cor da marca. `compact` é a
// versão da Busca, onde a altura vai para a lista e o teclado. Componente puro.

import { View, Text, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const { ShieldCheck } = LucideIcons as any

interface OnboardingAnvisaSealProps {
  compact?: boolean
}

export default function OnboardingAnvisaSeal({ compact = false }: OnboardingAnvisaSealProps) {
  if (compact) {
    return (
      <View style={[styles.seal, styles.sealCompact]} accessibilityRole="text">
        <ShieldCheck size={20} color={colors.brand.primary} strokeWidth={2.4} />
        <Text style={styles.compactText}>Resultados da lista oficial da ANVISA</Text>
      </View>
    )
  }
  return (
    <View style={styles.seal} accessibilityRole="text">
      <ShieldCheck size={28} color={colors.brand.primary} strokeWidth={2.2} />
      <View style={styles.texts}>
        <Text style={styles.title}>Lista oficial da ANVISA</Text>
        <Text style={styles.body}>
          Os remédios vendidos no Brasil, com nome, concentração e laboratório. Você pode corrigir qualquer dado depois.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  seal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.mint,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  sealCompact: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  texts: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  compactText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand.primary,
  },
})
