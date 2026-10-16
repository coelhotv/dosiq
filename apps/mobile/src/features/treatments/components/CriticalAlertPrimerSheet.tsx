import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { BellRing } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

/**
 * CriticalAlertPrimerSheet — explica o pedido de Critical Alerts ANTES do diálogo do iOS
 * (spec 054 FR-002/FR-008b). O iOS pergunta uma vez só: negado ali, só em Ajustes. Por isso o
 * contexto vem antes, e "Agora não" não gasta o diálogo.
 *
 * Variante `android` (054, emenda FR-008): o mesmo sheet substitui o modal do guia de tela cheia
 * (Android 14+/Xiaomi) — "Continuar" abre os Ajustes e o sheet fica, para a pessoa voltar e fechar.
 */
interface CriticalAlertPrimerSheetProps {
  visible: boolean
  variant?: 'ios' | 'android'
  /** Android: texto do passo extra (genérico ou Xiaomi). */
  androidMessage?: string
  /** Push negado: lembretes do servidor seguem desligados; só o alarme do aparelho toca (S6). */
  pushDenied: boolean
  onContinue: () => void
  onDismiss: () => void
}

export default function CriticalAlertPrimerSheet({
  visible,
  variant = 'ios',
  androidMessage = '',
  pushDenied,
  onContinue,
  onDismiss,
}: CriticalAlertPrimerSheetProps) {
  const isAndroid = variant === 'android'
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      // R-233 / AP-165: padrão Android-safe dos sheets da casa.
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.icon}>
            <BellRing size={24} color={colors.brand.primary} strokeWidth={2} />
          </View>
          <Text style={styles.title}>{isAndroid ? 'Falta um passo no seu celular' : 'Alarme que toca mesmo no silencioso'}</Text>
          <Text style={styles.body}>
            {isAndroid
              ? androidMessage
              : 'Para doses que não podem ser esquecidas, o iPhone pode tocar o alarme alto mesmo no silencioso e no Foco. Na próxima tela, toque em Permitir.'}
          </Text>
          {!isAndroid && pushDenied ? (
            <Text style={styles.note}>
              As notificações do dosiq estão desligadas: os lembretes comuns continuam sem chegar, mas o
              alarme crítico deste aparelho vai tocar.
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel={isAndroid ? 'Abrir configurações' : 'Continuar'}
          >
            <Text style={styles.ctaText}>{isAndroid ? 'Abrir configurações' : 'Continuar'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={isAndroid ? 'Fechar' : 'Agora não'}
          >
            <Text style={styles.dismissText}>{isAndroid ? 'Fechar' : 'Agora não'}</Text>
          </Pressable>
        </View>
      </View>
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
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing[5],
    paddingBottom: spacing[6],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginBottom: spacing[4],
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  body: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  note: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[4],
  },
  cta: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing[5],
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
  dismiss: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing[1],
  },
  dismissText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  pressed: { opacity: 0.85 },
})
