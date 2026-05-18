// TreatmentCard.jsx — card de exibição de um tratamento
// R-166: UX Parity P-011

import { View, Text, StyleSheet, Pressable } from 'react-native'
import SectionCard from '../../../shared/components/ui/SectionCard'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { colors, spacing } from '../../../shared/styles/tokens'
import { formatDatePtBR } from '@dosiq/core'

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
export default function TreatmentCard({ treatment, onPress, tabStatus = 'ativo', endDate = null }) {
  const { name, frequency, time_schedule, dosage_per_intake, titration_status, medicine } = treatment

  // Normalizar tabStatus; fallback defensivo para valores inválidos
  const resolvedStatus = VALID_TAB_STATUSES.includes(tabStatus) ? tabStatus : 'ativo'

  const isPaused = resolvedStatus === 'pausado'
  const isFinished = resolvedStatus === 'finalizado'

  // Mapeamento de status da titulação para o badge (estáveis na web usam verde)
  const getStatusType = (status) => {
    switch (status) {
      case 'estável': return 'success'
      case 'ajustando': return 'warning'
      case 'desmamando': return 'info'
      default: return 'neutral'
    }
  }

  // Tradução do campo frequency para exibição (P-011 Paridade)
  const getFrequencyLabel = (freq) => {
    const map = {
      'diário': 'Todos os dias',
      'dias_alternados': 'Dias alternados',
      'semanal': 'Uma vez por semana',
      'quando_necessário': 'Quando necessário',
      'personalizado': 'Personalizado'
    }
    return map[freq] || freq
  }

  // Badge condicional de status (null se ativo)
  const renderStatusBadge = () => {
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

  const card = (
    <SectionCard
      style={isFinished ? styles.cardFinished : undefined}
      title={
        <View style={styles.titleWrapper}>
          <View style={[styles.iconMutedWrapper, (isPaused || isFinished) && styles.iconMuted]}>
            <Text style={[styles.titleText, (isPaused || isFinished) && styles.textMuted]}>
              {medicine?.name || name}
            </Text>
          </View>
          {medicine?.dosage_per_pill && (
            <View style={[styles.dosagePill, (isPaused || isFinished) && styles.textMutedOpacity]}>
              <Text style={styles.dosagePillText}>
                {medicine.dosage_per_pill}{medicine.dosage_unit}
              </Text>
            </View>
          )}
          {renderStatusBadge()}
        </View>
      }
      headerAction={<StatusBadge label={titration_status} type={getStatusType(titration_status)} />}
    >
      <View style={[styles.content, (isPaused || isFinished) && styles.contentMuted]}>
        <View style={styles.row}>
          <Text style={styles.label}>Frequência:</Text>
          <Text style={styles.value}>{getFrequencyLabel(frequency)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Dose por tomada:</Text>
          <Text style={styles.value}>{dosage_per_intake} unidade{dosage_per_intake !== 1 ? 's' : ''}</Text>
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
    textTransform: 'capitalize',
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
