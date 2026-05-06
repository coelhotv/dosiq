// BulkDoseRegisterModal.jsx — modal para registro em batch de doses de um bloco semântico
// Usado após tap em push notification grouped (plan ou misc) via deeplink N1.4
// R-010: estados → effects → handlers

import { useState } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { CheckCircle, Circle } from 'lucide-react-native'
import { usePlanProtocols } from '@dose/hooks/usePlanProtocols'
import { registerDoseMany } from '../services/doseService'
import { getNow } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onSuccess: Function,           — chamado com { successCount } após submit bem-sucedido
 *   mode: 'plan' | 'misc',
 *   planId?: string,
 *   protocolIds?: string[],
 *   scheduledTime: string,         — 'HH:MM'
 *   treatmentPlanName?: string,
 *   userId: string,
 * }} props
 */
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
}) {
  // States (R-010: ordem obrigatória)
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Trackers para ajuste de estado no render
  const [prevProtocols, setPrevProtocols] = useState([])
  const [prevVisible, setPrevVisible] = useState(false)

  const { protocols, loading: protocolsLoading, error: protocolsError } = usePlanProtocols({
    mode,
    planId,
    protocolIds,
    scheduledTime,
    userId,
  })

  // Ajuste de Estado no Render (R-010 + React 19)
  if (protocols !== prevProtocols || visible !== prevVisible) {
    setPrevProtocols(protocols)
    setPrevVisible(visible)

    if (!visible) {
      setSelected({})
      setError(null)
      setLoading(false)
    } else if (protocols.length > 0 && protocols !== prevProtocols) {
      const initial = {}
      protocols.forEach(p => { initial[p.id] = true })
      setSelected(initial)
    }
  }

  function toggleProtocol(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleConfirm() {
    const selectedIds = Object.keys(selected).filter(id => selected[id])
    if (selectedIds.length === 0) {
      setError('Selecione pelo menos um medicamento.')
      return
    }

    setLoading(true)
    setError(null)

    const logsData = selectedIds.map(id => {
      const p = protocols.find(p => p.id === id)
      return {
        protocol_id: p.id,
        medicine_id: p.medicine?.id ?? p.medicine_id,
        taken_at: getNow().toISOString(),
        quantity_taken: p.dosage_per_intake ?? 1,
      }
    })

    const result = await registerDoseMany(logsData)
    setLoading(false)

    if (!result.success && result.results.length === 0) {
      setError(result.error ?? 'Erro ao registrar doses.')
      return
    }

    const successCount = result.results.filter(r => r.success).length
    if (successCount > 0) {
      onSuccess({ successCount })
    } else {
      setError(result.error ?? 'Nenhuma dose foi registrada.')
    }
  }

  function handleClose() {
    if (loading) return
    onClose()
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const header = mode === 'plan'
    ? (treatmentPlanName ?? 'Plano de tratamento')
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

          {protocolsLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : protocolsError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{protocolsError}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {protocols.map(p => {
                const isChecked = !!selected[p.id]
                const medicineName = p.medicine?.name ?? p.name ?? 'Medicamento'
                const dose = `${p.dosage_per_intake ?? 1} cp`
                return (
                  <Pressable
                    key={p.id}
                    style={styles.item}
                    onPress={() => toggleProtocol(p.id)}
                    disabled={loading}
                  >
                    {isChecked
                      ? <CheckCircle size={22} color={colors.brand.primary} strokeWidth={2} />
                      : <Circle size={22} color={colors.neutral[300]} strokeWidth={2} />
                    }
                    <View style={styles.itemText}>
                      <Text style={[styles.medicineName, !isChecked && styles.unchecked]}>
                        {medicineName}
                      </Text>
                      <Text style={styles.doseInfo}>{dose}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
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
  doseInfo: {
    fontSize: 12,
    color: colors.text.secondary,
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
})
