// OnboardingTreatmentStep — passo 2 do wizard: primeiro tratamento (Fase 4 S4.2).
// REUSA o fluxo da Fase 2: protocolService.create + WeekdaySelector +
// TimeSchedulePicker + protocolCreateSchema (PO-8). Mock: mock-onboarding-passo3.

import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Clock } from 'lucide-react-native'
import { protocolCreateSchema, getTodayLocal } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormActions from '@shared/components/form/FormActions'
import WeekdaySelector from '@treatments/components/WeekdaySelector'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import { useToast } from '@shared/components/feedback/Toast'
import { protocolService } from '@treatments/services/protocolService'
import { requestPushPermission } from '@platform/notifications/requestPushPermission'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

// "Dias da semana" → frequência 'semanal' (mostra seletor de dias). 'diário' = Todo dia.
const FREQ_DAILY = 'diário'
const FREQ_WEEKLY = 'semanal'

export default function OnboardingTreatmentStep() {
  // States (R-010)
  const navigation = useNavigation()
  const { medicine, finish } = useOnboarding()
  const { show } = useToast()
  const [remind, setRemind] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const form = useFormState(protocolCreateSchema, {
    initialValues: {
      medicine_id: medicine?.id ?? '',
      name: medicine?.name ?? 'Meu tratamento',
      dosage_per_intake: '1',
      frequency: FREQ_DAILY,
      weekdays: [],
      time_schedule: ['08:00'],
      start_date: getTodayLocal(),
    },
  })

  // Memos
  const isWeekly = form.values.frequency === FREQ_WEEKLY
  const timeCount = Array.isArray(form.values.time_schedule) ? form.values.time_schedule.length : 0
  // Passo 3 de 3.
  const headerProps = useMemo(
    () => ({ step: 2, totalSteps: 3, onBack: () => navigation.goBack(), onSkip: finish }),
    [navigation, finish],
  )

  // Handlers
  const setFrequency = useCallback((freq) => form.handleChange('frequency', freq), [form])

  const handleConcluir = useCallback(async () => {
    // Coerce dose string ("1" / "0,5") → number antes do validate (AP-167).
    const dose = Number(String(form.values.dosage_per_intake ?? '').replace(',', '.'))
    if (!form.validate({ dosage_per_intake: dose })) {
      show('Verifique os campos destacados', { variant: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await protocolService.create({
        ...form.values,
        dosage_per_intake: dose,
        treatment_plan_id: null,
      })
      if (remind) await requestPushPermission().catch(() => {})
      await finish()
    } catch (err) {
      setSubmitting(false)
      show(err?.message ?? 'Erro ao criar tratamento', { variant: 'error' })
    }
  }, [form, remind, show, finish])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...headerProps} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Quando você toma?</Text>
          <Text style={styles.subtitle}>
            Defina a frequência e os horários. A gente avisa na hora certa.
          </Text>

          {/* Frequência — segmented */}
          <View>
            <Text style={styles.label}>Frequência</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentBtn, !isWeekly && styles.segmentBtnActive]}
                onPress={() => setFrequency(FREQ_DAILY)}
                accessibilityRole="button"
                accessibilityState={{ selected: !isWeekly }}
              >
                <Text style={[styles.segmentText, !isWeekly && styles.segmentTextActive]}>Todo dia</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentBtn, isWeekly && styles.segmentBtnActive]}
                onPress={() => setFrequency(FREQ_WEEKLY)}
                accessibilityRole="button"
                accessibilityState={{ selected: isWeekly }}
              >
                <Text style={[styles.segmentText, isWeekly && styles.segmentTextActive]}>Dias da semana</Text>
              </Pressable>
            </View>
          </View>

          {isWeekly ? (
            <WeekdaySelector
              value={form.values.weekdays}
              onChange={(next) => form.handleChange('weekdays', next)}
              error={form.touched.weekdays ? form.errors.weekdays : null}
            />
          ) : null}

          {/* Horários */}
          <View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Horários</Text>
              <Text style={styles.labelHint}>{timeCount} {timeCount === 1 ? 'horário' : 'horários'}</Text>
            </View>
            <TimeSchedulePicker
              value={form.values.time_schedule}
              onChange={(next) => form.handleChange('time_schedule', next)}
              error={form.touched.time_schedule ? form.errors.time_schedule : null}
            />
          </View>

          {/* Quantidade por dose */}
          <FormInput
            name="dosage_per_intake"
            label="Quantidade por dose (unidade)"
            keyboardType="decimal-pad"
            value={String(form.values.dosage_per_intake ?? '')}
            error={form.touched.dosage_per_intake ? form.errors.dosage_per_intake : undefined}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
          />

          {/* Lembrete */}
          <View style={styles.reminderCard}>
            <View style={styles.reminderIcon}>
              <Clock size={18} color={colors.primary[700]} strokeWidth={2} />
            </View>
            <View style={styles.reminderText}>
              <Text style={styles.reminderTitle}>Me avise a hora de tomar</Text>
              <Text style={styles.reminderSub}>Notificação no celular — o sistema vai pedir sua autorização.</Text>
            </View>
            <Switch
              value={remind}
              onValueChange={setRemind}
              trackColor={{ true: colors.brand.primary, false: colors.border.default }}
              thumbColor={colors.bg.card}
            />
          </View>
        </ScrollView>

        <FormActions
          primaryLabel="Concluir"
          onPrimary={handleConcluir}
          primaryLoading={submitting}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 21,
    marginTop: -spacing[3],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  labelHint: {
    fontSize: 12,
    color: colors.text.muted,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  segmentBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  segmentTextActive: {
    color: colors.text.inverse,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[200] || colors.primary[100],
    backgroundColor: colors.bg.card,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  reminderSub: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
    lineHeight: 16,
  },
})
