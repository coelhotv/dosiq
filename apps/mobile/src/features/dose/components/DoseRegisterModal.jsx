// DoseRegisterModal.jsx — modal nativo para registo de dose tomada
// UX: modal simples com protocolo pré-seleccionado + quantidade + confirmação
// R5-003: menor fricção possível — mínimo de toques
// R5-008: online-first — doseService retorna erro claro se offline

import { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { getTodayLocal } from '@meus-remedios/core'
import { registerDose } from '../services/doseService'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * @param {{
 *   visible: boolean,
 *   protocol: Object|null,       — protocolo seleccionado
 *   medicineName: string,
 *   onClose: Function,
 *   onSuccess: Function,         — chamado após registo bem-sucedido
 * }} props
 */
export default function DoseRegisterModal({ visible, protocol, medicineName, onClose, onSuccess }) {
  // States primeiro (R-010)
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!protocol) return null

  const defaultQty = String(protocol.dosage_per_intake ?? 1)

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    const qty = parseFloat((quantity ?? defaultQty).toString().replace(',', '.'))
    if (!qty || qty <= 0) {
      setError('Quantidade deve ser maior que zero.')
      setLoading(false)
      return
    }

    // Padrão do projecto: timestamps sempre em UTC (new Date().toISOString())
    // O filtro do dashboard usa boundaries UTC derivadas do dia local (não raw YYYY-MM-DDT00:00:00)
    const takenAt = new Date().toISOString()

    const result = await registerDose({
      protocol_id: protocol.id,
      medicine_id: protocol.medicine_id,
      taken_at: takenAt,
      quantity_taken: qty,
    })

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Limpar estado e notificar tela pai
    setQuantity('')
    setError(null)
    onSuccess()
  }

  function handleClose() {
    setQuantity('')
    setError(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Tomar dose</Text>
          <Text style={styles.medicineName}>{medicineName}</Text>

          <Text style={styles.label}>Quantidade (comprimidos)</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={defaultQty}
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
            editable={!loading}
            selectTextOnFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmText}>Confirmar</Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  medicineName: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: -spacing[2],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  input: {
    backgroundColor: colors.bg.screen,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
  },
  error: {
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
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
