import React, { useState, useEffect, startTransition } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  Platform,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { parseISO, getNow, cloneDate, formatActiveIngredientFormula, formatIntakeDose, formatConcentration, isLiquidMedicine, formatDose } from '@dosiq/core'
import { X, CircleCheckBig, XCircle, RedoDot, Clock, Trash2, ChevronRight, AlertTriangle, Calendar } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const DEFAULT_TZ = 'America/Sao_Paulo'

const STATUS_META = {
  taken:        { label: 'Tomada',   color: colors.brand.primary,  bg: colors.primary[100] },
  missed:       { label: 'Perdida',  color: colors.status.error,   bg: colors.status.errorLight },
  pending:      { label: 'Pendente', color: colors.neutral[600],   bg: colors.neutral[100] },
  skipped_user: { label: 'Pulada',   color: colors.neutral[500],   bg: colors.neutral[100] },
}

function StatusHeaderIcon({ status, size = 28 }) {
  if (status === 'taken')        return <CircleCheckBig size={size} color={colors.brand.primary} strokeWidth={2} />
  if (status === 'missed')       return <XCircle size={size} color={colors.status.error} strokeWidth={2} />
  if (status === 'skipped_user') return <RedoDot size={size} color={colors.neutral[400]} strokeWidth={2} />
  return <Clock size={size} color={colors.neutral[400]} strokeWidth={2} />
}

function formatInTz(isoStr, tz) {
  if (!isoStr) return '--:--'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseISO(isoStr))
  } catch {
    const d = parseISO(isoStr)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }
}

function formatTimeInTz(isoStr, tz) {
  if (!isoStr) return '--:--'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseISO(isoStr))
  } catch {
    const d = parseISO(isoStr)
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${min}`
  }
}

function formatDateObj(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} às ${hh}:${min}`
}

function punctualityLabel(takenAt, scheduledFor) {
  if (!takenAt || !scheduledFor) return null
  const diffMin = Math.round((parseISO(takenAt) - parseISO(scheduledFor)) / 60000)
  if (Math.abs(diffMin) <= 5) return { text: 'No horário', color: colors.brand.primary }
  if (diffMin > 0) return { text: `+${diffMin} min · Atrasado`, color: colors.status.warning }
  return { text: `${diffMin} min · No horário`, color: colors.brand.primary }
}

function SheetMainView({ instance, isTaken, isOrphan, takenTime, scheduledTime, punctuality, onEditPress, onDeletePress }) {
  return (
    <>
      <View style={styles.infoCard}>
        {isOrphan ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Horário registrado</Text>
            <Text style={styles.infoValue}>{takenTime}</Text>
          </View>
        ) : (
          <>
            {isTaken && instance?.taken_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tomada em</Text>
                <Text style={styles.infoValue}>{takenTime}</Text>
              </View>
            )}
            <View style={[styles.infoRow, isTaken && instance?.taken_at && styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Horário previsto</Text>
              <Text style={styles.infoValue}>{scheduledTime}</Text>
            </View>
            {punctuality && (
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>Pontualidade</Text>
                <Text style={[styles.infoValue, { color: punctuality.color }]}>{punctuality.text}</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity style={styles.actionRow} onPress={onEditPress} activeOpacity={0.7}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
            <Clock size={18} color={colors.brand.primary} strokeWidth={2} />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Editar registro</Text>
            <Text style={styles.actionDesc}>Ajustar a hora ou a dose que você efetivamente tomou</Text>
          </View>
          <ChevronRight size={16} color={colors.neutral[400]} strokeWidth={1.5} />
        </TouchableOpacity>

        {isTaken && (
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowBorder]}
            onPress={onDeletePress}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.status.errorLight }]}>
              <Trash2 size={18} color={colors.status.error} strokeWidth={2} />
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: colors.status.error }]}>Excluir registro</Text>
              <Text style={styles.actionDesc}>A dose volta para pendente — útil se foi um engano</Text>
            </View>
            <ChevronRight size={16} color={colors.neutral[400]} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
      </View>
    </>
  )
}

function SheetEditView({ instance, takenAtDate, quantityTaken, loading, onPickerPress, onChangeQty, onSave, onCancel }) {
  return (
    <View style={styles.formView}>
      <Text style={styles.formTitle}>Editar registro</Text>

      <Pressable
        style={styles.retroRow}
        onPress={onPickerPress}
        accessibilityRole="button"
        accessibilityLabel="Alterar horário de registro"
      >
        <View style={styles.retroTextCol}>
          <Text style={styles.retroLabel}>Horário da dose</Text>
          <Text style={styles.retroValue}>
            {takenAtDate ? formatDateObj(takenAtDate) : 'Toque para definir'}
          </Text>
        </View>
        <Calendar size={18} color={colors.primary[700]} strokeWidth={2} />
      </Pressable>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Quantidade (unidades)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 1"
          value={quantityTaken}
          onChangeText={onChangeQty}
          keyboardType="decimal-pad"
          editable={!loading}
          maxLength={10}
        />
        {instance?.dosage_per_pill && instance?.dosage_unit && (
          <Text style={styles.inputHint}>
            ✨ {isLiquidMedicine(instance)
              ? formatIntakeDose(quantityTaken || '1', instance.intake_unit, instance)
              : formatActiveIngredientFormula(quantityTaken || '1', instance.dosage_per_pill, instance.dosage_unit)}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={onSave}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.text.inverse} />
          : <Text style={styles.primaryButtonText}>Salvar</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.ghostButton} onPress={onCancel} disabled={loading}>
        <Text style={styles.ghostButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  )
}

function SheetDeleteView({ isOrphan, loading, onConfirm, onCancel }) {
  return (
    <View style={styles.formView}>
      <View style={styles.deleteWarning}>
        <AlertTriangle size={20} color={colors.status.error} strokeWidth={2} />
        <Text style={styles.deleteWarningText}>
          {isOrphan
            ? 'Excluir este registro? O registro será removido e o estoque restaurado.'
            : 'Excluir este registro? A dose volta para pendente e o estoque será restaurado.'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, loading && styles.buttonDisabled]}
        onPress={onConfirm}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.text.inverse} />
          : <Text style={styles.deleteButtonText}>Confirmar exclusão</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.ghostButton} onPress={onCancel} disabled={loading}>
        <Text style={styles.ghostButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  )
}

function openAndroidPicker(currentDate, onDatePicked) {
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
          onDatePicked(combined)
        },
      })
    },
  })
}

export default function DoseActionSheet({
  visible,
  instance,
  timezone = DEFAULT_TZ,
  onClose,
  onRegisterRetro,
  onUndo,
  onUpdateLog,
  onDeleteLog,
  loading = false,
}) {
  const [view, setView] = useState('main')
  const [takenAtDate, setTakenAtDate] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState(null)
  const [quantityTaken, setQuantityTaken] = useState('')

  useEffect(() => {
    if (visible && instance) {
      startTransition(() => {
        setView('main')
        setShowDatePicker(false)
        const src = instance.taken_at || instance.scheduled_for
        setTakenAtDate(src ? parseISO(src) : getNow())
        setQuantityTaken(String(instance.quantity_taken ?? instance.dosage_per_intake ?? 1))
      })
    }
  }, [visible, instance])

  function handleOpenPicker() {
    if (Platform.OS === 'android') {
      openAndroidPicker(takenAtDate || getNow(), setTakenAtDate)
    } else {
      setTempDate(takenAtDate || getNow())
      setShowDatePicker(true)
    }
  }

  function handleIOSConfirm() {
    if (tempDate) setTakenAtDate(tempDate)
    setShowDatePicker(false)
  }

  const isOrphan = instance?.source === 'log' || !!instance?.is_orphan

  const handleSaveEdit = () => {
    if (!takenAtDate || !quantityTaken) return
    // PT-BR: teclado numérico usa vírgula decimal — trocar por ponto antes do parseFloat,
    // senão "1,5" trunca para "1" (perda de precisão na quantidade).
    const parsedQty = parseFloat(String(quantityTaken).replace(',', '.'))
    if (isNaN(parsedQty)) return
    if (isOrphan) {
      onUpdateLog?.(instance.logId, {
        taken_at: takenAtDate.toISOString(),
        quantity_taken: parsedQty,
      })
    } else {
      onRegisterRetro?.(
        {
          taken_at: takenAtDate.toISOString(),
          quantity_taken: parsedQty,
          medicine_id: instance?.medicine_id,
          protocol_id: instance?.protocol_id,
        },
        instance?.instanceId  // instanceId = UUID bruto; instance.id = "inst:<uuid>" (prefixo core)
      )
    }
    onClose?.()
  }

  const handleDelete = () => {
    if (isOrphan) {
      onDeleteLog?.(instance.logId)
    } else {
      onUndo?.(instance?.instanceId)  // instanceId = UUID bruto; instance.id = "inst:<uuid>" (prefixo core)
    }
    onClose?.()
  }

  const medicineName = instance?.medicine_name || instance?.protocol_name || '—'
  const hasPill = instance?.dosage_per_pill != null && instance?.dosage_unit
  const scheduledTime = formatTimeInTz(instance?.scheduled_for, timezone)
  const takenTime = formatInTz(instance?.taken_at, timezone)
  const punctuality = instance?.taken_at && !isOrphan ? punctualityLabel(instance.taken_at, instance.scheduled_for) : null
  const statusBarHeight = StatusBar.currentHeight || 24
  const isTaken = instance?.status === 'taken'
  const statusMeta = STATUS_META[instance?.status] ?? STATUS_META.pending

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <TouchableOpacity
        style={[styles.overlay, { paddingTop: statusBarHeight }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={view !== 'main'}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <StatusHeaderIcon status={instance?.status} size={28} />
              <View style={styles.headerBody}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{medicineName}</Text>
                  <View style={[styles.statusChip, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.statusChipText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                  </View>
                  {hasPill && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{formatConcentration(instance.dosage_per_pill, instance.dosage_unit)}</Text>
                    </View>
                  )}
                </View>
                {instance?.dosage_per_intake != null && (
                  <Text style={styles.headerSub}>
                    {(() => {
                      const qty = instance.dosage_per_intake
                      // Líquido (022): unidade de TOMADA do tratamento (gotas/ml/UI), não a
                      // unidade do medicamento — ex: "20 gotas", nunca "20 mg/ml".
                      if (isLiquidMedicine(instance)) return formatDose(qty, instance.intake_unit || 'ml')
                      const unit = instance.dosage_unit?.toLowerCase()
                      if (!unit || ['mg', 'mcg', 'g'].includes(unit)) return `${qty} ${qty === 1 ? 'comprimido' : 'comprimidos'}`
                      if (unit === 'un') return `${qty} ${qty === 1 ? 'unidade' : 'unidades'}`
                      return `${qty} ${instance.dosage_unit}`
                    })()}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {view === 'main' && (
              <SheetMainView
                instance={instance}
                isTaken={isTaken}
                isOrphan={isOrphan}
                takenTime={takenTime}
                scheduledTime={scheduledTime}
                punctuality={punctuality}
                onEditPress={() => setView('edit')}
                onDeletePress={() => setView('confirm_delete')}
              />
            )}

            {view === 'edit' && (
              <SheetEditView
                instance={instance}
                takenAtDate={takenAtDate}
                quantityTaken={quantityTaken}
                loading={loading}
                onPickerPress={handleOpenPicker}
                onChangeQty={setQuantityTaken}
                onSave={handleSaveEdit}
                onCancel={() => setView('main')}
              />
            )}

            {view === 'confirm_delete' && (
              <SheetDeleteView
                isOrphan={isOrphan}
                loading={loading}
                onConfirm={handleDelete}
                onCancel={() => setView('main')}
              />
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
          <View style={styles.pickerSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.pickerCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Ajustar horário</Text>
                <TouchableOpacity onPress={handleIOSConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.pickerConfirmText}>Confirmar</Text>
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
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    flexShrink: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flexShrink: 1,
  },
  statusChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  headerSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.bg.screen,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  actionsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  actionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBody: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  formView: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 0,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.bg.screen,
  },
  inputHint: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  retroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.bg.screen,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    marginBottom: 16,
  },
  retroTextCol: {
    flex: 1,
    gap: 2,
  },
  retroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  retroValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  pickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pickerCancelText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  deleteButton: {
    backgroundColor: colors.status.error,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  ghostButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.status.errorLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 13,
    color: colors.status.error,
    lineHeight: 18,
  },
})
