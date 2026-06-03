// AlarmFullScreen.jsx — tela cheia do alarme de dose (Spec 001, FR-002)
//
// Aberta pelo full-screen intent do Notifee (via AlarmSchedulerBridge → navegação)
// quando a dose dispara. Takeover de tela inteira com 2 botões grandes — não a
// notificação heads-up. A11y idoso: fontes grandes, alto contraste, ícone+texto
// (R-137 peso ≥700 / R-138 nunca ícone solo), hit-targets ≥ 64px.

import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, X, Pill, Clock } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { registerTaken, registerSkip } from '@platform/alarms/quickDoseRegistration'
import { scheduleSnooze } from '@platform/alarms/alarmService'

const BRAND_MARK = require('../../../../assets/dosiq-full-mono.png')

export default function AlarmFullScreen({ navigation, route }) {
  // Ordem R-010: States → Memos → derivados (previne TDZ).
  const [busy, setBusy] = useState(false)
  const data = useMemo(() => route?.params || {}, [route?.params])
  const { medicineName, scheduledTime } = data
  const snoozeMaxed = parseInt(data.snoozeAttempt || '0', 10) >= 3

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate(ROUTES.TABS)
  }, [navigation])

  const onTaken = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await registerTaken(data)
    } finally {
      close()
    }
  }, [busy, data, close])

  const onSnooze = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await scheduleSnooze({
        doseInstanceId: data.doseInstanceId,
        medicineName: data.medicineName,
        scheduledFor: data.scheduledFor,
        toleranceMinutes: data.toleranceMinutes != null ? Number(data.toleranceMinutes) : null,
        currentSnoozeAttempt: parseInt(data.snoozeAttempt || '0', 10),
        data: {
          protocolId: data.protocolId,
          medicineId: data.medicineId,
          quantityTaken: data.quantityTaken,
        },
      })
    } finally {
      close()
    }
  }, [busy, data, close])

  const onSkip = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await registerSkip(data)
    } finally {
      close()
    }
  }, [busy, data, close])

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand.primary} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Branding centralizado no topo — reconhecimento na lock screen */}
        <View style={styles.brandRow}>
          <Image source={BRAND_MARK} style={styles.brandImg} resizeMode="contain" />
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Pill size={56} color={colors.bg.card} strokeWidth={1.75} />
          </View>
          <Text style={styles.kicker}>HORA DA DOSE</Text>
          <Text style={styles.medicine} accessibilityRole="header">
            {medicineName || 'Sua dose'}
          </Text>
          {!!scheduledTime && <Text style={styles.time}>{scheduledTime}</Text>}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnTaken]}
            onPress={onTaken}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Tomei a dose"
          >
            <Check size={28} color={colors.bg.card} strokeWidth={3} />
            <Text style={styles.btnTakenText}>Tomei</Text>
          </TouchableOpacity>

          {!snoozeMaxed && (
            <TouchableOpacity
              style={[styles.btn, styles.btnSnooze]}
              onPress={onSnooze}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Soneca de 5 minutos"
            >
              <Clock size={24} color={colors.bg.card} strokeWidth={2.5} />
              <Text style={styles.btnSnoozeText}>Soneca 5 min</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnSkip]}
            onPress={onSkip}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Pular esta dose"
          >
            <X size={26} color={colors.text.primary} strokeWidth={2.5} />
            <Text style={styles.btnSkipText}>Pular</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[4],
  },
  brandImg: {
    width: 200,
    height: 64, // PNG 800x400 (2:1) → contain rende ~128x64 (maior que o 80x40 inicial)
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  kicker: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing[3],
  },
  medicine: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.bg.card,
    textAlign: 'center',
  },
  time: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing[2],
  },
  actions: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 68,
    borderRadius: borderRadius.lg,
  },
  btnTaken: {
    backgroundColor: colors.status.success,
  },
  btnTakenText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.bg.card,
  },
  btnSnooze: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  btnSnoozeText: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.bg.card,
  },
  btnSkip: {
    backgroundColor: colors.bg.card,
  },
  btnSkipText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
})
