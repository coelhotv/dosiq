// TreatmentCard.jsx — card de exibição de um tratamento
// R-166: UX Parity P-011

import { View, Text, StyleSheet, Pressable } from 'react-native'
import SectionCard from '@shared/components/ui/SectionCard'
import EvolutionBadge from './EvolutionBadge'
import { colors, spacing } from '@shared/styles/tokens'
import { formatDatePtBR, getProtocolDays, formatIntakeDose, formatConcentration } from '@dosiq/core'

const VALID_TAB_STATUSES = ['ativo', 'pausado', 'finalizado']

/**
 * @param {{
 *   treatment: {
 *     name: string,
 *     frequency: string,
 *     time_schedule: string[],
 *     dosage_per_intake: number,
 *     titration_status: string,
 *     medicine: { name: string, type: string }
 *   },
 *   tabStatus?: 'ativo'|'pausado'|'finalizado',
 *   endDate?: string|null,
 *   onPress?: () => void
 * }} props
 */
function getFrequencyLabel(freq, treatment) {
  const map = {
    'diário': 'Todos os dias',
    'dias_alternados': 'Dias alternados',
    'semanal': 'Semanal',
    'quando_necessário': 'Quando necessário',
    'personalizado': 'Personalizado'
  }
  const label = map[freq] || freq
  if (freq === 'semanal' || freq === 'personalizado') {
    const daysSource = getProtocolDays(treatment)
    if (daysSource.length > 0) {
      const WEEKDAY_ABBREVIATIONS = {
        domingo: 'Dom',
        segunda: 'Seg',
        terça: 'Ter',
        quarta: 'Qua',
        quinta: 'Qui',
        sexta: 'Sex',
        sábado: 'Sáb',
      }
      const VISUAL_ORDER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
      const sorted = [...daysSource].sort(
        (a, b) => VISUAL_ORDER.indexOf(a) - VISUAL_ORDER.indexOf(b)
      )
      const daysText = sorted.map((d) => WEEKDAY_ABBREVIATIONS[d] || d).join(', ')
      return `${label} (${daysText})`
    }
  }
  return label
}

function renderStatusBadge(isPaused, isFinished, endDate) {
  if (isPaused) {
    return (
      <View style={styles.badgePaused}>
        <Text style={styles.badgeText}>Pausado</Text>
      </View>
    )
  }
  if (isFinished) {
    const dateLabel = endDate ? formatDatePtBR(endDate) : null
    const label = dateLabel ? `Finalizado em ${dateLabel}` : 'Finalizado'
    return (
      <View style={styles.badgeFinished}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    )
  }
  return null
}

export default function TreatmentCard({ treatment, onPress, tabStatus = 'ativo', endDate = null }) {
  const { name, frequency, time_schedule, dosage_per_intake, intake_unit, medicine } = treatment


  // Dose exibida (022): helper único líquido/sólido (evita drift entre telas).
  const doseDisplay = formatIntakeDose(dosage_per_intake, intake_unit, medicine)

  // Normalizar tabStatus; fallback defensivo para valores inválidos
  const resolvedStatus = VALID_TAB_STATUSES.includes(tabStatus) ? tabStatus : 'ativo'

  const isPaused = resolvedStatus === 'pausado'
  const isFinished = resolvedStatus === 'finalizado'
  const isMuted = isPaused || isFinished

  const cardStyle = isFinished ? styles.cardFinished : undefined
  const iconMutedStyle = isMuted ? styles.iconMuted : undefined
  const textMutedStyle = isMuted ? styles.textMuted : undefined
  const textMutedOpacityStyle = isMuted ? styles.textMutedOpacity : undefined
  const contentMutedStyle = isMuted ? styles.contentMuted : undefined

  const card = (
    <SectionCard
      style={cardStyle}
      title={
        <View style={styles.titleWrapper}>
          <View style={[styles.iconMutedWrapper, iconMutedStyle]}>
            <Text style={[styles.titleText, textMutedStyle]}>
              {medicine?.name || name}
            </Text>
          </View>
          {medicine?.dosage_per_pill && (
            <View style={[styles.dosagePill, textMutedOpacityStyle]}>
              <Text style={styles.dosagePillText}>
                {formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit, medicine.concentration_volume_ml)}
              </Text>
            </View>
          )}
          {renderStatusBadge(isPaused, isFinished, endDate)}
        </View>
      }
      headerAction={<EvolutionBadge steps={treatment.titration_steps} paused={isPaused} />}
    >
      <View style={[styles.content, contentMutedStyle]}>
        <View style={styles.row}>
          <Text style={styles.label}>Frequência:</Text>
          <Text style={styles.value}>{getFrequencyLabel(frequency, treatment)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Dose por tomada:</Text>
          <Text style={styles.value}>{doseDisplay}</Text>
        </View>

        {time_schedule && time_schedule.length > 0 && (
          <View style={styles.scheduleContainer}>
            <Text style={styles.label}>Horários:</Text>
            <View style={styles.timesList}>
              {time_schedule.map((time, idx) => (
                <View key={idx} style={styles.timeTag}>
                  <Text style={styles.timeText}>{time}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </SectionCard>
  )

  if (!onPress) return card

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`Abrir tratamento ${medicine?.name || name}`}
    >
      {card}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Card wrapper para estado finalizado
  cardFinished: {
    backgroundColor: colors.neutral[50],
  },
  // Opacidade do ícone/nome no estado pausado (0.6)
  iconMutedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMuted: {
    opacity: 0.6,
  },
  // Opacidade de textos no estado pausado (0.8) e finalizado (0.7)
  textMuted: {
    opacity: 0.8,
  },
  textMutedOpacity: {
    opacity: 0.8,
  },
  contentMuted: {
    opacity: 0.7,
  },
  // Badge Pausado
  badgePaused: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Badge Finalizado
  badgeFinished: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  content: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
  scheduleContainer: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  timesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  timeTag: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  timeText: {
    fontSize: 13,
    color: colors.primary[700],
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
})
