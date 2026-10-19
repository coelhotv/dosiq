// StrengthChoiceCard — concentração da caixa no form do remédio (spec 066 · C-C10 / D9).
//
// Composto ambíguo (dose vazia, INV-2): card com a força da embalagem e os botões de 1 toque por
// concentração. Sem pergunta pendente: só a referência "Na embalagem" (composto, ou força que o app não
// converte — B8 "500 mg/"). Extraído do `MedicineFormScreen` na Slice E para o onboarding usar o mesmo
// componente (reuso obrigatório, nunca cópia). Componente puro (sem state, sem effects).

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { formatStrength, type CmedStrengthChoice } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

interface StrengthChoiceCardProps {
  /** Composto ambíguo ainda sem dose escolhida. */
  askStrength: boolean
  /** Força completa da embalagem ("500 mg + 125 mg"); null = sem referência. */
  strengthLabel: string | null
  strengthChoices: CmedStrengthChoice[]
  onChoose: (choice: CmedStrengthChoice) => void
}

export function StrengthChoiceCard({ askStrength, strengthLabel, strengthChoices, onChoose }: StrengthChoiceCardProps) {
  if (askStrength) {
    return (
      <View style={styles.choiceBox}>
        <Text style={styles.choiceTitle}>Este remédio junta mais de uma substância</Text>
        {strengthLabel ? <Text style={styles.choiceText}>Na embalagem: {strengthLabel}</Text> : null}
        <Text style={styles.choiceText}>
          Qual concentração você quer usar no cadastro? Na dúvida, escolha a que aparece primeiro na embalagem ou na receita.
        </Text>
        <View style={styles.choiceRow}>
          {strengthChoices.map((choice) => {
            const label = formatStrength(`${choice.dose} ${choice.unit}`) ?? `${choice.dose} ${choice.unit}`
            return (
              <Pressable
                key={`${choice.dose}|${choice.unit}`}
                style={({ pressed }) => [styles.choiceChip, pressed && styles.choiceChipPressed]}
                onPress={() => onChoose(choice)}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${label}`}
              >
                <Text style={styles.choiceChipText}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
  if (strengthLabel) return <Text style={styles.strengthText}>Na embalagem: {strengthLabel}</Text>
  return null
}

export default StrengthChoiceCard

const styles = StyleSheet.create({
  choiceBox: {
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginTop: spacing[2],
    gap: spacing[2],
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  choiceText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  choiceChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  choiceChipPressed: {
    backgroundColor: colors.primary[50],
  },
  choiceChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
  },
  strengthText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
})
