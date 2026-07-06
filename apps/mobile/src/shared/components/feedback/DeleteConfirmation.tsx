import { useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AlertTriangle, X } from 'lucide-react-native'
import FormActions from '@shared/components/form/FormActions'
import { warningHaptic } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

export default function DeleteConfirmation({
  visible,
  title,
  description,
  itemName,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isLoading,
  onCancel,
  onConfirm,
}) {
  // Dispara haptic de aviso ao abrir o sheet
  useEffect(() => {
    if (visible) warningHaptic()
  }, [visible])

  function handleBackdropPress() {
    if (!isLoading) onCancel()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      {/* Backdrop semi-transparente — toque fecha */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackdropPress}
      />

      {/* Sheet deslizante inferior */}
      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          {/* Barra de arraste */}
          <View style={styles.dragHandleRow}>
            <View style={styles.dragHandle} />
          </View>

          {/* Cabeçalho */}
          <View style={styles.header}>
            <AlertTriangle
              size={22}
              color={colors.status.error}
              strokeWidth={2}
            />
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <X size={20} color={colors.text.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Corpo */}
          <View style={styles.body}>
            <Text style={styles.description}>{description}</Text>

            {/* Nome destacado do item (opcional) */}
            {itemName ? (
              <View style={styles.itemNameBox}>
                <Text style={styles.itemNameText}>{itemName}</Text>
              </View>
            ) : null}
          </View>

          {/* Rodapé com ações */}
          <View style={styles.footer}>
            <FormActions
              primaryLabel={confirmLabel}
              onPrimary={onConfirm}
              primaryLoading={isLoading}
              primaryDisabled={isLoading}
              secondaryLabel={cancelLabel}
              onSecondary={onCancel}
              destructive
            />
          </View>
        </SafeAreaView>
      </View>
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    paddingHorizontal: spacing[4],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  itemNameBox: {
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    borderLeftWidth: 3,
    borderLeftColor: colors.status.error,
  },
  itemNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
})
