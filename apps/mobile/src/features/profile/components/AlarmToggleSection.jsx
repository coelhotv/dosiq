// AlarmToggleSection.jsx — APOSENTADO em Spec 010 (controle por-tratamento)
//
// O toggle global foi substituído pelo toggle "Alerta crítico" no formulário de
// cada tratamento. Esta seção agora exibe um banner de migração orientando o usuário.

import { View, Text, StyleSheet } from 'react-native'
import { AlarmClock } from 'lucide-react-native'
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'

export default function AlarmToggleSection() {
  return (
    <>
      <Text style={styles.sectionLabel}>ALARMES CRÍTICOS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <AlarmClock size={20} color={colors.brand.primary} strokeWidth={2} />
          <View style={styles.textBlock}>
            <Text style={styles.rowLabel}>Configure por tratamento</Text>
            <Text style={styles.rowHint}>
              O alarme crítico agora é definido em cada tratamento. Abra um tratamento e
              ative "Alerta crítico" para as doses que não podem ser esquecidas.
            </Text>
          </View>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[5],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[3],
  },
  textBlock: {
    flex: 1,
    gap: spacing[1],
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowHint: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 17,
  },
})
