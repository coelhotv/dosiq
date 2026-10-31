// MeasureContextChips.tsx — chips de contexto da medida (ADR-070: contexto por família).
// Extraído da MeasureLogSheet (spec 100 B) para o pedido pós-dose usar o MESMO grid — reuso, nunca cópia.
// Toque no chip ativo desmarca (contexto é opcional).

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'

export type MeasureContextConfig = { values: readonly string[]; labels: Record<string, string> }

type Props = {
  ctxConfig: MeasureContextConfig
  context: string | null
  setContext: (next: string | null) => void
}

export default function MeasureContextChips({ ctxConfig, context, setContext }: Props) {
  return (
    <View style={styles.ctxGrid}>
      {ctxConfig.values.map((c) => (
        <Pressable
          key={c}
          onPress={() => { selectionTap(); setContext(context === c ? null : c) }}
          style={[styles.ctxChip, context === c && styles.ctxChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: context === c }}
          accessibilityLabel={ctxConfig.labels[c]}
        >
          <Text style={[styles.ctxChipText, context === c && styles.ctxChipTextActive]}>
            {ctxConfig.labels[c]}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  ctxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[3] },
  ctxChip: {
    paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100], minHeight: 44, justifyContent: 'center',
  },
  ctxChipActive: { backgroundColor: colors.status.infoLight, borderWidth: 1, borderColor: colors.status.info },
  ctxChipText: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
  ctxChipTextActive: { color: colors.status.info, fontWeight: '700' },
})
