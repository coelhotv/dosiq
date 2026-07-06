// LogoutSheet.jsx — bottom sheet de confirmação de logout (Fase 4 W3, PO-3).
// Mock: mock-perfil-sheet-logout. Vive sobre o Hub. R-233 (statusBarTranslucent).

import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { LogOut } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export default function LogoutSheet({ visible, loading, onCancel, onConfirm }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {Platform.OS === 'android' ? (
        <View style={{ height: StatusBar.currentHeight ?? 0 }} />
      ) : null}
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerIcon}>
          <LogOut size={26} color={colors.status.error} strokeWidth={2} />
        </View>

        <Text style={styles.title}>Sair da conta?</Text>
        <Text style={styles.description}>
          Você precisará entrar de novo para acessar seus tratamentos e estoque.
          Seus dados ficam salvos com segurança.
        </Text>

        <Pressable
          onPress={onConfirm}
          disabled={loading}
          style={({ pressed }) => [styles.btnDanger, (pressed || loading) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <View style={styles.btnDangerInner}>
              <LogOut size={18} color={colors.text.inverse} strokeWidth={2} />
              <Text style={styles.btnDangerText}>Sair da conta</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={loading}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
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
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.error + '1A',
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
  btnDanger: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  btnDangerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  btnDangerText: {
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
})
