// OnboardingTreatmentStep — passo 3 do wizard: primeiro tratamento (Fase 4 S4.2).
// REUSA o fluxo da Fase 2: WeekdaySelector + TimeSchedulePicker + protocolCreateSchema
// (PO-8). Mock: mock-onboarding-passo3.
//
// Spec 044: NÃO persiste — só valida e guarda no contexto. Medicamento, tratamento e push
// são gravados no passo 4 (escolha do modo), para que voltar não duplique dado.

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ROUTES } from '@navigation/routes'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Clock } = LucideIcons as any
import { protocolCreateSchema, getTodayLocal } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormActions from '@shared/components/form/FormActions'
import WeekdaySelector from '@treatments/components/WeekdaySelector'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import { useToast } from '@shared/components/feedback/Toast'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

// "Dias da semana" → frequência 'semanal' (mostra seletor de dias). 'diário' = Todo dia.
const FREQ_DAILY = 'diário'
const FREQ_WEEKLY = 'semanal'

const FAKE_UUID = '00000000-0000-0000-0000-000000000000'

function FrequencySelectorSegment({ isWeekly, setFrequency }) {
  return (
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
  )
}

function OnboardingReminderCard({ remind, setRemind }) {
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderIcon}>
        <Clock size={18} color={colors.primary[700]} strokeWidth={2} />
      </View>
      <View style={styles.reminderText}>
        <Text style={styles.reminderTitle}>Me avise a hora de tomar</Text>
        <Text style={styles.reminderSub}>
          Notificação no celular — o sistema vai pedir a sua autorização, você precisa permitir.
        </Text>
      </View>
      <Switch
        value={remind}
        onValueChange={setRemind}
        trackColor={{ true: colors.brand.primary, false: colors.border.default }}
        thumbColor={colors.bg.card}
      />
    </View>
  )
}

export default function OnboardingTreatmentStep() {
  // States (R-010)
  const navigation = useNavigation()
  const { medicine, treatment, setTreatment, finish } = useOnboarding()
  const { show } = useToast()
  // Preserva a escolha do lembrete quando o usuário volta do passo 4 (o wizard só grava no fim).
  const [remind, setRemind] = useState(treatment?._remind ?? true)

  // Memos (R-010)
  const initialValues = useMemo(() => {
    if (treatment) {
      // Se o nome do medicamento mudou no Passo 2, sincroniza o nome padrão do tratamento
      const name =
        treatment.name === 'Meu tratamento' || (medicine && treatment.name !== medicine.name)
          ? (medicine?.name ?? 'Meu tratamento')
          : treatment.name

      return {
        ...treatment,
        medicine_id: medicine?.id ?? FAKE_UUID,
        name,
      }
    }
    return {
      medicine_id: medicine?.id ?? FAKE_UUID,
      name: medicine?.name ?? 'Meu tratamento',
      dosage_per_intake: '1',
      frequency: FREQ_DAILY,
      weekdays: [],
      time_schedule: ['08:00'],
      start_date: getTodayLocal(),
    }
  }, [treatment, medicine])

  const form = useFormState(protocolCreateSchema, {
    initialValues,
  })

  // Memos
  const isWeekly = form.values.frequency === FREQ_WEEKLY
  const timeCount = Array.isArray(form.values.time_schedule) ? form.values.time_schedule.length : 0
  // Passo 3 de 3.
  const headerProps = useMemo(
    () => ({ step: 2, totalSteps: 4, onBack: () => navigation.goBack(), onSkip: finish }),
    [navigation, finish],
  )

  // Effects (R-010)
  useEffect(() => {
    setTreatment(form.values)
  }, [form.values, setTreatment])

  // Handlers
  const setFrequency = useCallback((freq) => form.handleChange('frequency', freq), [form])

  // Dose: converte para número já no onChange (paridade com ProtocolFormScreen).
  // Sem isto a string "1" valida contra z.number() no blur → "Use apenas números".
  // Intermediários ("0,", ".") ficam como string (converter agora apagaria a vírgula).
  const handleDoseChange = useCallback(
    (name, raw) => {
      const str = String(raw ?? '')
      if (str === '') {
        form.handleChange(name, '')
        return
      }
      const normalized = str.replace(',', '.')
      // Mantém string em intermediários: termina em "." OU é decimal com zero à
      // direita ("1,50"/"1,0") — converter agora engoliria o zero digitado.
      if (normalized === '.' || normalized.endsWith('.') || (normalized.includes('.') && normalized.endsWith('0'))) {
        form.handleChange(name, str)
        return
      }
      const num = Number(normalized)
      form.handleChange(name, Number.isFinite(num) ? num : str)
    },
    [form],
  )

  // Este passo NÃO persiste nada: valida e guarda no contexto, igual o passo 2 faz com o
  // medicamento. A gravação (medicamento + tratamento + push) acontece no passo 4, no
  // "Continuar" final — assim o usuário pode voltar e revisar sem criar um par duplicado
  // no banco a cada ida e volta.
  const handleContinuar = useCallback(() => {
    // Coerce dose string ("1" / "0,5") → number antes do validate (AP-167).
    const dose = Number(String(form.values.dosage_per_intake ?? '').replace(',', '.'))
    if (!form.validate({ dosage_per_intake: dose })) {
      show('Verifique os campos destacados', { variant: 'error' })
      return
    }
    if (!medicine) {
      show('Dados do medicamento não encontrados.', { variant: 'error' })
      return
    }

    setTreatment({
      ...form.values,
      dosage_per_intake: dose,
      treatment_plan_id: null,
      // Intenção de lembrete: o pedido de permissão de push vive no passo 4, junto da
      // gravação (pedir agora e falhar na gravação queimaria a permissão à toa).
      _remind: remind,
    })
    ;(navigation.navigate as any)(ROUTES.ONBOARDING_STOCK)
  }, [form, medicine, remind, show, setTreatment, navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...headerProps} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>E quando você toma?</Text>
          <Text style={styles.subtitle}>
            Defina a frequência, os horários e a quantidade. A gente te avisa na hora certa.
          </Text>

          <FrequencySelectorSegment isWeekly={isWeekly} setFrequency={setFrequency} />

          {isWeekly ? (
            <WeekdaySelector
              value={form.values.weekdays as any}
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
              value={form.values.time_schedule as any}
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
            onChange={handleDoseChange}
            onBlur={form.handleBlur}
          />

          <OnboardingReminderCard remind={remind} setRemind={setRemind} />
        </ScrollView>

        <FormActions
          primaryLabel="Continuar"
          onPrimary={handleContinuar}
          primaryLoading={false}
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
