// OtherMedicineSheet — a caixa lida na compra é de OUTRO remédio (spec 066 D2 · C-14, smoke 2026-10-18).
//
// A mensagem inline no form não parecia alerta: a pessoa voltava ao form sem perceber que nada tinha
// mudado. O sheet bloqueia e dá os dois caminhos: registrar a compra da caixa lida (a aba Estoque
// resolve qual remédio é) ou continuar nesta compra, com o form intacto. Nada é gravado aqui (INV-1).

import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import PrimaryButton from '@shared/components/ui/PrimaryButton'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const { AlertTriangle } = LucideIcons as any

interface OtherMedicineSheetProps {
  readName: string
  currentName: string | null
  onSwitch: () => void
  onKeep: () => void
}

export function OtherMedicineSheet({ readName, currentName, onSwitch, onKeep }: OtherMedicineSheetProps) {
  const current = currentName || 'o remédio selecionado'
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKeep} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={onKeep} accessibilityLabel="Fechar" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <AlertTriangle size={22} color={colors.status.warning} />
          <Text style={styles.title} accessibilityRole="header">
            Esta caixa é de outro remédio
          </Text>
        </View>
        <Text style={styles.body}>
          Você leu {readName}, mas esta compra é de {current}. Nada foi alterado na compra.
        </Text>
        <PrimaryButton label={`Registrar compra de ${readName}`} onPress={onSwitch} style={styles.primary} />
        <Pressable onPress={onKeep} hitSlop={8} accessibilityRole="button" style={styles.secondary}>
          <Text style={styles.secondaryText}>Continuar com {current}</Text>
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
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  primary: {
    marginTop: spacing[3],
  },
  secondary: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[500],
    textAlign: 'center',
  },
})
