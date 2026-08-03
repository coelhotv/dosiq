// BulkDoseRegisterModal.jsx — modal para registro em batch de doses de um bloco semântico
// Usado após tap em push notification ou FAB da tela de hoje (modo 'active')
// R-010: estados → effects → handlers

import { useState, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx (features/treatments)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
const { CheckCircle, Circle, Calendar, Clock, Folder, ChevronRight, ChevronUp, AlertTriangle } = LucideIcons as any
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { usePlanProtocols } from '@dose/hooks/usePlanProtocols'
import { registerDoseMany } from '../services/doseService'
import { getNow, cloneDate, formatIntakeDose, formatConcentration, isInjectable, INJECTION_SITES, getInjectionSiteAbsorption, getInjectionSiteLabel } from '@dosiq/core'
import { useToast } from '@shared/components/feedback/Toast'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { formatDateTime, buildBulkOutcome, useBulkLastSite, _buildConfirmLogs, _expandDoseItems } from '../utils/bulkDoseHelpers'


/**
 * Seletor de sítio por item injetável (031-B/US1). Canetas não podem partilhar o
 * mesmo sítio numa aplicação simultânea → cada injetável escolhe o seu. Opcional,
 * não-bloqueante. Só renderiza quando o item está marcado.
 */
function BulkItemSitePicker({ value, onChange, disabled, lastInjectionSite }) {
  const absorption = getInjectionSiteAbsorption(value)
  // US3: selecionar = último global → alerta NÃO-bloqueante (registro nunca travado).
  const repeated = value && lastInjectionSite && value === lastInjectionSite
  return (
    <View style={styles.siteSection}>
      <Text style={styles.siteLabel}>Local de aplicação (opcional)</Text>
      {lastInjectionSite && (
        <Text style={styles.siteLast}>
          Última aplicação: <Text style={styles.siteLastValue}>{getInjectionSiteLabel(lastInjectionSite)}</Text>
        </Text>
      )}
      <View style={styles.siteChips}>
        {INJECTION_SITES.map((site) => {
          const isSel = value === site.value
          return (
            <Pressable
              key={site.value}
              style={[styles.siteChip, isSel && styles.siteChipSelected]}
              onPress={() => onChange(isSel ? null : site.value)}
              disabled={disabled}
            >
              <Text style={[styles.siteChipText, isSel && styles.siteChipTextSelected]}>
                {site.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {repeated && (
        <View style={styles.siteAlert} accessibilityRole="alert">
          <AlertTriangle size={14} color={colors.status.warning} strokeWidth={2} />
          <Text style={styles.siteAlertText}>Mesmo local da última aplicação — considere rotacionar.</Text>
        </View>
      )}
      {absorption && <Text style={styles.siteHint}>{absorption}</Text>}
    </View>
  )
}

/**
 * Lista de protocolos para seleção em batch (Suporta layouts Simples e Complexo)
 */
function BulkDoseProtocolList({ items, selected, loading, onToggle, isComplex, injectionSites, onSiteChange, lastInjectionSite }) {
  const [collapsedPlans, setCollapsedPlans] = useState({})

  const togglePlanCollapse = (planId) => {
    setCollapsedPlans(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }))
  }

  const { groupedPlans, flatList } = useMemo(() => {
    if (!isComplex) {
      return { groupedPlans: [], flatList: items }
    }
    const plans = {}
    const others = []
    items.forEach(item => {
      const plan = item.plan
      if (plan?.id) {
        if (!plans[plan.id]) {
          plans[plan.id] = { id: plan.id, name: plan.name, emoji: plan.emoji, color: plan.color, items: [] }
        }
        plans[plan.id].items.push(item)
      } else {
        others.push(item)
      }
    })
    return { groupedPlans: Object.values(plans), flatList: others }
  }, [items, isComplex])

  const renderItem = (item) => {
    const isChecked = !!selected[item.id]
    const medicineName = item.protocol?.medicine?.name ?? item.protocol?.name ?? 'Medicamento'
    // Líquido → "40 gotas (≈ 2 ml)"; sólido → "10 un. (1.000 mg)" (formatIntakeDose).
    const dose = formatIntakeDose(item.protocol?.dosage_per_intake ?? 1, item.protocol?.intake_unit, item.protocol?.medicine)
    const injectable = isInjectable(item.protocol?.medicine)

    return (
      <View key={item.id}>
        <Pressable
          style={styles.item}
          onPress={() => onToggle(item.id)}
          disabled={loading}
        >
          {isChecked
            ? <CheckCircle size={22} color={colors.brand.primary} strokeWidth={2} />
            : <Circle size={22} color={colors.neutral[300]} strokeWidth={2} />
          }
          <View style={styles.itemText}>
            <View style={styles.medicineNameRow}>
              <Text style={[styles.medicineName, !isChecked && styles.unchecked]} numberOfLines={1}>
                {medicineName}
              </Text>
              {item.protocol.medicine?.dosage_per_pill && (
                <View style={styles.dosageBadge}>
                  <Text style={styles.dosageBadgeText}>
                    {formatConcentration(item.protocol.medicine.dosage_per_pill, item.protocol.medicine.dosage_unit, item.protocol.medicine.concentration_volume_ml)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.doseInfo}>{dose}</Text>
              {item.scheduledTime ? (
                <View style={styles.timeRow}>
                  <Clock size={12} color={colors.primary[700]} strokeWidth={2} />
                  <Text style={styles.timeInfo}>{item.scheduledTime}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        {injectable && isChecked && (
          <BulkItemSitePicker
            value={injectionSites?.[item.id] ?? null}
            onChange={(site) => onSiteChange(item.id, site)}
            disabled={loading}
            lastInjectionSite={lastInjectionSite}
          />
        )}
      </View>
    )
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
      {isComplex ? (
        <>
          {groupedPlans.map(plan => {
            const isCollapsed = !!collapsedPlans[plan.id]
            return (
              <View key={plan.id ?? plan.name} style={styles.planSection}>
                <Pressable
                  style={styles.planHeader}
                  onPress={() => plan.id && togglePlanCollapse(plan.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${isCollapsed ? 'Expandir' : 'Colapsar'} plano ${plan.name}`}
                >
                  <View style={styles.planHeaderLeft}>
                    {plan.emoji ? (
                      <Text style={styles.planEmoji}>{plan.emoji}</Text>
                    ) : (
                      <Folder size={14} color={colors.text.secondary} strokeWidth={2.5} />
                    )}
                    <Text style={styles.planTitle} numberOfLines={1}>
                      {plan.name}
                    </Text>
                  </View>
                  {plan.id && (
                    isCollapsed
                      ? <ChevronRight size={16} color={colors.text.secondary} strokeWidth={2} />
                      : <ChevronUp size={16} color={colors.text.secondary} strokeWidth={2} />
                  )}
                </Pressable>
                {!isCollapsed && (
                  <View style={styles.planItems}>
                    {plan.items.map(renderItem)}
                  </View>
                )}
              </View>
            )
          })}
          {flatList.length > 0 && (
            <View key="flat-avulsos" style={styles.planSection}>
              <Pressable
                style={styles.planHeader}
                onPress={() => togglePlanCollapse('avulsos')}
                accessibilityRole="button"
                accessibilityLabel={`${collapsedPlans['avulsos'] ? 'Expandir' : 'Colapsar'} seção Outros / Avulsos`}
              >
                <View style={styles.planHeaderLeft}>
                  <Folder size={14} color={colors.text.secondary} strokeWidth={2.5} />
                  <Text style={styles.planTitle}>Outros / Avulsos</Text>
                </View>
                {collapsedPlans['avulsos']
                  ? <ChevronRight size={16} color={colors.text.secondary} strokeWidth={2} />
                  : <ChevronUp size={16} color={colors.text.secondary} strokeWidth={2} />
                }
              </Pressable>
              {!collapsedPlans['avulsos'] && (
                <View style={styles.planItems}>
                  {flatList.map(renderItem)}
                </View>
              )}
            </View>
          )}
        </>
      ) : (
        flatList.map(renderItem)
      )}
    </ScrollView>
  )
}

function BulkDoseRetroactivePicker({ takenAtDate, handleOpenRetroactivePicker }) {
  return (
    <Pressable 
      style={styles.retroRow} 
      onPress={handleOpenRetroactivePicker}
      accessibilityRole="button"
      accessibilityLabel="Alterar horário de registro"
    >
      <View style={styles.retroTextCol}>
        <Text style={styles.retroLabel}>Horário do Registro:</Text>
        <Text style={styles.retroValue}>
          {takenAtDate ? formatDateTime(takenAtDate) : 'Agora'}
        </Text>
      </View>
      <Calendar size={18} color={colors.primary[700]} strokeWidth={2} />
    </Pressable>
  )
}

// Picker iOS como OVERLAY ABSOLUTO (não Modal). Modal-sobre-Modal no iOS engole gestos: o
// spinner aparecia mas o onChange não registrava, então o horário escolhido nunca chegava em
// `takenAtDate` e a tomada era gravada com `agora` (bug). Renderizado DENTRO da Modal bulk,
// na mesma superfície, os gestos funcionam.
function IOSDateTimePickerOverlay({ visible, tempDate, setTempDate, onCancel, onConfirm }) {
  if (Platform.OS !== 'ios' || !visible) return null
  return (
    <View style={styles.pickerOverlay}>
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onCancel} />
      <View style={styles.pickerSheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Ajustar horário</Text>
            <TouchableOpacity onPress={onConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    </View>
  )
}

function BulkDoseHeader({ header, scheduledTime }) {
  return (
    <View style={styles.header}>
      <View style={styles.titleCol}>
        <Text style={styles.title}>{header}</Text>
        <Text style={styles.subtitle}>Selecione os medicamentos tomados</Text>
      </View>
      {scheduledTime ? (
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>{scheduledTime}</Text>
        </View>
      ) : null}
    </View>
  )
}

function BulkDoseActions({ loading, selectedCount, onCancel, onConfirm }) {
  return (
    <View style={styles.actions}>
      <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>

      <Pressable
        style={[styles.confirmBtn, (loading || selectedCount === 0) && styles.btnDisabled]}
        onPress={onConfirm}
        disabled={loading || selectedCount === 0}
      >
        {loading
          ? <ActivityIndicator color={colors.text.inverse} size="small" />
          : <Text style={styles.confirmText}>
              Registrar {selectedCount} {selectedCount === 1 ? 'dose' : 'doses'}
            </Text>
        }
      </Pressable>
    </View>
  )
}

function useBulkDoseModalState({ visible, isComplex, expandedDoseItems }) {
  const [prevVisible, setPrevVisible] = useState(null)
  const [prevItems, setPrevItems] = useState([])
  const [selected, setSelected] = useState({})
  const [injectionSites, setInjectionSites] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [takenAtDate, setTakenAtDate] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState(null)

  const itemsChanged = expandedDoseItems !== prevItems
  const visibilityChanged = visible !== prevVisible

  if (itemsChanged || visibilityChanged) {
    setPrevItems(expandedDoseItems)
    setPrevVisible(visible)
    if (!visible) {
      setSelected({})
      setInjectionSites({})
      setError(null)
      setLoading(false)
      setTakenAtDate(null)
      setShowDatePicker(false)
      setTempDate(null)
    } else {
      setInjectionSites({})
      const initial = {}
      expandedDoseItems.forEach(item => { initial[item.id] = !isComplex })
      setSelected(initial)
      // takenAtDate SÓ na transição de ABERTURA — nunca em itemsChanged. A lista de itens
      // pode re-renderizar (async load, tick do pai) DEPOIS do usuário ajustar o horário no
      // picker; resetar aqui clobberava a hora manual de volta p/ `agora` (bug: tomada de
      // ontem à noite gravada com horário de hoje). Ver _buildConfirmLogs/isBackdated.
      if (visibilityChanged) setTakenAtDate(getNow())
    }
  }

  return {
    selected, setSelected,
    injectionSites, setInjectionSites,
    loading, setLoading,
    error, setError,
    takenAtDate, setTakenAtDate,
    showDatePicker, setShowDatePicker,
    tempDate, setTempDate,
  }
}

function openAndroidDateTimePicker(base, onSelect) {
  DateTimePickerAndroid.open({
    value: base,
    mode: 'date',
    onChange: (event, date) => {
      if (event.type === 'set' && date) {
        DateTimePickerAndroid.open({
          value: base,
          mode: 'time',
          onChange: (timeEvent, timeDate) => {
            if (timeEvent.type === 'set' && timeDate) {
              const combined = cloneDate(date)
              combined.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0)
              onSelect(combined)
            }
          }
        })
      }
    }
  })
}

export default function BulkDoseRegisterModal({
  visible,
  onClose,
  onSuccess,
  mode,
  planId = undefined,
  protocolIds = undefined,
  scheduledTime = undefined,
  treatmentPlanName = undefined,
  userId,
  isComplex = false,
  initialProtocols = null,
  instancesByKey = null,
  instancedItems = null,
}) {
  const { show } = useToast()

  const bypassLoad = !!(initialProtocols || instancedItems)
  const { protocols: loadedProtocols, loading: protocolsLoading, error: protocolsError } = usePlanProtocols({
    mode: bypassLoad ? 'active' : mode,
    planId,
    protocolIds: bypassLoad ? [] : protocolIds,
    scheduledTime,
    userId: bypassLoad ? 'demo-user' : userId,
  })

  const protocols = useMemo(() => {
    return initialProtocols ?? loadedProtocols
  }, [initialProtocols, loadedProtocols])

  const expandedDoseItems = useMemo(() => {
    return _expandDoseItems(protocols, instancedItems)
  }, [protocols, instancedItems])

  // US2: último sítio GLOBAL — busca só se o bloco tem injetável (dentro do hook).
  const lastInjectionSite = useBulkLastSite(visible, expandedDoseItems)

  const {
    selected, setSelected,
    injectionSites, setInjectionSites,
    loading, setLoading,
    error, setError,
    takenAtDate, setTakenAtDate,
    showDatePicker, setShowDatePicker,
    tempDate, setTempDate,
  } = useBulkDoseModalState({ visible, isComplex, expandedDoseItems })

  function toggleProtocol(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleSiteChange(id, site) {
    setInjectionSites(prev => ({ ...prev, [id]: site }))
  }

  function handleOpenRetroactivePicker() {
    const base = takenAtDate || getNow()
    if (Platform.OS === 'android') {
      openAndroidDateTimePicker(base, setTakenAtDate)
    } else {
      setTempDate(base)
      setShowDatePicker(true)
    }
  }

  function handleIOSConfirm() {
    if (tempDate) setTakenAtDate(tempDate)
    setShowDatePicker(false)
  }

  function handleIOSCancel() {
    setShowDatePicker(false)
  }

  async function handleConfirm() {
    const selectedIds = Object.keys(selected).filter(id => selected[id])
    if (selectedIds.length === 0) {
      setError('Selecione pelo menos um medicamento.')
      return
    }

    setLoading(true)
    setError(null)

    const now = getNow()
    const finalTakenAt = takenAtDate ? takenAtDate.toISOString() : now.toISOString()
    const isBackdated = !!takenAtDate && takenAtDate.toDateString() !== now.toDateString()

    const logsData = _buildConfirmLogs(selectedIds, expandedDoseItems, finalTakenAt, isBackdated, instancesByKey, injectionSites)

    const result = await registerDoseMany(logsData)
    setLoading(false)

    const outcome = buildBulkOutcome(result)
    if (outcome.variant !== 'success') setError(outcome.msg)
    show(outcome.msg, { variant: outcome.variant, duration: outcome.duration })
    if (outcome.successCount > 0) onSuccess({ successCount: outcome.successCount })
  }

  function handleClose() {
    if (loading) return
    onClose()
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const header = instancedItems
    ? 'Doses para tomar'
    : mode === 'plan'
    ? (treatmentPlanName ?? 'Plano de tratamento')
    : mode === 'active'
    ? 'Doses de hoje'
    : `Doses agora — ${scheduledTime}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <BulkDoseHeader header={header} scheduledTime={scheduledTime} />

          <BulkDoseRetroactivePicker
            takenAtDate={takenAtDate}
            handleOpenRetroactivePicker={handleOpenRetroactivePicker}
          />

          {protocolsLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : protocolsError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{protocolsError}</Text>
            </View>
          ) : (
            <BulkDoseProtocolList
              items={expandedDoseItems}
              selected={selected}
              loading={loading}
              onToggle={toggleProtocol}
              isComplex={isComplex}
              injectionSites={injectionSites}
              onSiteChange={handleSiteChange}
              lastInjectionSite={lastInjectionSite}
            />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BulkDoseActions
            loading={loading}
            selectedCount={selectedCount}
            onCancel={handleClose}
            onConfirm={handleConfirm}
          />
        </View>

        {/* Overlay do picker DENTRO da Modal bulk (mesma superfície) — não Modal aninhada. */}
        <IOSDateTimePickerOverlay
          visible={showDatePicker}
          tempDate={tempDate}
          setTempDate={setTempDate}
          onCancel={handleIOSCancel}
          onConfirm={handleIOSConfirm}
        />
      </View>
    </Modal>
  )
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[3],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  timeBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  centerState: {
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.screen,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  medicineName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  unchecked: {
    color: colors.text.muted,
  },
  medicineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dosageBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  doseInfo: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  errorText: {
    color: colors.status.error,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Sítio de injeção por item (031-B)
  siteSection: {
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  siteLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  siteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  siteChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.screen,
  },
  siteChipSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.primary[50],
  },
  siteChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  siteChipTextSelected: {
    color: colors.primary[700],
  },
  siteHint: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  siteLast: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  siteLastValue: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  siteAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
  },
  siteAlertText: {
    flex: 1,
    fontSize: 12,
    color: colors.status.warning,
  },

  // Custom Styles para agrupamento e horários
  planSection: {
    marginBottom: spacing[4],
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.sm,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  planItems: {
    gap: spacing[2],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  timeInfo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
  },
  planEmoji: {
    fontSize: 14,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.bg.screen,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    marginVertical: spacing[2],
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },

  // DateTimePicker iOS — overlay absoluto (não Modal aninhada)
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
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
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
    color: colors.text.muted,
    fontWeight: '500',
  },
  pickerConfirmText: {
    fontSize: 15,
    color: colors.primary[700],
    fontWeight: '600',
  },
})

