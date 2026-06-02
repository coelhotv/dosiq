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
import { CheckCircle, Circle, Calendar, Clock, Folder, ChevronRight, ChevronUp } from 'lucide-react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { usePlanProtocols } from '@dose/hooks/usePlanProtocols'
import { registerDoseMany } from '../services/doseService'
import { getNow, cloneDate, formatActiveIngredientHint } from '@dosiq/core'
import { useToast } from '@shared/components/feedback/Toast'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Formata data e hora para exibição amigável
function formatDateTime(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} às ${hh}:${min}`
}

/**
 * Lista de protocolos para seleção em batch (Suporta layouts Simples e Complexo)
 */
function BulkDoseProtocolList({ items, selected, loading, onToggle, isComplex }) {
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
    const medicineName = item.protocol.medicine?.name ?? item.protocol.name ?? 'Medicamento'
    const dose = formatActiveIngredientHint(item.protocol.dosage_per_intake ?? 1, item.protocol.medicine?.dosage_per_pill, item.protocol.medicine?.dosage_unit) || `${item.protocol.dosage_per_intake ?? 1} un.`

    return (
      <Pressable
        key={item.id}
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
                  {item.protocol.medicine.dosage_per_pill}{item.protocol.medicine.dosage_unit}
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

export default function BulkDoseRegisterModal({
  visible,
  onClose,
  onSuccess,
  mode,
  planId,
  protocolIds,
  scheduledTime,
  treatmentPlanName,
  userId,
  isComplex = false,
  initialProtocols = null,
  // F4.3d: mapa { `${protocol_id}|${HH:MM}` → instanceId } das ocorrências de hoje.
  // Permite âncora DIRETA por instância de cada entrada do bulk; ausência → snap.
  instancesByKey = null,
  // F4.3d: itens já instanciados (HeroDoseCard) — { id, protocol, scheduledTime, plan, instanceId }.
  // Quando presente, são a lista exata (sem re-expandir time_schedule).
  instancedItems = null,
}) {
  const { show } = useToast()

  // States (R-010: ordem obrigatória)
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Seletor retroativo de data/hora
  const [takenAtDate, setTakenAtDate] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDate, setTempDate] = useState(null)
  
  // Trackers para ajuste de estado no render
  const [prevItems, setPrevItems] = useState([])
  const [prevVisible, setPrevVisible] = useState(false)

  // Hero (instancedItems) e initialProtocols dispensam o fetch do usePlanProtocols.
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

  // 1. Desmembramento cronológico de múltiplos horários
  const expandedDoseItems = useMemo(() => {
    // Hero: lista exata já instanciada (não re-expande time_schedule).
    if (instancedItems) return instancedItems
    const items = []
    protocols.forEach(p => {
      const schedules = p.time_schedule && p.time_schedule.length > 0
        ? p.time_schedule
        : [null]
        
      schedules.forEach(time => {
        items.push({
          id: `${p.id}-${time ?? 'adhoc'}`,
          protocol: p,
          scheduledTime: time,
          plan: p.treatment_plan,
        })
      })
    })

    // Ordenação cronológica crescente (timeline do dia)
    items.sort((a, b) => {
      if (!a.scheduledTime) return 1
      if (!b.scheduledTime) return -1
      return a.scheduledTime.localeCompare(b.scheduledTime)
    })
    
    return items
  }, [protocols, instancedItems])

  // Ajuste de Estado no Render (R-010 + React 19)
  if (expandedDoseItems !== prevItems || visible !== prevVisible) {
    setPrevItems(expandedDoseItems)
    setPrevVisible(visible)

    if (!visible) {
      setSelected({})
      setError(null)
      setLoading(false)
      setTakenAtDate(null)
      setShowDatePicker(false)
      setTempDate(null)
    } else {
      if (!takenAtDate) {
        setTakenAtDate(getNow())
      }
      const justOpened = visible && !prevVisible
      const itemsChanged = expandedDoseItems !== prevItems
      if (expandedDoseItems.length > 0 && (justOpened || itemsChanged)) {
        const initial = {}
        expandedDoseItems.forEach(item => { initial[item.id] = !isComplex })
        setSelected(initial)
      }
    }
  }

  function toggleProtocol(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleOpenRetroactivePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: takenAtDate || getNow(),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            DateTimePickerAndroid.open({
              value: takenAtDate || getNow(),
              mode: 'time',
              onChange: (timeEvent, timeDate) => {
                if (timeEvent.type === 'set' && timeDate) {
                  const combined = cloneDate(date)
                  combined.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0)
                  setTakenAtDate(combined)
                }
              }
            })
          }
        }
      })
    } else {
      setTempDate(takenAtDate || getNow())
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

    const finalTakenAt = takenAtDate ? takenAtDate.toISOString() : getNow().toISOString()

    // `instancesByKey` mapeia as ocorrências do DIA ATUAL (timeline de hoje). Se a tomada
    // foi backdatada para outro dia local (ex.: relógio já virou para amanhã, mas o usuário
    // registra a dose de ontem), a âncora direta por `protocol_id|HH:MM` resolveria para a
    // instância do dia errado (bug: marcava a ocorrência de amanhã e deixava a real `missed`).
    // Nesse caso NÃO usamos o mapa de hoje → `instance_id=null` força o snap por tolerância
    // em `registerDoseMany`/`findAnchorInstance`, que ancora pelo `taken_at` real (dia correto).
    const isBackdated = !!takenAtDate && takenAtDate.toDateString() !== getNow().toDateString()

    const logsData = selectedIds
      .map(id => {
        const item = expandedDoseItems.find(item => item.id === id)
        if (!item) return null
        const p = item.protocol
        // F4.3d: âncora direta — item já instanciado (hero) tem instanceId; senão resolve
        // a ocorrência do slot (protocol_id|HH:MM) no mapa do dia; senão null → snap.
        // Dose backdatada para outro dia → ignora o mapa de hoje (snap pelo taken_at).
        const instanceId = isBackdated
          ? null
          : (item.instanceId
            ?? (item.scheduledTime ? (instancesByKey?.[`${p.id}|${item.scheduledTime}`] ?? null) : null))
        return {
          protocol_id: p.id,
          medicine_id: p.medicine?.id ?? p.medicine_id,
          taken_at: finalTakenAt,
          quantity_taken: p.dosage_per_intake ?? 1,
          instance_id: instanceId,
        }
      })
      .filter(Boolean)

    const result = await registerDoseMany(logsData)
    setLoading(false)

    if (!result.success && result.results.length === 0) {
      const errMsg = result.error ?? 'Erro ao registrar doses.'
      setError(errMsg)
      show(errMsg, { variant: 'error' })
      return
    }

    const successCount = result.results.filter(r => r.success).length
    if (successCount > 0) {
      const msg = successCount === 1
        ? 'Dose registrada com sucesso.'
        : `${successCount} doses registradas com sucesso.`
      show(msg, { variant: 'success' })
      onSuccess({ successCount })
    } else {
      const errMsg = result.error ?? 'Nenhuma dose foi registrada.'
      setError(errMsg)
      show(errMsg, { variant: 'error' })
    }
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

          {/* Seletor Retroativo de Data/Hora */}
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
            />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmBtn, (loading || selectedCount === 0) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading || selectedCount === 0}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmText}>
                    Registrar {selectedCount} {selectedCount === 1 ? 'dose' : 'doses'}
                  </Text>
              }
            </Pressable>
          </View>
        </View>
      </View>

      {/* Modal iOS DateTimePicker */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={handleIOSCancel}
        >
          <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={handleIOSCancel} />
          <View style={styles.pickerSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleIOSCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

  // DateTimePicker iOS Modal
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

