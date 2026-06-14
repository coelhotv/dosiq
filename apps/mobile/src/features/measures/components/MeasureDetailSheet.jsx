// MeasureDetailSheet.jsx — detalhe de uma medida (012 Fase C · US3b). Espelha o sheet de dose:
// Editar registro · Ver o dia completo · Excluir registro. Modal Android-safe (R-233).

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ruler, Pencil, Trash2 } from 'lucide-react-native'
import { BIOMARKER_TYPE_LABELS, BIOMARKER_CONTEXT_LABELS, formatDateTimePtBR } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'

function formatMeasure(item) {
  const v = String(item.value).replace('.', ',')
  if (item.value_secondary != null) return `${v}/${String(item.value_secondary).replace('.', ',')} ${item.unit}`
  return `${v} ${item.unit}`
}

export default function MeasureDetailSheet({ open, item, onClose, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!item) return null
  const label = BIOMARKER_TYPE_LABELS[item.type] || item.type
  const ctx = item.context ? BIOMARKER_CONTEXT_LABELS[item.context] : null
  const when = formatDateTimePtBR(item.measured_at)

  function close() {
    if (deleting) return
    setConfirming(false)
    onClose?.()
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      await onDelete?.(item)
      setConfirming(false)
      setDeleting(false)
      onClose?.()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <Modal visible={!!open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <Ruler size={22} color={colors.status.info} strokeWidth={2} />
          </View>
          <Text style={styles.value}>{formatMeasure(item)}</Text>
          <Text style={styles.meta}>{label}{ctx ? ` · ${ctx}` : ''} · {when}</Text>

          {!confirming ? (
            <View style={styles.actions}>
              <Pressable style={styles.action} onPress={() => { selectionTap(); onEdit?.(item) }} accessibilityRole="button" accessibilityLabel="Editar medida">
                <Pencil size={18} color={colors.text.primary} strokeWidth={2} />
                <Text style={styles.actionText}>Editar medida</Text>
              </Pressable>
              <Pressable style={styles.action} onPress={() => { selectionTap(); setConfirming(true) }} accessibilityRole="button" accessibilityLabel="Excluir registro">
                <Trash2 size={18} color={colors.status.error} strokeWidth={2} />
                <Text style={[styles.actionText, { color: colors.status.error }]}>Excluir registro</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>Excluir esta medida? Não pode ser desfeito.</Text>
              <View style={styles.confirmRow}>
                <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => setConfirming(false)} disabled={deleting} accessibilityRole="button" accessibilityLabel="Cancelar">
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnDelete, deleting && styles.btnDisabled]} onPress={handleDelete} disabled={deleting} accessibilityRole="button" accessibilityLabel="Confirmar exclusão">
                  <Text style={styles.btnDeleteText}>{deleting ? 'Excluindo…' : 'Excluir'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg.overlay },
  sheet: {
    backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[6], maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.neutral[300], marginBottom: spacing[4] },
  iconWrap: { alignSelf: 'center', width: 48, height: 48, borderRadius: borderRadius.full, backgroundColor: colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  value: { fontSize: 28, fontWeight: '700', color: colors.text.primary, textAlign: 'center', fontFamily: typography.fontFamily.bold },
  meta: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[1], marginBottom: spacing[4] },
  actions: { gap: spacing[1] },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4], paddingHorizontal: spacing[2], minHeight: 48 },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  confirmBox: { gap: spacing[3], paddingTop: spacing[2] },
  confirmText: { fontSize: 14, color: colors.text.primary, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: spacing[3] },
  btn: { flex: 1, paddingVertical: spacing[4], borderRadius: borderRadius.md, alignItems: 'center' },
  btnCancel: { backgroundColor: colors.neutral[100] },
  btnDelete: { backgroundColor: colors.status.error },
  btnDisabled: { opacity: 0.6 },
  btnCancelText: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  btnDeleteText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
})
