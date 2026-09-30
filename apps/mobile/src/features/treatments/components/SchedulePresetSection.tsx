// SchedulePresetSection.tsx — "Quantas vezes ao dia?" + horários (spec 086 US-1/US-2).
//
// Controlado por `value: string[]` (o `time_schedule`). O preset marcado, a âncora ("primeira dose do
// dia") e o aviso de madrugada são DERIVADOS de `value` a cada render (FR-005, INV-2): não existe
// estado de preset que sobreviva a uma edição manual.
//
// "Outro" (PO, smoke 2026-09-29) é o estado de EXCEÇÃO: marcado quando os horários não casam com
// nenhum dos 4 presets. Tocá-lo limpa a lista para a pessoa escolher os próprios horários, e não tem
// "primeira dose do dia". Único estado local: "tocou em Outro", válido SÓ com a lista vazia (senão o
// chip se desmarcaria no instante do toque); com horários, a derivação volta a mandar. Tocar num chip só chama
// `onChange(computePresetSchedule(n, âncora))`; editar um horário na lista é edição manual e o
// conjunto deixa de ser reconhecido sozinho. Usado pelo formulário completo e pelo passo 3 do
// onboarding (FR-011) — nunca duplicar para uma tela só.
//
// API:
//   value: string[] — "HH:MM" (24h)
//   onChange: (string[]) => void
//   error?: string
//   showPresets?: boolean — só `diário`/`dias_alternados` (FR-008); false ⇒ só a lista, como antes

import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 — ver TimeSchedulePicker
import * as LucideIcons from 'lucide-react-native'
const { Moon } = LucideIcons as any
import {
  SCHEDULE_PRESETS,
  DEFAULT_ANCHORS,
  computePresetSchedule,
  deriveSchedulePreset,
  deriveAnchor,
  findEarlyMorningDose,
  getNow,
} from '@dosiq/core'
import type { SchedulePresetKey } from '@dosiq/core'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import { FormTimePicker } from '@shared/components/form'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const PRESET_KEYS = Object.keys(SCHEDULE_PRESETS) as SchedulePresetKey[]

const PRESET_LABELS: Record<SchedulePresetKey, string> = {
  // Contagem primeiro (responde "Quantas vezes ao dia?") + a expressão da receita/busca ("8 em 8h").
  '1x': '1x ao dia',
  '12h': '2x (12 em 12h)',
  '8h': '3x (8 em 8h)',
  '6h': '4x (6 em 6h)',
}

// Leitor de tela lê por extenso (FR-001).
const PRESET_A11Y_LABELS: Record<SchedulePresetKey, string> = {
  '1x': 'Uma vez ao dia',
  '12h': '2 vezes ao dia, de 12 em 12 horas',
  '8h': '3 vezes ao dia, de 8 em 8 horas',
  '6h': '4 vezes ao dia, de 6 em 6 horas',
}

const CUSTOM_LABEL = 'Outro'
const CUSTOM_A11Y_LABEL = 'Outros horários, escolhidos por você'

function earlyMorningNotice(time: string): string {
  return `A dose das ${time} cai de madrugada. Se preferir, ajuste a primeira dose do dia.`
}

function timeToDate(time: string): Date {
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10) || 0)
  const d = getNow()
  d.setHours(hh, mm, 0, 0)
  return d
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isPresetKey(value: unknown): value is SchedulePresetKey {
  return typeof value === 'string' && value in SCHEDULE_PRESETS
}

export default function SchedulePresetSection({
  value = [],
  onChange,
  error = null,
  showPresets = true,
}: {
  value?: string[]
  onChange: (next: string[]) => void
  error?: string | null
  showPresets?: boolean
}) {
  // States — "tocou em Outro"; só vale com a lista vazia (ver cabeçalho)
  const [customIntent, setCustomIntent] = useState(false)
  // Memos — tudo derivado de `value` (PO-2: nenhum estado paralelo que sobreviva à edição)
  const preset = useMemo(() => (showPresets ? deriveSchedulePreset(value) : null), [showPresets, value])
  const activeKey = isPresetKey(preset) ? preset : null
  const anchor = useMemo(() => (activeKey ? deriveAnchor(value) : null), [activeKey, value])
  const doses = activeKey ? SCHEDULE_PRESETS[activeKey] : 0
  const earlyDose = useMemo(() => (doses >= 2 ? findEarlyMorningDose(value) : null), [doses, value])
  const isCustom = showPresets && (preset === 'manual' || (customIntent && value.length === 0))

  // Handlers
  const handlePresetPress = useCallback(
    (key: SchedulePresetKey) => {
      if (key === activeKey) return
      selectionTap()
      setCustomIntent(false)
      // FR-004: troca preserva a âncora corrente; sem preset reconhecido, âncora padrão (FR-003).
      const nextAnchor = anchor ?? DEFAULT_ANCHORS[key]
      onChange(computePresetSchedule(SCHEDULE_PRESETS[key], nextAnchor))
    },
    [activeKey, anchor, onChange]
  )

  const handleCustomPress = useCallback(() => {
    if (isCustom) return
    selectionTap()
    setCustomIntent(true)
    onChange([])
  }, [isCustom, onChange])

  const handleAnchorChange = useCallback(
    (_name: string, date: Date) => {
      if (!activeKey || !date) return
      onChange(computePresetSchedule(SCHEDULE_PRESETS[activeKey], dateToTime(date)))
    },
    [activeKey, onChange]
  )

  return (
    <View style={styles.container}>
      {showPresets ? (
        <View style={styles.block}>
          <Text style={styles.question}>Quantas vezes ao dia?</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" testID="schedule-presets">
            {PRESET_KEYS.map((key) => {
              const checked = key === activeKey
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePresetPress(key)}
                  style={({ pressed }) => [styles.chip, checked && styles.chipActive, pressed && styles.chipPressed]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  accessibilityLabel={PRESET_A11Y_LABELS[key]}
                  testID={`schedule-preset-${key}`}
                >
                  <Text style={[styles.chipText, checked && styles.chipTextActive]}>{PRESET_LABELS[key]}</Text>
                </Pressable>
              )
            })}
            <Pressable
              onPress={handleCustomPress}
              style={({ pressed }) => [styles.chip, isCustom && styles.chipActive, pressed && styles.chipPressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isCustom }}
              accessibilityLabel={CUSTOM_A11Y_LABEL}
              testID="schedule-preset-custom"
            >
              <Text style={[styles.chipText, isCustom && styles.chipTextActive]}>{CUSTOM_LABEL}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* FR-023 (2): âncora só com ≥2 doses — com 1x o próprio horário da lista é o controle */}
      {anchor && doses >= 2 ? (
        <FormTimePicker
          name="schedule_anchor"
          label="Primeira dose do dia"
          value={timeToDate(anchor)}
          onChange={handleAnchorChange}
        />
      ) : null}

      <TimeSchedulePicker value={value} onChange={onChange} error={error} />

      {earlyDose ? (
        <View style={styles.notice} accessibilityLiveRegion="polite" testID="schedule-early-notice">
          <Moon size={16} color={colors.status.info} />
          <Text style={styles.noticeText}>{earlyMorningNotice(earlyDose)}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  block: {
    gap: spacing[2],
  },
  question: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  // FR-024: quebra linha, nunca rolagem horizontal; alvo ≥48 dp.
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[700],
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  // FR-009: informação, nunca erro.
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.infoLight,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.status.info,
  },
})
