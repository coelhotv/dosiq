// MeasureLogSheet.jsx — fast-logging de biomarcador (012 Fase C · FR-010).
// Layout B "idoso primeiro": valor gigante centrado, tipo recolhido (chips), contexto em chips
// (só glicemia), unidade fixa por tipo, horário "Agora". Vírgula PT-BR (R-270/coerceDecimal).
// Modal Android-safe (R-233). SaMD (ADR-062): nenhuma cor/copy de qualidade do valor.
//
// v1: glicemia + peso (Planning 2026-06-14). PA fora da UI (schema-ready no core).

import { useState, useEffect, useCallback } from 'react'
import { View, Text, Modal, Pressable, TouchableOpacity, TextInput, StyleSheet, Platform, StatusBar, KeyboardAvoidingView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Ruler, Check, Calendar } from 'lucide-react-native'
import {
  coerceDecimal,
  parseISO,
  getNow,
  cloneDate,
  formatDateTimePtBR,
  BIOMARKER_TYPE_UNITS,
  BIOMARKER_TYPE_LABELS,
  BIOMARKER_CONTEXTS,
  BIOMARKER_CONTEXT_LABELS,
  BIOMARKER_PA_CONTEXTS,
  BIOMARKER_PA_CONTEXT_LABELS,
} from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'

// Tipos com UI. PA entra na spec 032 (2 campos: sistólica + diastólica). batimentos = schema-ready.
const UI_TYPES = ['glicemia', 'peso', 'pressao_arterial']

// Contexto por família (ADR-070). Tipos ausentes = sem contexto.
const CONTEXTS_BY_TYPE = {
  glicemia: { values: BIOMARKER_CONTEXTS, labels: BIOMARKER_CONTEXT_LABELS },
  pressao_arterial: { values: BIOMARKER_PA_CONTEXTS, labels: BIOMARKER_PA_CONTEXT_LABELS },
}

// Reusa o seletor data/hora do registro de dose (DoseActionSheet): Android = 2 etapas
// (data → hora); iOS = picker datetime em modal.
function openAndroidDateTime(currentDate, onPicked) {
  DateTimePickerAndroid.open({
    value: currentDate,
    mode: 'date',
    onChange: (event, date) => {
      if (event.type !== 'set' || !date) return
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'time',
        onChange: (timeEvent, timeDate) => {
          if (timeEvent.type !== 'set' || !timeDate) return
          const combined = cloneDate(date)
          combined.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0)
          onPicked(combined)
        },
      })
    },
  })
}

// editItem (opcional): edição de medida existente (US3b). Caller DEVE passar
// key={editItem?.id || 'create'} p/ remontar e re-seedar o estado (R-273).
// lockedType (opcional): contextualiza o sheet a UM tipo (esconde as tabs). Usado pelo hub de
// Medidas, onde o FAB é relativo ao histórico aberto (glicemia OU peso). Edição também trava o tipo.
function _validateBiomarkerValues(value, valueSec, isPa) {
  const num = coerceDecimal(value)
  if (Number.isNaN(num) || num <= 0) {
    return { error: isPa ? 'Digite a sistólica (maior que zero).' : 'Digite um valor válido maior que zero.' }
  }
  let secNum = null
  if (isPa) {
    secNum = coerceDecimal(valueSec)
    if (Number.isNaN(secNum) || secNum <= 0) {
      return { error: 'Digite a diastólica (maior que zero).' }
    }
  }
  return { num, secNum }
}

function MeasureTypeTabs({ showTabs, type, handleSelectType }) {
  if (!showTabs) {
    return <Text style={styles.lockedType}>{BIOMARKER_TYPE_LABELS[type]}</Text>
  }
  return (
    <View style={styles.typeRow}>
      {UI_TYPES.map((t) => (
        <Pressable
          key={t}
          onPress={() => handleSelectType(t)}
          style={[styles.typeChip, type === t && styles.typeChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: type === t }}
          accessibilityLabel={BIOMARKER_TYPE_LABELS[t]}
        >
          <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
            {BIOMARKER_TYPE_LABELS[t]}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function MeasureContextGrid({ showContext, ctxConfig, context, setContext }) {
  if (!showContext || !ctxConfig) return null
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

function MeasureDateTimePicker({ isEdit, measuredAt, handleOpenPicker }) {
  if (!isEdit) {
    return <Text style={styles.timeHint}>Horário: Agora</Text>
  }
  return (
    <Pressable
      style={styles.dateRow}
      onPress={handleOpenPicker}
      accessibilityRole="button"
      accessibilityLabel="Alterar data e hora da medida"
    >
      <View style={styles.dateTextCol}>
        <Text style={styles.dateLabel}>Data e hora</Text>
        <Text style={styles.dateValue}>{measuredAt ? formatDateTimePtBR(measuredAt) : 'Toque para definir'}</Text>
      </View>
      <Calendar size={18} color={colors.status.info} strokeWidth={2} />
    </Pressable>
  )
}

function MeasureIOSDatePickerModal({ visible, tempDate, setTempDate, onCancel, onConfirm }) {
  if (Platform.OS !== 'ios' || !visible) return null
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onCancel} />
      <View style={styles.pickerSheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.pickerCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Ajustar data e hora</Text>
            <TouchableOpacity onPress={onConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.pickerConfirm}>Confirmar</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            mode="datetime"
            display="spinner"
            value={tempDate || getNow()}
            onChange={(_, date) => { if (date) setTempDate(date) }}
            locale="pt-BR"
            textColor={colors.text.primary}
            themeVariant="light"
          />
        </SafeAreaView>
      </View>
    </Modal>
  )
}

function useMeasureSheetState({ editItem, fixedType, defaultType, open }) {
  const [type, setType] = useState(fixedType || defaultType)
  const [value, setValue] = useState(editItem ? String(editItem.value).replace('.', ',') : '')
  const [valueSec, setValueSec] = useState(
    editItem?.value_secondary != null ? String(editItem.value_secondary).replace('.', ',') : ''
  )
  const [context, setContext] = useState(editItem?.context ?? null)
  const [measuredAt, setMeasuredAt] = useState(editItem?.measured_at ? parseISO(editItem.measured_at) : null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const reset = useCallback(() => {
    setType(fixedType || defaultType)
    setValue(editItem ? String(editItem.value).replace('.', ',') : '')
    setValueSec(editItem?.value_secondary != null ? String(editItem.value_secondary).replace('.', ',') : '')
    setContext(editItem?.context ?? null)
    setMeasuredAt(editItem?.measured_at ? parseISO(editItem.measured_at) : null)
    setShowDatePicker(false)
    setErrorMsg(null)
    setSaving(false)
  }, [fixedType, defaultType, editItem])

  useEffect(() => {
    if (open) {
      const handle = setTimeout(() => {
        reset()
      }, 0)
      return () => clearTimeout(handle)
    }
  }, [open, reset])

  return {
    type, setType,
    value, setValue,
    valueSec, setValueSec,
    context, setContext,
    measuredAt, setMeasuredAt,
    showDatePicker, setShowDatePicker,
    tempDate, setTempDate,
    saving, setSaving,
    errorMsg, setErrorMsg,
    reset,
  }
}

function MeasureSheetHeader({ isEdit }) {
  return (
    <>
      <View style={styles.iconWrap}>
        <Ruler size={24} color={colors.status.info} strokeWidth={2} />
      </View>
      <Text style={styles.title}>{isEdit ? 'Editar medida' : 'Registrar medida'}</Text>
    </>
  )
}

function MeasureActionButtons({ saving, onCancel, onSave }) {
  return (
    <View style={styles.btnRow}>
      <Pressable
        onPress={onCancel}
        disabled={saving}
        style={({ pressed }) => [styles.cancelBtn, pressed && !saving && styles.btnPressed, saving && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        accessibilityState={{ disabled: saving }}
      >
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.btnPressed, saving && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Salvar medida"
        accessibilityState={{ disabled: saving, busy: saving }}
      >
        <Check size={20} color={colors.text.inverse} strokeWidth={2.5} />
        <Text style={styles.saveBtnText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
      </Pressable>
    </View>
  )
}

export default function MeasureLogSheet({ open, onClose, onSaved, defaultType = 'glicemia', editItem = null, lockedType = null }) {
  const isEdit = !!editItem
  const fixedType = editItem?.type || lockedType
  const showTabs = !fixedType

  const {
    type, setType,
    value, setValue,
    valueSec, setValueSec,
    context, setContext,
    measuredAt, setMeasuredAt,
    showDatePicker, setShowDatePicker,
    tempDate, setTempDate,
    saving, setSaving,
    errorMsg, setErrorMsg,
    reset,
  } = useMeasureSheetState({ editItem, fixedType, defaultType, open })

  const unit = BIOMARKER_TYPE_UNITS[type]
  const isPa = type === 'pressao_arterial'
  const ctxConfig = CONTEXTS_BY_TYPE[type] ?? null
  const showContext = !!ctxConfig

  function handleOpenPicker() {
    const base = measuredAt || getNow()
    if (Platform.OS === 'android') {
      openAndroidDateTime(base, setMeasuredAt)
    } else {
      setTempDate(base)
      setShowDatePicker(true)
    }
  }

  function handleIOSConfirm() {
    if (tempDate) setMeasuredAt(tempDate)
    setShowDatePicker(false)
  }

  function handleClose() {
    if (saving) return
    reset()
    onClose?.()
  }

  function handleSelectType(t) {
    selectionTap()
    setType(t)
    setContext(null)
    if (t !== 'pressao_arterial') setValueSec('')
    setErrorMsg(null)
  }

  async function handleSave() {
    const valResult = _validateBiomarkerValues(value, valueSec, isPa)
    if (valResult.error) {
      setErrorMsg(valResult.error)
      return
    }

    try {
      setSaving(true)
      setErrorMsg(null)
      const payload = {
        type,
        value: valResult.num,
        value_secondary: valResult.secNum,
        unit,
        context: showContext ? context : null,
      }
      if (isEdit && measuredAt) payload.measured_at = measuredAt.toISOString()
      const saved = await onSaved?.(isEdit ? { id: editItem.id, ...payload } : payload)
      reset()
      onClose?.(saved)
    } catch {
      setErrorMsg('Não foi possível salvar. Nada foi gravado — tente novamente.')
      setSaving(false)
    }
  }

  return (
    <Modal visible={!!open} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Fechar" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          <MeasureSheetHeader isEdit={isEdit} />

          <MeasureTypeTabs
            showTabs={showTabs}
            type={type}
            handleSelectType={handleSelectType}
          />

          <View style={styles.valueRow}>
            <View style={styles.paField}>
              <TextInput
                style={[isPa ? styles.paInput : styles.valueInput, errorMsg && styles.valueInputError]}
                value={value}
                onChangeText={(v) => { setValue(v); if (errorMsg) setErrorMsg(null) }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.neutral[300]}
                maxLength={isPa ? 3 : 6}
                autoFocus
                accessibilityLabel={isPa ? 'Sistólica em mmHg' : `Valor da medida em ${unit}`}
              />
              {isPa && <Text style={styles.paFieldLabel}>Sistólica</Text>}
            </View>
            {isPa && (
              <>
                <Text style={styles.paSep}>por</Text>
                <View style={styles.paField}>
                  <TextInput
                    style={[styles.paInput, errorMsg && styles.valueInputError]}
                    value={valueSec}
                    onChangeText={(v) => { setValueSec(v); if (errorMsg) setErrorMsg(null) }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.neutral[300]}
                    maxLength={3}
                    accessibilityLabel="Diastólica em mmHg"
                  />
                  <Text style={styles.paFieldLabel}>Diastólica</Text>
                </View>
              </>
            )}
            <Text style={styles.unit}>{unit}</Text>
          </View>

          <Text style={[styles.caption, !errorMsg && styles.captionHidden]}>{errorMsg || ' '}</Text>

          <MeasureContextGrid
            showContext={showContext}
            ctxConfig={ctxConfig}
            context={context}
            setContext={setContext}
          />

          <MeasureDateTimePicker
            isEdit={isEdit}
            measuredAt={measuredAt}
            handleOpenPicker={handleOpenPicker}
          />

          <MeasureActionButtons
            saving={saving}
            onCancel={handleClose}
            onSave={handleSave}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>

      <MeasureIOSDatePickerModal
        visible={showDatePicker}
        tempDate={tempDate}
        setTempDate={setTempDate}
        onCancel={() => setShowDatePicker(false)}
        onConfirm={handleIOSConfirm}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg.overlay },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[5],
    paddingBottom: spacing[6],
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300], marginBottom: spacing[4],
  },
  iconWrap: {
    alignSelf: 'center', width: 48, height: 48, borderRadius: borderRadius.full,
    backgroundColor: colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2],
  },
  title: {
    fontSize: 18, fontWeight: '700', color: colors.text.primary, textAlign: 'center',
    fontFamily: typography.fontFamily.bold, marginBottom: spacing[4],
  },
  typeRow: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center', marginBottom: spacing[4] },
  lockedType: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, textAlign: 'center', marginBottom: spacing[4] },
  typeChip: {
    paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100], minHeight: 44, justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: colors.status.info },
  typeChipText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  typeChipTextActive: { color: colors.text.inverse },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing[2] },
  valueInput: {
    fontSize: 64, fontWeight: '700', color: colors.text.primary, textAlign: 'center', minWidth: 120,
    padding: 0, fontFamily: typography.fontFamily.bold,
  },
  valueInputError: { color: colors.status.error },
  unit: { fontSize: 22, fontWeight: '600', color: colors.text.muted },
  // PA — 2 campos (sistólica "por" diastólica), unidade à direita. Reusa valueRow no container.
  paField: { alignItems: 'center' },
  paInput: {
    fontSize: 48, fontWeight: '700', color: colors.text.primary, textAlign: 'center', minWidth: 72,
    padding: 0, fontFamily: typography.fontFamily.bold,
  },
  paFieldLabel: { fontSize: 12, color: colors.text.muted, marginTop: spacing[1] },
  paSep: { fontSize: 20, fontWeight: '600', color: colors.text.muted },
  caption: { fontSize: 12, color: colors.status.error, textAlign: 'center', marginTop: spacing[1], minHeight: 16 },
  captionHidden: { opacity: 0 },
  ctxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[3] },
  ctxChip: {
    paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100], minHeight: 44, justifyContent: 'center',
  },
  ctxChipActive: { backgroundColor: colors.status.infoLight, borderWidth: 1, borderColor: colors.status.info },
  ctxChipText: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
  ctxChipTextActive: { color: colors.status.info, fontWeight: '700' },
  timeHint: { fontSize: 13, color: colors.text.muted, textAlign: 'center', marginTop: spacing[4] },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.neutral[100], borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: spacing[4], minHeight: 56,
  },
  dateTextCol: { gap: 2 },
  dateLabel: { fontSize: 12, color: colors.text.muted },
  dateValue: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  pickerBackdrop: { flex: 1, backgroundColor: colors.bg.overlay },
  pickerSheet: { backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.light,
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  pickerCancel: { fontSize: 15, color: colors.text.secondary },
  pickerConfirm: { fontSize: 15, fontWeight: '700', color: colors.status.info },
  btnRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  cancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral[100], paddingVertical: spacing[4], paddingHorizontal: spacing[5],
    borderRadius: borderRadius.md,
  },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: colors.text.secondary },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    backgroundColor: colors.status.info, paddingVertical: spacing[4], borderRadius: borderRadius.md,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
})
