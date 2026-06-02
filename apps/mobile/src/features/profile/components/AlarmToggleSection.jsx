// AlarmToggleSection.jsx — toggle do alarme nativo persistente (Spec 001, FR-007)
//
// Auto-contido: lê/grava a preferência via useAlarmEnabled (AsyncStorage + pub/sub),
// desacoplado da persistência user_settings do resto da tela. Default OFF (opt-in):
// o alarme invasivo só liga por ação consciente do usuário.
//
// R-137/138: peso ≥ 700 nos rótulos, ícone sempre com texto.

import React from 'react'
import { View, Text, StyleSheet, Switch } from 'react-native'
import { AlarmClock } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useAlarmEnabled } from '@platform/alarms/useAlarmEnabled'

export default function AlarmToggleSection() {
  const [enabled, setEnabled] = useAlarmEnabled()

  return (
    <>
      <Text style={styles.sectionLabel}>ALARMES CRÍTICOS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <AlarmClock size={20} color={colors.brand.primary} strokeWidth={2} />
            <View style={styles.flexShrink}>
              <Text style={styles.rowLabel}>Alarme de dose</Text>
              <Text style={styles.rowHint}>
                Toca alto e abre em tela cheia no horário, mesmo no silencioso. Para doses que não podem ser esquecidas.
              </Text>
            </View>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.neutral[200], true: colors.brand.primary }}
            thumbColor={colors.bg.card}
            accessibilityRole="switch"
            accessibilityLabel="Ativar alarme de dose em tela cheia"
          />
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: spacing[6],
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    marginHorizontal: 16,
    padding: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  rowHint: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
})
