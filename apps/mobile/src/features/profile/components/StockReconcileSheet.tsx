// StockReconcileSheet.tsx — reconciliação na reativação após gap >= 30 dias (spec 044, T016).
//
// Default VISUAL = "Começar do zero" (pré-selecionado); a escolha é sempre do usuário — nunca
// há reset automático por tempo. Fechar sem decidir NÃO ativa: a preferência continua OFF e o
// sheet reaparece na próxima tentativa (§6 das decisões de design).
// R-233: statusBarTranslucent + spacer Android + SafeAreaView edges=['bottom'].

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Check } = LucideIcons as any
import { parseISO, formatDatePtBR } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

type Choice = 'zero' | 'resume'

// Montado apenas enquanto o sheet está aberto (SettingsScreen): a desmontagem é o que devolve
// o `choice` ao default "Começar do zero" a cada nova tentativa.
interface Props {
  gapDays: number
  pausedAt: string | null
  applying: boolean
  onZero: () => void
  onResume: () => void
  onClose: () => void
}

/**
 * Data do congelamento em PT-BR; carimbo ausente/inválido → null (o rótulo cai no genérico).
 * `formatDatePtBR` (tabela manual de meses), NUNCA `toLocaleDateString('pt-BR')`: o Hermes não
 * tem ICU completo e cairia no formato US, mostrando "Retomar o saldo de 06/12/2026" para um
 * congelamento de 12 de junho.
 */
function pausedDateLabel(pausedAt: string | null): string | null {
  if (!pausedAt) return null
  const date = parseISO(pausedAt)
  if (Number.isNaN(date.getTime())) return null
  return formatDatePtBR(date) || null
}

function Option({
  selected,
  title,
  description,
  onPress,
  disabled,
}: {
  selected: boolean
  title: string
  description: string
  onPress: () => void
  disabled: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}. ${description}`}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check size={12} color={colors.text.inverse} strokeWidth={3} /> : null}
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
    </Pressable>
  )
}

export default function StockReconcileSheet({
  gapDays,
  pausedAt,
  applying,
  onZero,
  onResume,
  onClose,
}: Props) {
  const [choice, setChoice] = useState<Choice>('zero')

  const dateLabel = pausedDateLabel(pausedAt)
  const resumeTitle = dateLabel ? `Retomar o saldo de ${dateLabel}` : 'Retomar o saldo congelado'

  return (
    // `onRequestClose` = botão voltar do Android: inibido durante a escrita (o zeramento por
    // medicamento leva tempo) — fechar no meio deixaria a UI opinando sobre um resultado que
    // ainda não existe.
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={applying ? undefined : onClose}
      statusBarTranslucent
    >
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={applying ? undefined : onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>
          Seu estoque está congelado há {gapDays} {gapDays === 1 ? 'dia' : 'dias'}
        </Text>
        <Text style={styles.description}>Como você quer voltar a usar o estoque?</Text>

        <View accessibilityRole="radiogroup">
          <Option
            selected={choice === 'zero'}
            title="Começar do zero"
            description="O saldo volta a zero. O histórico de compras fica guardado."
            onPress={() => setChoice('zero')}
            disabled={applying}
          />
          <Option
            selected={choice === 'resume'}
            title={resumeTitle}
            description="Volta exatamente como estava quando você desativou."
            onPress={() => setChoice('resume')}
            disabled={applying}
          />
        </View>

        <Pressable
          onPress={choice === 'zero' ? onZero : onResume}
          disabled={applying}
          style={({ pressed }) => [styles.btnPrimary, (pressed || applying) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Ativar o controle de estoque"
        >
          {applying ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.btnPrimaryText}>Ativar estoque</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onClose}
          disabled={applying}
          style={({ pressed }) => [styles.btnCancel, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar — o controle de estoque continua desativado"
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[1],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 76,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.bg.screen,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  optionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: colors.primary[700],
  },
  optionDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  btnPrimary: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    marginTop: spacing[1],
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
