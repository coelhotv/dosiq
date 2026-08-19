// AlarmFullScreen.jsx — tela cheia do alarme de dose (Spec 001, FR-002)
//
// Aberta pelo full-screen intent do Notifee (via AlarmSchedulerBridge → navegação)
// quando a dose dispara. Takeover de tela inteira com 2 botões grandes — não a
// notificação heads-up. A11y idoso: fontes grandes, alto contraste, ícone+texto
// (R-137 peso ≥700 / R-138 nunca ícone solo), hit-targets ≥ 64px.

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, X, Pill, Clock } from 'lucide-react-native'
import { formatMedicineConcentration, formatDoseItem } from '@dosiq/core'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { registerTaken, registerSkip } from '@platform/alarms/quickDoseRegistration'
import { scheduleSnooze, cancelAlarm } from '@platform/alarms/alarmService'

const BRAND_MARK = require('../../../../assets/dosiq-full-mono.png')

/**
 * Auto-dismiss (US2/FR-004): revalida o status das instâncias no mount. Se NENHUMA
 * está mais `pending` (resolvida por outra superfície/web/bot ou corrida) → cancela o
 * alarme e fecha (`onClose`). Grupo: só fecha quando TODAS já saíram de `pending`.
 * Falha de leitura NÃO fecha a tela (não esconder alarme legítimo por erro de rede).
 */
function useAlarmAutoDismiss({ isGrouped, doseInstanceId, doseInstanceIds, onClose }) {
  useEffect(() => {
    let cancelled = false
    async function revalidate() {
      const ids = isGrouped
        ? (doseInstanceIds ? String(doseInstanceIds).split(',').filter(Boolean) : [])
        : (doseInstanceId ? [doseInstanceId] : [])
      if (ids.length === 0) return
      try {
        const { data: rows, error } = await supabase
          .from('dose_instances')
          .select('id,status')
          .in('id', ids)
        if (error || cancelled || !rows || rows.length === 0) return
        if (rows.some((r) => r.status === 'pending')) return
        // O alarme agrupado é agendado com id = timestamp (recebido aqui como doseInstanceId),
        // não com os ids individuais (que só existem como linhas em dose_instances). Incluir o
        // doseInstanceId garante o cancelamento do trigger/notif do grupo.
        const toCancel = isGrouped ? [doseInstanceId, ...ids] : ids
        for (const id of toCancel) {
          try { await cancelAlarm(id) } catch { /* best-effort */ }
        }
        if (!cancelled) onClose()
      } catch {
        /* leitura falhou → mantém a tela aberta */
      }
    }
    revalidate()
    return () => { cancelled = true }
  }, [isGrouped, doseInstanceId, doseInstanceIds, onClose])
}


/**
 * Exibição clínica da dose (US3/FR-006/007): single → nome + concentração + quantidade
 * a tomar; agrupado → uma linha por dose com a mesma regra. Usa os formatters do core
 * (R-231) — unidade correta p/ sólido/líquido/injetável (012), sem "un." hardcoded.
 */
function DoseHeadline({ data, isGrouped, medicineName }) {
  const groupedDosesList = useMemo(() => {
    if (!isGrouped || !data.groupedDoses) return []
    try {
      return JSON.parse(data.groupedDoses)
    } catch {
      return []
    }
  }, [isGrouped, data.groupedDoses])

  if (isGrouped) {
    return (
      <View style={styles.groupedList}>
        {groupedDosesList.map((d, index) => {
          const conc = formatMedicineConcentration({
            dosage_per_pill: d.dosagePerPill,
            dosage_unit: d.dosageUnit,
            concentration_volume_ml: d.concentrationVolumeMl,
          })
          const qty = formatDoseItem({
            dosagePerIntake: d.dosagePerIntake,
            intakeUnit: d.intakeUnit,
            dosageUnit: d.dosageUnit,
            dosagePerPill: d.dosagePerPill,
            unitsPerMl: d.unitsPerMl,
          })
          return (
            <View key={d.instanceId || index} style={styles.groupedRow} accessibilityRole="text">
              <Text style={styles.groupedItem}>
                💊 {d.medicineName}{conc ? ` (${conc})` : ''}
              </Text>
              {!!qty && <Text style={styles.groupedQty}>Tomar: {qty}</Text>}
            </View>
          )
        })}
      </View>
    )
  }

  const concentration = formatMedicineConcentration({
    dosage_per_pill: data.dosagePerPill,
    dosage_unit: data.dosageUnit,
    concentration_volume_ml: data.concentrationVolumeMl,
  })
  // quantityTaken vem de route.params como string; Number('')||1 converteria 0→1
  // (regressão em desmame/titulação). Só faz fallback p/ 1 quando ausente/NaN.
  const parsedIntake = Number(data.quantityTaken)
  const quantity = formatDoseItem({
    dosagePerIntake: Number.isFinite(parsedIntake) ? parsedIntake : 1,
    intakeUnit: data.intakeUnit,
    dosageUnit: data.dosageUnit,
    dosagePerPill: data.dosagePerPill,
    unitsPerMl: data.unitsPerMl,
  })
  // Ordem (item 3→5): horário → nome + concentração → "Dose:" + quantidade na unidade certa.
  return (
    <>
      {!!data.scheduledTime && <Text style={styles.timeTop}>{data.scheduledTime}</Text>}
      <Text style={styles.medicine} accessibilityRole="header">
        {medicineName || 'Sua dose'}
        {!!concentration && ' '}
        {!!concentration && <Text style={styles.concentrationInline}>{concentration}</Text>}
      </Text>
      {!!quantity && (
        <Text style={styles.quantity} accessibilityRole="text">
          Dose: {quantity}
        </Text>
      )}
    </>
  )
}


export default function AlarmFullScreen({ navigation, route }) {
  // Ordem R-010: States → Memos → derivados (previne TDZ).
  const [busy, setBusy] = useState(false)
  const data = useMemo(() => route?.params || {}, [route?.params])
  const { medicineName, scheduledTime } = data
  const snoozeMaxed = parseInt(data.snoozeAttempt || '0', 10) >= 3
  const isGrouped = data.isGrouped === 'true'

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate(ROUTES.TABS)
  }, [navigation])

  useAlarmAutoDismiss({
    isGrouped,
    doseInstanceId: data.doseInstanceId,
    doseInstanceIds: data.doseInstanceIds,
    onClose: close,
  })

  // 067/B (FR-013, Princípio IX): recusa — do client (A2) ou do banco (RPC) — é MOSTRADA.
  // Fechar a tela em silêncio é o "nada aconteceu" que a spec existe para eliminar: a paciente
  // sai acreditando que registrou.
  const reportRefusal = useCallback((result) => {
    if (!result || result.success !== false || !result.message) return
    Alert.alert('Dose não registrada', String(result.message))
  }, [])

  const onTaken = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      reportRefusal(await registerTaken(data))
    } finally {
      close()
    }
  }, [busy, data, close, reportRefusal])

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
        isCritical: data.isCritical === 'true' || data.isCritical === true,
        data: {
          ...data,
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
      reportRefusal(await registerSkip(data))
    } finally {
      close()
    }
  }, [busy, data, close, reportRefusal])

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
            {isGrouped ? (
              <Pill size={56} color={colors.bg.card} strokeWidth={1.75} />
            ) : (
              // Ícone contextual da forma/tipo (012 Fase A) — mesma fonte das demais telas.
              <MedicineIcon
                medicine={{ type: data.medicineType, presentation: data.presentation, dosage_unit: data.dosageUnit }}
                size={56}
                color={colors.bg.card}
                strokeWidth={1.75}
              />
            )}
          </View>
          <Text style={styles.kicker}>
            {isGrouped ? 'DOSES ESSENCIAIS' : 'HORA DA DOSE'}
          </Text>

          <DoseHeadline data={data} isGrouped={isGrouped} medicineName={medicineName} />

          {/* Grupo mantém o horário ao final; single renderiza no topo (DoseHeadline). */}
          {isGrouped && !!scheduledTime && <Text style={styles.time}>{scheduledTime}</Text>}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnTaken]}
            onPress={onTaken}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={isGrouped ? 'Tomar todas as doses' : 'Tomei a dose'}
          >
            <Check size={28} color={colors.bg.card} strokeWidth={3} />
            <Text style={styles.btnTakenText}>{isGrouped ? 'Tomar todas' : 'Tomei'}</Text>
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
            accessibilityLabel={isGrouped ? 'Pular todas as doses' : 'Pular esta dose'}
          >
            <X size={26} color={colors.text.primary} strokeWidth={2.5} />
            <Text style={styles.btnSkipText}>{isGrouped ? 'Pular todas' : 'Pular'}</Text>
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
    backgroundColor: colors.opacity.white18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  kicker: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.opacity.white85,
    marginBottom: spacing[3],
  },
  timeTop: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.opacity.white90,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  medicine: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.bg.card,
    textAlign: 'center',
  },
  concentrationInline: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.opacity.white90,
  },
  quantity: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.bg.card,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  groupedList: {
    width: '100%',
    marginVertical: spacing[4],
    gap: spacing[3],
    alignItems: 'center',
  },
  groupedRow: {
    alignItems: 'center',
    gap: spacing[1],
  },
  groupedItem: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.bg.card,
    textAlign: 'center',
  },
  groupedQty: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.opacity.white90,
    textAlign: 'center',
  },
  time: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.opacity.white90,
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
    backgroundColor: colors.opacity.white22,
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
