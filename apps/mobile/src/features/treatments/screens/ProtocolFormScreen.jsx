// ProtocolFormScreen.jsx — formulário CREATE + EDIT de tratamento (Fase 2 T2.6/T2.7).
// Spec EXEC_SPEC_FASE2_PROTOCOLOS.md §3.4 / §3.6 / §3.8.
//
// Modo: route.params.id presente → EDIT; ausente → CREATE.
// route.params.treatment_plan_id (create only) → pré-seleciona plano.
//
// State/lógica delegados a useProtocolFormState + useProtocolFormSubmit.
// Render das 6 seções delegado a ProtocolFormBody.
//
// Errors UX (T2.8): banner topo + scroll-to-top on validate fail.

import { useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { ArrowLeft, AlertCircle } from 'lucide-react-native'
import { getTodayLocal, formatLocalDate } from '@dosiq/core'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import FormActions from '@shared/components/form/FormActions'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import { useToast } from '@shared/components/feedback/Toast'
import { lightTap } from '@shared/utils/haptics'
import { colors, spacing, typography, borderRadius } from '@shared/styles/tokens'
import MedicineSelectorSheet from '@treatments/components/MedicineSelectorSheet'
import ProtocolFormBody from '@treatments/components/ProtocolFormBody'
import { useProtocolMutation } from '@treatments/hooks/useProtocolMutation'
import { useProtocolFormState } from '@treatments/hooks/useProtocolFormState'
import { useProtocolFormSubmit } from '@treatments/hooks/useProtocolFormSubmit'
import { ROUTES } from '@navigation/routes'

export default function ProtocolFormScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const route = useRoute()
  const editId = route.params?.id ?? null
  const isEdit = !!editId
  const presetPlanId = isEdit ? null : (route.params?.treatment_plan_id ?? null)
  const todayIso = useMemo(() => getTodayLocal(), [])
  const { show } = useToast()
  const scrollRef = useRef(null)

  const {
    form,
    medicine,
    selectMedicine,
    sheetOpen,
    setSheetOpen,
    pendingReopenSheet,
    setPendingReopenSheet,
    plans,
    planField,
    changePlanField,
    existingLoading,
    existingError,
  } = useProtocolFormState({ editId, todayIso, presetPlanId })

  const mutation = useProtocolMutation()

  const scrollToTop = useCallback(
    () => scrollRef.current?.scrollTo?.({ y: 0, animated: true }),
    []
  )

  const { submit, submitting } = useProtocolFormSubmit({
    editId,
    form,
    planField,
    mutation,
    show,
    onValidateFail: scrollToTop,
  })

  // Memos
  const visibleErrorCount = useMemo(() => {
    const errorKeys = Object.keys(form.errors)
    return errorKeys.filter((k) => form.touched[k]).length
  }, [form.errors, form.touched])

  // Effects — reabrir sheet ao retornar de MedicineFormScreen
  useFocusEffect(
    useCallback(() => {
      if (pendingReopenSheet) {
        setPendingReopenSheet(false)
        setSheetOpen(true)
      }
    }, [pendingReopenSheet, setPendingReopenSheet, setSheetOpen])
  )

  // Handlers
  const goBack = useCallback(() => {
    lightTap()
    navigation.goBack()
  }, [navigation])

  const handleOpenSheet = useCallback(() => {
    lightTap()
    setSheetOpen(true)
  }, [setSheetOpen])

  const handleCloseSheet = useCallback(() => setSheetOpen(false), [setSheetOpen])

  const handleCreateNewMedicine = useCallback(() => {
    setPendingReopenSheet(true)
    navigation.navigate(ROUTES.MEDICINE_CREATE)
  }, [navigation, setPendingReopenSheet])

  const handleDoseChange = useCallback(
    (name, raw) => {
      // Decimais "0,5" / "0.5". Intermediários ("0,", "0.", ".") mantidos como
      // STRING — converter agora apagaria a vírgula. Coerce no submit.
      const str = String(raw ?? '')
      if (str === '') {
        form.handleChange(name, '')
        return
      }
      const normalized = str.replace(',', '.')
      const isIntermediate = normalized === '.' || normalized.endsWith('.')
      if (isIntermediate) {
        form.handleChange(name, str)
        return
      }
      const num = Number(normalized)
      form.handleChange(name, Number.isFinite(num) ? num : str)
    },
    [form]
  )

  const handleStartDateChange = useCallback(
    (_name, date) => form.handleChange('start_date', date ? formatLocalDate(date) : null),
    [form]
  )
  const handleEndDateChange = useCallback(
    (_name, date) => form.handleChange('end_date', date ? formatLocalDate(date) : null),
    [form]
  )

  // Render — edge cases EDIT
  if (existingLoading) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando tratamento…" />
      </ScreenContainer>
    )
  }
  if (existingError) {
    return (
      <ScreenContainer>
        <ErrorState message={existingError} onRetry={() => navigation.goBack()} />
      </ScreenContainer>
    )
  }

  const appbarTitle = isEdit ? 'Editar tratamento' : 'Novo tratamento'
  const primaryLabel = isEdit ? 'Salvar alterações' : 'Criar tratamento'

  return (
    <ScreenContainer>
      <AppBar title={appbarTitle} onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorsBanner count={visibleErrorCount} />

          <ProtocolFormBody
            form={form}
            medicine={medicine}
            onOpenMedicineSheet={handleOpenSheet}
            plans={plans}
            planField={planField}
            onPlanFieldChange={changePlanField}
            onDoseChange={handleDoseChange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <FormActions
          primaryLabel={primaryLabel}
          onPrimary={submit}
          primaryLoading={submitting || mutation.isLoading}
          secondaryLabel="Cancelar"
          onSecondary={goBack}
        />
      </KeyboardAvoidingView>

      <MedicineSelectorSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        onSelect={selectMedicine}
        onCreateNew={handleCreateNewMedicine}
        selectedId={medicine?.id}
      />
    </ScreenContainer>
  )
}

function AppBar({ title, onBack }) {
  return (
    <View style={styles.appbar}>
      <Pressable
        onPress={onBack}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={12}
      >
        <ArrowLeft size={24} color={colors.text.primary} />
      </Pressable>
      <Text style={styles.appbarTitle}>{title}</Text>
      <View style={styles.appbarSpacer} />
    </View>
  )
}

function ErrorsBanner({ count }) {
  if (count === 0) return null
  const msg =
    count === 1
      ? 'Preencha o campo obrigatório para salvar'
      : `Preencha os ${count} campos obrigatórios para salvar`
  return (
    <View style={styles.errorsBanner} accessibilityRole="alert">
      <AlertCircle size={18} color={colors.status.error} />
      <Text style={styles.errorsBannerText}>{msg}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  iconBtn: {
    padding: spacing[1],
  },
  appbarTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  appbarSpacer: {
    width: 32,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    gap: spacing[5],
  },
  bottomSpacer: {
    height: spacing[10],
  },
  errorsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.errorSoft ?? colors.neutral[100],
  },
  errorsBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.status.error,
  },
})
