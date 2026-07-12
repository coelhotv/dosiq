// StockFreezeSheet.tsx — confirmação do opt-out do controle de estoque (spec 044, T014).
//
// Congela, NÃO deleta: ícone de cadeado, botão primário comum — deliberadamente NÃO é uma
// ação `danger` (§7 das decisões de design). Copy canônica (§9): 2 frases, máximo.
// R-233: statusBarTranslucent + spacer Android + SafeAreaView edges=['bottom'].

import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Lock } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface Props {
  visible: boolean
  applying: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function StockFreezeSheet({ visible, applying, onConfirm, onCancel }: Props) {
  if (!visible) return null

  return (
    // `onRequestClose` = botão voltar do Android: inibido enquanto a escrita está em voo, senão
    // o sheet some no meio da operação e a UI passa a opinar sobre um resultado inexistente.
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={applying ? undefined : onCancel}
      statusBarTranslucent
    >
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={applying ? undefined : onCancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.iconWrap}>
          <Lock size={24} color={colors.primary[600]} strokeWidth={2} />
        </View>

        <Text style={styles.title}>Desativar o controle de estoque?</Text>
        <Text style={styles.description}>
          Seu estoque fica guardado como está — nada é apagado. Você deixa de ver saldos e avisos
          de reposição até reativar.
        </Text>

        <Pressable
          onPress={onConfirm}
          disabled={applying}
          style={({ pressed }) => [styles.btnPrimary, (pressed || applying) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Desativar o controle de estoque"
        >
          {applying ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.btnPrimaryText}>Desativar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={applying}
          style={({ pressed }) => [styles.btnCancel, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={styles.btnCancelText}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
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
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[5],
  },
  btnPrimary: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  btnCancel: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
})
