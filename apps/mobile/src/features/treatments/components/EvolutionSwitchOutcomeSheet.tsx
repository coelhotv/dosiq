import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Check, PauseCircle, Bell, Box } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

/**
 * EvolutionSwitchOutcomeSheet — transparência da automação pós-confirmação
 * (spec 029 F5 / T024 · Decisões §3.3 · PO-1 · Constituição IX).
 *
 * Depois que o usuário toca `[Iniciar etapa]`, o app executa VÁRIAS coisas de uma vez: pausa o
 * tratamento do medicamento antigo, ativa/cria o do novo e reaponta os lembretes. Esconder isso
 * seria o oposto do Princípio IX — o paciente precisa saber o que mudou no tratamento dele.
 * Este sheet lista o que aconteceu MECANICAMENTE, sem interpretação clínica.
 *
 * O rodapé de estoque (PO-4) usa o vocabulário do congelamento da 044: nada é apagado, nada é
 * transferido — o saldo do medicamento anterior fica guardado como está.
 */
export interface SwitchOutcomeLine {
  kind: 'paused' | 'activated' | 'reminders'
  /** Ex.: "Semaglutida 0,25 mg" · "Lembretes". */
  label: string
  /** Ex.: "Tratamento pausado" · "Quinta · 22:00 · 0,5 mg". */
  value: string
}

interface EvolutionSwitchOutcomeSheetProps {
  visible: boolean
  stepNumber: number
  lines: SwitchOutcomeLine[]
  /** Medicamento cujo estoque foi congelado. Vazio omite o rodapé (modo dose-only da 044). */
  frozenStockMedicineName?: string
  onClose: () => void
  /** `[Ver o tratamento]` — leva ao detalhe, onde a timeline já mostra a etapa vigente nova. */
  onOpenTreatment: () => void
}

const ICON_BY_KIND = {
  paused: PauseCircle,
  activated: Check,
  reminders: Bell,
} as const

export default function EvolutionSwitchOutcomeSheet({
  visible,
  stepNumber,
  lines,
  frozenStockMedicineName,
  onClose,
  onOpenTreatment,
}: EvolutionSwitchOutcomeSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} accessibilityViewIsModal accessibilityRole="summary">
          <View style={styles.grabber} />
          <Text style={styles.title}>Etapa {stepNumber} iniciada</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {lines.map((line) => {
              const Icon = ICON_BY_KIND[line.kind]
              return (
                <View
                  key={`${line.kind}-${line.label}`}
                  style={styles.line}
                  accessibilityLabel={`${line.label}: ${line.value}`}
                >
                  <Icon size={18} color={colors.brand.primary} strokeWidth={2} />
                  <View style={styles.lineText}>
                    <Text style={styles.lineLabel}>{line.label}</Text>
                    <Text style={styles.lineValue}>{line.value}</Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>

          {!!frozenStockMedicineName && (
            <View style={styles.footer}>
              <Box size={16} color={colors.text.secondary} strokeWidth={2} />
              <Text style={styles.footerText}>
                O estoque da {frozenStockMedicineName} fica guardado como está — nada é apagado.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={onOpenTreatment}
            accessibilityRole="button"
            accessibilityLabel="Ver o tratamento"
          >
            <Text style={styles.ctaText}>Ver o tratamento</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <Text style={styles.dismissText}>Fechar</Text>
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
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  list: { flexGrow: 0 },
  listContent: { gap: spacing[3] },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  lineText: { flex: 1 },
  lineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  lineValue: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[4],
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
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
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  dismiss: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing[1],
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  pressed: { opacity: 0.85 },
})
