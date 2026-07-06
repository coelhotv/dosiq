// AlarmToggleSection.jsx — APOSENTADO em Spec 010 (controle por-tratamento)
//
// Banner de migração: visível SOMENTE para usuários que tinham o toggle global
// ligado na v0.9.x (@dosiq/alarm-enabled = 'true'). Usuários novos nunca viram
// o toggle global — exibir o banner seria ruído sem contexto.

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { AlarmClock } = LucideIcons as any
import { colors, spacing, borderRadius, shadows } from '@shared/styles/tokens'
import { isAlarmEnabled } from '@platform/alarms/alarmEnabledStore'

export default function AlarmToggleSection() {
  const [hadAlarmEnabled, setHadAlarmEnabled] = useState(false)

  useEffect(() => {
    isAlarmEnabled().then(setHadAlarmEnabled).catch(() => {})
  }, [])

  if (!hadAlarmEnabled) return null

  return (
    <>
      <Text style={styles.sectionLabel}>ALARMES CRÍTICOS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <AlarmClock size={20} color={colors.brand.primary} strokeWidth={2} />
          <View style={styles.textBlock}>
            <Text style={styles.rowLabel}>Configure em tratamentos</Text>
            <Text style={styles.rowHint}>
              O alarme crítico agora é definido por tratamento. Edite um tratamento e
              ative "Alertas críticos" para as doses que não podem ser esquecidas.
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
