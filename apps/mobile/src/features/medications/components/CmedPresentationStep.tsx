import { useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import { formatStrength, PRESENTATION_LABELS, type PickerConcentration } from '@dosiq/core'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const { ChevronLeft } = LucideIcons as any

// Passo 2 da busca 2C (spec 066 Slice C · DESIGN_DECISOES C5.2, revisto pelo PO no smoke 2026-10-13).
// Pergunta só a concentração (+ forma): a quantidade não muda o cadastro e volta no estoque (D2).
// Marca com 2+ fabricantes na concentração abre um 2º nível de laboratório (o registro muda).
// "‹" volta um nível (laboratório → concentração → busca); "Minha embalagem não está aqui" sempre
// disponível (INV-3).

interface CmedPresentationStepProps {
  title: string
  options: PickerConcentration[]
  preparing?: boolean
  onPick: (rowIdx: number) => void
  onSkip: () => void
  onBack: () => void
}

export function concentrationLabel(option: Pick<PickerConcentration, 'strength' | 'dose' | 'unit'>): string {
  return formatStrength(option.strength, option.dose, option.unit) ?? 'Concentração não informada'
}

export function formLabel(form: string | null): string | null {
  if (!form) return null
  return (PRESENTATION_LABELS as Record<string, string>)[form]?.toLowerCase() ?? null
}

export function CmedPresentationStep({
  title,
  options,
  preparing = false,
  onPick,
  onSkip,
  onBack,
}: CmedPresentationStepProps) {
  // States
  // Concentração única com 2+ fabricantes já abre no nível do laboratório.
  const [selected, setSelected] = useState<PickerConcentration | null>(() =>
    options.length === 1 && options[0].laboratories.length >= 2 ? options[0] : null,
  )
  const onLabLevel = !!selected && selected.laboratories.length >= 2

  // Handlers
  function handleBack() {
    if (onLabLevel && options.length > 1) setSelected(null)
    else onBack()
  }

  function handleConcentration(option: PickerConcentration) {
    selectionTap()
    if (option.laboratories.length >= 2) setSelected(option)
    else onPick(option.rowIdx)
  }

  function handleLab(rowIdx: number) {
    selectionTap()
    onPick(rowIdx)
  }

  function renderBody() {
    if (preparing) {
      return (
        <View style={styles.preparing} accessibilityRole="progressbar" accessibilityLabel="Buscando as embalagens">
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={styles.preparingText}>Buscando na lista completa de embalagens da ANVISA...</Text>
        </View>
      )
    }
    if (onLabLevel && selected) {
      const form = formLabel(selected.form)
      return (
        <>
          <Text style={styles.subheading}>{concentrationLabel(selected)}{form ? ` · ${form}` : ''}</Text>
          <Text style={styles.body}>Qual laboratório está escrito na sua embalagem?</Text>
          {selected.laboratories.map((lab) => (
            <Pressable
              key={`l-${lab.rowIdx}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleLab(lab.rowIdx)}
              accessibilityRole="button"
              accessibilityLabel={lab.laboratory ?? 'Laboratório não informado'}
            >
              <Text style={styles.rowTitle}>{lab.laboratory ?? 'Laboratório não informado'}</Text>
            </Pressable>
          ))}
        </>
      )
    }
    return (
      <>
        <Text style={styles.body}>Escolha a concentração escrita na embalagem ou na receita.</Text>
        {options.map((option) => {
          const label = concentrationLabel(option)
          const form = formLabel(option.form)
          return (
            <Pressable
              key={`c-${option.rowIdx}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleConcentration(option)}
              accessibilityRole="button"
              accessibilityLabel={form ? `${label}, ${form}` : label}
            >
              <Text style={styles.rowTitle}>{label}</Text>
              {form ? <Text style={styles.rowSubtitle}>{form}</Text> : null}
            </Pressable>
          )
        })}
      </>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.heading}>Qual embalagem você tem?</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.product}>{title}</Text>
        {renderBody()}
      </ScrollView>
      <Pressable onPress={onSkip} style={styles.skip} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.skipText}>Minha embalagem não está aqui</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  back: {
    marginLeft: -spacing[1],
  },
  heading: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  product: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  row: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  rowPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  preparing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  preparingText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
  },
})

export default CmedPresentationStep
