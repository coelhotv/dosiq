// ExportSheet.jsx — sheet nativo de export LGPD (spec 008, Adendo 2026-07-13, FR-001/011).
//
// Imita a estrutura do ExportDialog.tsx web (toggle JSON/CSV + checkboxes de escopo),
// mas entrega o arquivo pelo caminho nativo: FileSystem.cacheDirectory + Sharing.shareAsync.
// SEM filtro de período (decisão desta sessão — o período fica só na web); `dateRange: null`
// sempre. Formatadores/inventário já vivem em @dosiq/core — este componente só orquestra
// UI + fetch + entrega, não monta conteúdo de arquivo (R-010: States → Memos → Effects → Handlers).

import { useState, useMemo, useCallback } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { FileJson, FileSpreadsheet, TriangleAlert, CalendarDays, X } = LucideIcons as any
import { createExportService, formatDatePtBR, getNow, type ExportFormat } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

// TODO(040-strict): supabase client local não tipado como Database (nível B)
const exportService = createExportService({ client: supabase as any, getUserId })

const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON', Icon: FileJson },
  { value: 'csv', label: 'CSV', Icon: FileSpreadsheet },
]

const DATA_TYPE_LABELS = {
  profile: 'Perfil e configurações',
  protocols: 'Tratamentos',
  logs: 'Registros de dose',
  stock: 'Estoque',
  medicines: 'Medicamentos',
  biomarkers: 'Medidas e biomarcadores',
}

function FormatToggle({ format, disabled, onChange }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Formato</Text>
      <View style={styles.formatToggle}>
        {FORMAT_OPTIONS.map(({ value, label, Icon }) => {
          const active = format === value
          return (
            <Pressable
              key={value}
              style={[styles.formatBtn, active && styles.formatBtnActive]}
              onPress={() => onChange(value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Formato ${label}`}
              accessibilityState={{ selected: active }}
            >
              <Icon size={16} color={active ? colors.text.inverse : colors.text.secondary} strokeWidth={2} />
              <Text style={[styles.formatBtnText, active && styles.formatBtnTextActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function ScopeCheckboxes({ scope, disabled, showStock, onToggle }) {
  // Ordem = do cadastro ao registro (perfil → o que se toma → como se toma → o que se tem →
  // o que se fez → o que se mediu). Estoque some para o usuário dose-only (044).
  const rows = [
    { key: 'includeProfile', label: DATA_TYPE_LABELS.profile },
    { key: 'includeMedicines', label: DATA_TYPE_LABELS.medicines },
    { key: 'includeProtocols', label: DATA_TYPE_LABELS.protocols },
    ...(showStock ? [{ key: 'includeStock', label: DATA_TYPE_LABELS.stock }] : []),
    { key: 'includeLogs', label: DATA_TYPE_LABELS.logs },
    { key: 'includeBiomarkers', label: DATA_TYPE_LABELS.biomarkers },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Dados a exportar</Text>
      {rows.map(({ key, label }) => {
        const checked = !!scope[key]
        return (
          <Pressable
            key={key}
            style={styles.checkboxRow}
            onPress={() => onToggle(key)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={label}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <View style={styles.checkboxDot} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// Picker iOS como OVERLAY ABSOLUTO dentro do próprio sheet — NÃO Modal aninhada e NÃO
// picker inline: o inline empurra o sheet pra fora da margem superior do device, e Modal
// sobre Modal no iOS engole os gestos (o spinner aparece, o onChange não registra — mesmo
// bug já resolvido assim no BulkDoseRegisterModal).
function IOSDatePickerOverlay({ field, tempDate, setTempDate, onCancel, onConfirm }) {
  if (Platform.OS !== 'ios' || !field) return null

  return (
    <View style={styles.pickerOverlay}>
      <Pressable style={styles.pickerBackdrop} onPress={onCancel} />
      <View style={styles.pickerSheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancelar data">
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{field === 'start' ? 'Data inicial' : 'Data final'}</Text>
            <Pressable onPress={onConfirm} hitSlop={8} accessibilityRole="button" accessibilityLabel="Confirmar data">
              <Text style={styles.pickerConfirmText}>Confirmar</Text>
            </Pressable>
          </View>
          <DateTimePicker
            mode="date"
            display="spinner"
            value={tempDate || getNow()}
            onChange={(_event, date) => { if (date) setTempDate(date) }}
            locale="pt-BR"
            textColor={colors.text.primary}
            themeVariant="light"
          />
        </SafeAreaView>
      </View>
    </View>
  )
}

/**
 * Período opcional (paridade com o DateRangeSelector da web): filtra SOMENTE os registros
 * de dose — as demais seções saem completas. Cada borda é independente ("de 01/07 em diante"
 * é filtro válido). Android abre o picker imperativo do SO; iOS abre o overlay acima.
 */
function DateRangeSelector({ dateRange, disabled, onOpenPicker, onClear }) {
  const rows = [
    { key: 'start', label: 'De' },
    { key: 'end', label: 'Até' },
  ]
  const hasFilter = !!(dateRange.start || dateRange.end)

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>Período das doses (opcional)</Text>
        {hasFilter ? (
          <Pressable
            onPress={onClear}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Limpar período"
          >
            <View style={styles.clearRow}>
              <X size={12} color={colors.text.muted} strokeWidth={2} />
              <Text style={styles.clearText}>Limpar</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.dateRow}>
        {rows.map(({ key, label }) => (
          <Pressable
            key={key}
            style={styles.dateBtn}
            onPress={() => onOpenPicker(key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${dateRange[key] ? formatDatePtBR(dateRange[key]) : 'sem data'}`}
          >
            <CalendarDays size={14} color={colors.text.muted} strokeWidth={2} />
            <View>
              <Text style={styles.dateBtnLabel}>{label}</Text>
              <Text style={styles.dateBtnValue}>
                {dateRange[key] ? formatDatePtBR(dateRange[key]) : 'Selecionar'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.dateHint}>Filtra apenas os registros de dose.</Text>
    </View>
  )
}

const DEFAULT_SCOPE = Object.freeze({
  includeProfile: true,
  includeProtocols: true,
  includeLogs: true,
  includeStock: true,
  includeMedicines: true,
  includeBiomarkers: true,
})

export default function ExportSheet({ visible, onClose }) {
  // Spec 044: checkbox "Estoque" some para usuário dose-only.
  const { enabled: stockTrackingEnabled } = useStockTracking()

  // 1. States (R-010)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [scope, setScope] = useState(DEFAULT_SCOPE)
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  })
  // iOS: overlay do picker — qual borda está aberta e a data "em edição" (só vira período
  // no Confirmar; fechar sem confirmar não altera nada).
  const [iosPicker, setIosPicker] = useState<'start' | 'end' | null>(null)
  const [tempDate, setTempDate] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  // 2. Memos (R-010)
  const exportScope = useMemo(
    () => ({ ...scope, includeStock: scope.includeStock && stockTrackingEnabled }),
    [scope, stockTrackingEnabled],
  )

  const isExportDisabled = useMemo(() => {
    return !Object.values(exportScope).some(Boolean)
  }, [exportScope])

  // 4. Handlers (R-010)
  const handleFormatChange = useCallback((value) => {
    setFormat(value)
    setError(null)
  }, [])

  const handleToggleScope = useCallback((key) => {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }))
    setError(null)
  }, [])

  // Android: picker imperativo do SO (grava direto no confirmar do próprio diálogo).
  // iOS: abre o overlay com a data em edição (só grava no Confirmar).
  const handleOpenPicker = useCallback((key: 'start' | 'end') => {
    setError(null)

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateRange[key] ?? getNow(),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return
          setDateRange((prev) => ({ ...prev, [key]: date }))
        },
      })
      return
    }

    setTempDate(dateRange[key] ?? getNow())
    setIosPicker(key)
  }, [dateRange])

  const handleCancelIosPicker = useCallback(() => {
    setIosPicker(null)
    setTempDate(null)
  }, [])

  const handleConfirmIosPicker = useCallback(() => {
    if (iosPicker && tempDate) {
      const key = iosPicker
      setDateRange((prev) => ({ ...prev, [key]: tempDate }))
    }
    setIosPicker(null)
    setTempDate(null)
  }, [iosPicker, tempDate])

  const handleClearDateRange = useCallback(() => {
    setDateRange({ start: null, end: null })
    setIosPicker(null)
    setTempDate(null)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (exporting) return
    onClose()
  }, [exporting, onClose])

  const handleExport = useCallback(async () => {
    if (isExportDisabled || exporting) return

    if (dateRange.start && dateRange.end && dateRange.start > dateRange.end) {
      setError('A data inicial não pode ser depois da final.')
      return
    }

    setExporting(true)
    setError(null)

    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        setError('Compartilhamento não disponível neste dispositivo.')
        setExporting(false)
        return
      }

      const file = await exportService.buildExport({
        format,
        scope: exportScope,
        // Paridade com a web: o período filtra SÓ os registros de dose; cada borda é
        // independente (só "de" ou só "até" são filtros válidos).
        dateRange: dateRange.start || dateRange.end ? dateRange : null,
        now: getNow(),
      })

      const fileUri = FileSystem.cacheDirectory + file.filename
      await FileSystem.writeAsStringAsync(fileUri, file.content, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      await Sharing.shareAsync(fileUri, {
        mimeType: file.mimeType,
        UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
      })

      onClose()
    } catch (err) {
      if (__DEV__) console.error('Erro ao exportar dados:', err)
      setError('Erro ao exportar dados. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }, [isExportDisabled, exporting, format, exportScope, dateRange, onClose])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Exportar dados</Text>

        <FormatToggle format={format} disabled={exporting} onChange={handleFormatChange} />
        <DateRangeSelector
          dateRange={dateRange}
          disabled={exporting}
          onOpenPicker={handleOpenPicker}
          onClear={handleClearDateRange}
        />
        <ScopeCheckboxes
          scope={exportScope}
          disabled={exporting}
          showStock={stockTrackingEnabled}
          onToggle={handleToggleScope}
        />

        <View style={styles.warningRow}>
          <TriangleAlert size={14} color={colors.status.warning} strokeWidth={2} />
          <Text style={styles.warningText}>
            O arquivo exportado contém seus dados de saúde — se for compartilhar, confira o destinatário.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleExport}
          disabled={isExportDisabled || exporting}
          style={({ pressed }) => [
            styles.btnPrimary,
            (isExportDisabled || exporting) && styles.btnDisabled,
            pressed && !exporting && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Exportar"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.btnPrimaryText}>Exportar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleClose}
          disabled={exporting}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>

      {/* Overlay do picker DENTRO da Modal do sheet (mesma superfície) — não Modal aninhada. */}
      <IOSDatePickerOverlay
        field={iosPicker}
        tempDate={tempDate}
        setTempDate={setTempDate}
        onCancel={handleCancelIosPicker}
        onConfirm={handleConfirmIosPicker}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  formatToggle: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 44,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  formatBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  formatBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  formatBtnTextActive: {
    color: colors.text.inverse,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dateBtnLabel: {
    fontSize: 11,
    color: colors.text.muted,
  },
  dateBtnValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateHint: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: spacing[2],
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[600],
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.text.inverse,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text.primary,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.status.warning + '1A',
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 13,
    color: colors.status.error,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  btnPrimary: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  btnSecondary: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  // Picker iOS — overlay absoluto sobre o próprio sheet (não Modal aninhada, não inline)
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
    elevation: 10,
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
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing[4],
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pickerCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.muted,
  },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[700],
  },
})
