import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { AlarmClock, X } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { hasSeenAlarmNudge, markAlarmNudgeSeen } from '@platform/alarms/alarmEnabledStore'

/**
 * AlarmNudgeCard — anúncio passivo da feature "Alarmes críticos" (Spec 001, FR-009).
 *
 * Espelha o TzNudgeCard (R-253 / lançamento do fuso): convite dispensável,
 * mostrado 1× (flag persistido), com CTA que leva direto ao toggle liga/desliga
 * nas Preferências de notificação. NÃO ativa nada — respeita o opt-in (FR-007).
 */
export default function AlarmNudgeCard() {
  const navigation = useNavigation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    hasSeenAlarmNudge()
      .then((seen) => {
        if (active && !seen) setVisible(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const dismiss = useCallback(async () => {
    setVisible(false)
    await markAlarmNudgeSeen()
  }, [])

  // CTA só navega — o card permanece como atalho até o usuário fechar no X.
  const goToToggle = useCallback(() => {
    navigation.navigate(ROUTES.NOTIFICATION_PREFERENCES)
  }, [navigation])

  if (!visible) return null

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.iconWrap}>
        <AlarmClock size={22} color={colors.primary[700]} strokeWidth={1.75} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Novidade: alarmes críticos</Text>
        <Text style={styles.text}>
          Agora o Dosiq pode tocar um alarme na hora da dose. 
          Ative se você tem remédios que não podem ser esquecidos.
        </Text>
        <TouchableOpacity
          onPress={goToToggle}
          accessibilityRole="button"
          accessibilityLabel="Ativar alarmes críticos"
        >
          <Text style={styles.cta}>Ativar alarmes críticos</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dispensar aviso"
      >
        <X size={18} color={colors.text.secondary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200] || colors.primary[100],
    padding: spacing[4],
    marginHorizontal: 16,
    marginBottom: spacing[6],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  text: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  cta: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
