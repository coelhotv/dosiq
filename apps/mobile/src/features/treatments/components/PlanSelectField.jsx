// PlanSelectField.jsx — seletor de plano terapêutico com 2 variações (Fase 2 T2.5).
// Spec §3.4 seção "ORGANIZAÇÃO".
//
// Modo SELECT (default): FormSelect com planos existentes + opção especial
// "+ Criar novo" no fim → muda para modo INLINE.
//
// Modo INLINE (PlanInlineCreate): card primaryBg com input "Nome" + paleta de
// cores (5 swatches) + paleta de emojis (6). Header tem link "Usar existente ↗"
// para voltar ao modo SELECT.
//
// Componente controlado:
//   value: { mode: 'select' | 'inline', planId?: string, inline?: { name, color, emoji } }
//   onChange: (newValue) => void
//
// Parent decide o que fazer no submit: se mode='inline' + inline.name preenchido,
// chamar treatmentPlanService.create({ name, color, emoji }) ANTES do protocolService.create.

import { useCallback } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { Check, ArrowUpRight } from 'lucide-react-native'
import FormSelect from '@shared/components/form/FormSelect'
import { selectionTap, lightTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const CREATE_NEW_VALUE = '__create_new__'

// Paleta sugerida (5 cores) — preferir tokens, mas paleta inline é PT-spec
// (não há "plan-color" no design tokens; cores escolhidas para boa diferenciação).
const COLOR_SWATCHES = [
  { id: 'teal', value: '#14b8a6' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'purple', value: '#8b5cf6' },
  { id: 'orange', value: '#f97316' },
  { id: 'rose', value: '#f43f5e' },
]

const EMOJI_CHOICES = ['💊', '🌿', '❤️', '🧠', '🔬', '✨']

export default function PlanSelectField({
  plans = [],
  value = { mode: 'select', planId: null, inline: null },
  onChange,
  error,
}) {
  // Handlers
  const handleSelectChange = useCallback(
    (_name, planId) => {
      if (planId === CREATE_NEW_VALUE) {
        // Alternar para modo inline com defaults
        onChange?.({
          mode: 'inline',
          planId: null,
          inline: {
            name: '',
            color: COLOR_SWATCHES[0].value,
            emoji: EMOJI_CHOICES[0],
          },
        })
      } else {
        onChange?.({ mode: 'select', planId: planId || null, inline: null })
      }
    },
    [onChange]
  )

  const handleBackToSelect = useCallback(() => {
    lightTap()
    onChange?.({ mode: 'select', planId: null, inline: null })
  }, [onChange])

  const handleInlineChange = useCallback(
    (patch) => {
      onChange?.({
        mode: 'inline',
        planId: null,
        inline: { ...value.inline, ...patch },
      })
    },
    [onChange, value.inline]
  )

  // Render — modo SELECT
  if (value.mode !== 'inline') {
    const options = [
      ...plans.map((p) => ({
        value: p.id,
        label: `${p.emoji ? `${p.emoji} ` : ''}${p.name}`,
      })),
      { value: CREATE_NEW_VALUE, label: '+ Criar novo plano' },
    ]

    return (
      <FormSelect
        name="treatment_plan"
        label="Plano terapêutico"
        value={value.planId}
        options={options}
        onChange={handleSelectChange}
        error={error}
        placeholder={plans.length ? 'Selecione um plano' : 'Sem planos cadastrados'}
      />
    )
  }

  // Render — modo INLINE
  const inline = value.inline ?? { name: '', color: COLOR_SWATCHES[0].value, emoji: EMOJI_CHOICES[0] }

  return (
    <View style={[styles.inlineCard, error && styles.inlineCardError]}>
      <View style={styles.inlineHeader}>
        <Text style={styles.inlineTitle}>Criar novo plano</Text>
        <Pressable
          onPress={handleBackToSelect}
          style={({ pressed }) => [styles.switchBtn, pressed && styles.switchBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Usar plano existente"
          hitSlop={6}
        >
          <Text style={styles.switchBtnText}>Usar existente</Text>
          <ArrowUpRight size={14} color={colors.primary[700]} />
        </Pressable>
      </View>

      <Text style={styles.inlineLabel}>Nome</Text>
      <TextInput
        value={inline.name}
        onChangeText={(name) => handleInlineChange({ name })}
        placeholder="Ex: Ansiolíticos"
        placeholderTextColor={colors.text.muted}
        style={styles.inlineInput}
        autoCapitalize="words"
        maxLength={50}
      />

      <Text style={styles.inlineLabel}>Cor</Text>
      <View style={styles.swatchRow}>
        {COLOR_SWATCHES.map((c) => {
          const isSelected = inline.color === c.value
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                selectionTap()
                handleInlineChange({ color: c.value })
              }}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: c.value },
                isSelected && styles.swatchSelected,
                pressed && styles.swatchPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar cor ${c.id}`}
              accessibilityState={{ selected: isSelected }}
            >
              {isSelected ? <Check size={18} color={colors.text.inverse} strokeWidth={3} /> : null}
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.inlineLabel}>Emoji</Text>
      <View style={styles.emojiRow}>
        {EMOJI_CHOICES.map((e) => {
          const isSelected = inline.emoji === e
          return (
            <Pressable
              key={e}
              onPress={() => {
                selectionTap()
                handleInlineChange({ emoji: e })
              }}
              style={({ pressed }) => [
                styles.emojiBtn,
                isSelected && styles.emojiBtnSelected,
                pressed && styles.emojiBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar emoji ${e}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          )
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  inlineCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  inlineCardError: {
    backgroundColor: colors.neutral[100],
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchBtnPressed: {
    opacity: 0.6,
  },
  switchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inlineInput: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.text.primary,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: colors.bg.card,
  },
  swatchPressed: {
    opacity: 0.85,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
  },
  emojiBtnSelected: {
    backgroundColor: colors.primary[100],
  },
  emojiBtnPressed: {
    opacity: 0.7,
  },
  emojiText: {
    fontSize: 22,
  },
  error: {
    fontSize: 12,
    color: colors.status.error,
  },
})
