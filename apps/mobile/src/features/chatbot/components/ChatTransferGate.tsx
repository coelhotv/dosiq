// ChatTransferGate.tsx — chat sem a autorização B (spec 096 S8b `chat`; espelho do ChatTransferGate web).
// Copy do core (`CHAT_WITHOUT_TRANSFER_COPY`). "Ver a autorização" abre a autorização completa da caixa B
// (guarda 11) — nunca um botão "ativar assistente".

import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { BotMessageSquare } = LucideIcons as any
import { CHAT_WITHOUT_TRANSFER_COPY as COPY } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface ChatTransferGateProps {
  onEnable: () => void
  onClose: () => void
}

export default function ChatTransferGate({ onEnable, onClose }: ChatTransferGateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <BotMessageSquare size={28} color={colors.brand.primary} strokeWidth={1.75} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
      <Text style={styles.body}>{COPY.body}</Text>
      <Pressable style={styles.primary} onPress={onEnable} accessibilityRole="button" accessibilityLabel={COPY.enable}>
        <Text style={styles.primaryText}>{COPY.enable}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button" accessibilityLabel={COPY.close}>
        <Text style={styles.secondaryText}>{COPY.close}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  icon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.text.primary, fontFamily: typography.fontFamily.bold },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: colors.text.secondary },
  primary: { minHeight: 52, marginTop: spacing[3], borderRadius: borderRadius.lg, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
  secondary: { minHeight: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
})
