// ProtocolDetailScreen.jsx — tela de detalhe de tratamento (Fase 2 T1.7).
// Spec: EXEC_SPEC_FASE2_PROTOCOLOS.md §3.3
//
// v1 Sprint T2.1: leitura completa + navegação para medicamento + stub delete.
// Delete sheet com warning soft + stats chega em Sprint T2.2 (T2.11/T2.12).

import { useCallback, useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, Switch, StyleSheet } from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import {
  ArrowLeft,
  Pill,
  PillBottle,
  ChevronRight,
  Clock,
  Edit3,
  Trash2,
  CheckCircle2,
} from 'lucide-react-native'
import {
  formatDoseUnit,
  formatDatePtBR,
  formatEndDate,
  getNow,
  parseLocalDate,
  resolveTreatmentStatus,
  TREATMENT_STATUS,
} from '@dosiq/core'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import SectionCard from '@shared/components/ui/SectionCard'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import { useProtocol } from '@treatments/hooks/useProtocols'
import { useProtocolDelete } from '@treatments/hooks/useProtocolDelete'
import { useProtocolMutation } from '@treatments/hooks/useProtocolMutation'
import ProtocolDeleteSheet from '@treatments/components/ProtocolDeleteSheet'
import { lightTap, selectionTap } from '@shared/utils/haptics'
import { colors, spacing, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

const FREQUENCY_LABEL = {
  'diário': 'Todos os dias',
  'dias_alternados': 'Dias alternados',
  'semanal': 'Uma vez por semana',
  'quando_necessário': 'Quando necessário',
  'personalizado': 'Personalizado',
}

function daysInUse(startDate) {
  if (!startDate) return null
  const start = parseLocalDate(startDate)
  if (!start) return null
  const diffMs = getNow() - start.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export default function ProtocolDetailScreen() {
  // States
  const navigation = useNavigation()
  const route = useRoute()
  const id = route.params?.id
  const { data: protocol, loading, error, refresh } = useProtocol(id)
  const { confirmDelete, isLoading: isDeleting } = useProtocolDelete(protocol)
  const { toggleActive } = useProtocolMutation()
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Optimistic toggle state — Switch reflete intenção imediata; reverte se mutation falhar.
  const [activeOverride, setActiveOverride] = useState(null)
  const [toggling, setToggling] = useState(false)

  // Memos
  const frequencyLabel = useMemo(
    () => (protocol ? FREQUENCY_LABEL[protocol.frequency] ?? protocol.frequency : ''),
    [protocol]
  )

  const dailyIntakeTotal = useMemo(() => {
    if (!protocol) return null
    const perIntake = Number(protocol.dosage_per_intake) || 0
    const times = protocol.time_schedule?.length || 0
    return perIntake * times
  }, [protocol])

  const inUseDays = useMemo(() => daysInUse(protocol?.start_date), [protocol])

  // Fase 2.5 — status derivado (ativo/pausado/finalizado).
  // `activeOverride` permite optimistic UI no toggle Ligado/Desligado: enquanto
  // mutation roda, Switch reflete intenção do user; reverte se erro.
  const effectiveActive = activeOverride !== null ? activeOverride : (protocol?.active !== false)
  const treatmentStatus = useMemo(() => {
    if (!protocol) return TREATMENT_STATUS.ATIVO
    return resolveTreatmentStatus({ ...protocol, active: effectiveActive })
  }, [protocol, effectiveActive])
  const isFinished = treatmentStatus === TREATMENT_STATUS.FINALIZADO

  // Effects
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  // Handlers
  const goBack = useCallback(() => {
    lightTap()
    navigation.goBack()
  }, [navigation])

  const goEdit = useCallback(() => {
    selectionTap()
    navigation.navigate(ROUTES.PROTOCOL_FORM, { id })
  }, [navigation, id])

  const goToMedicine = useCallback(() => {
    if (!protocol?.medicine?.id) return
    selectionTap()
    navigation.navigate(ROUTES.MEDICINE_DETAIL, { id: protocol.medicine.id })
  }, [navigation, protocol])

  const onDelete = useCallback(() => {
    if (isDeleting) return
    lightTap()
    setDeleteOpen(true)
  }, [isDeleting])

  // Toggle Ligado/Desligado (Fase 2.5 §3.2)
  const handleToggleActive = useCallback(async (next) => {
    if (toggling || !protocol?.id) return
    selectionTap()
    setActiveOverride(next)  // optimistic
    setToggling(true)
    try {
      await toggleActive(protocol.id, next)
      // sucesso: refresh garante que protocol.active venha atualizado do server
      await refresh()
      setActiveOverride(null)
    } catch {
      setActiveOverride(!next)  // rollback visual
    } finally {
      setToggling(false)
    }
  }, [toggling, protocol, toggleActive, refresh])

  const handleConfirmDelete = useCallback(async () => {
    // useProtocolDelete encapsula: delete + cache invalidation + toast +
    // haptic + navigation.goBack on success. Pattern canônico mobile (T2.10).
    const ok = await confirmDelete()
    if (ok) setDeleteOpen(false)
  }, [confirmDelete])

  const handleCloseDelete = useCallback(() => {
    if (isDeleting) return
    setDeleteOpen(false)
  }, [isDeleting])

  if (loading && !protocol) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando tratamento..." />
      </ScreenContainer>
    )
  }

  if (error && !protocol) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    )
  }

  if (!protocol) {
    return (
      <ScreenContainer>
        <ErrorState message="Tratamento não encontrado." />
      </ScreenContainer>
    )
  }

  const medicine = protocol.medicine
  const isSupplement = medicine?.type === 'suplemento'
  const MedicineIcon = isSupplement ? PillBottle : Pill
  const heroIconBg = isSupplement ? colors.supplement[500] : colors.primary[600]
  const heroEyebrowColor = isSupplement ? colors.supplement[700] : colors.primary[700]
  const eyebrowLabel = isSupplement ? 'Suplemento' : 'Medicamento'

  return (
    <ScreenContainer>
      {/* AppBar */}
      <View style={styles.appbar}>
        <Pressable onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.appbarTitleWrap}>
          {/* AppBar mostra o NOME do tratamento (campo "Nome do tratamento"),
              não o nome do medicamento — esse fica no hero card abaixo. */}
          <Text style={styles.appbarTitle} numberOfLines={1}>
            {protocol.name}
          </Text>
        </View>
        <Pressable onPress={goEdit} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Editar tratamento" hitSlop={12}>
          <Edit3 size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero medicamento — clicável */}
        {medicine ? (
          <Pressable
            onPress={goToMedicine}
            style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Abrir medicamento ${medicine.name}`}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: heroIconBg }]}>
              <MedicineIcon size={32} color={colors.text.inverse} />
            </View>
            <View style={styles.heroBody}>
              <Text style={[styles.heroEyebrow, { color: heroEyebrowColor }]}>{eyebrowLabel}</Text>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle} numberOfLines={1}>{medicine.name}</Text>
                {medicine.dosage_per_pill ? (
                  <View style={styles.dosagePill}>
                    <Text style={styles.dosagePillText}>
                      {medicine.dosage_per_pill}{medicine.dosage_unit}
                    </Text>
                  </View>
                ) : null}
              </View>
              {medicine.active_ingredient ? (
                <Text style={styles.heroSubtitle} numberOfLines={1}>{medicine.active_ingredient}</Text>
              ) : null}
              <View style={styles.heroFooter}>
                <View style={styles.statusBadge}>
                  <CheckCircle2 size={14} color={colors.primary[700]} />
                  <Text style={styles.statusBadgeText}>Estável</Text>
                </View>
                {inUseDays !== null ? (
                  <Text style={styles.heroFooterHint}>
                    {inUseDays === 0 ? 'Iniciado hoje' : `Em uso há ${inUseDays} ${inUseDays === 1 ? 'dia' : 'dias'}`}
                  </Text>
                ) : null}
              </View>
            </View>
            <ChevronRight size={22} color={colors.primary[700]} />
          </Pressable>
        ) : null}

        {/* Dosagem & Frequência */}
        <SectionCard title="DOSAGEM & FREQUÊNCIA">
          <DetailRow label="Dose por tomada" value={formatDoseUnit(protocol.dosage_per_intake)} />
          <DetailRow label="Frequência" value={frequencyLabel} />
          {protocol.time_schedule?.length > 0 ? (
            <View style={styles.scheduleBlock}>
              <Text style={styles.detailLabel}>Horários</Text>
              <View style={styles.timesList}>
                {protocol.time_schedule.map((t) => (
                  <View key={t} style={styles.timeChip}>
                    <Clock size={12} color={colors.primary[700]} />
                    <Text style={styles.timeChipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {dailyIntakeTotal !== null ? (
            <DetailRow label="Consumo diário" value={formatDoseUnit(dailyIntakeTotal)} />
          ) : null}
        </SectionCard>

        {/* Período */}
        <SectionCard title="PERÍODO">
          <DetailRow label="Início" value={formatDatePtBR(protocol.start_date)} />
          <DetailRow
            label="Término"
            value={formatEndDate(protocol.end_date)}
            valueMuted={!protocol.end_date}
          />
        </SectionCard>

        {/* Plano terapêutico */}
        {protocol.treatment_plan ? (
          <SectionCard title="PLANO TERAPÊUTICO">
            <View style={styles.planRow}>
              {protocol.treatment_plan.emoji ? (
                <Text style={styles.planEmoji}>{protocol.treatment_plan.emoji}</Text>
              ) : null}
              <Text style={styles.planName}>{protocol.treatment_plan.name}</Text>
            </View>
          </SectionCard>
        ) : null}

        {/* Observações */}
        {protocol.notes ? (
          <SectionCard title="OBSERVAÇÕES">
            <Text style={styles.notesText}>{protocol.notes}</Text>
          </SectionCard>
        ) : null}

        {/* Status — Toggle Ligado/Desligado (Fase 2.5 §3.2)
            Oculto se finalizado (end_date < hoje); mostra caption inerte. */}
        <SectionCard title="STATUS">
          {isFinished ? (
            <Text style={styles.statusFinishedHint}>
              Tratamento finalizado{protocol.end_date ? ` em ${formatDatePtBR(protocol.end_date)}` : ''}. Edite o período para reativar.
            </Text>
          ) : (
            <View style={styles.statusRow}>
              <View style={styles.statusTextWrap}>
                <Text style={styles.statusLabel}>Tratamento ativo</Text>
                <Text style={styles.statusHelper}>
                  {effectiveActive
                    ? 'Enviando lembretes e contando doses.'
                    : 'Pausado — sem lembretes, sem contar doses.'}
                </Text>
              </View>
              <Switch
                value={effectiveActive}
                onValueChange={handleToggleActive}
                disabled={toggling}
                trackColor={{ true: colors.primary[500], false: colors.neutral[300] }}
                thumbColor={colors.bg.card}
                accessibilityRole="switch"
                accessibilityLabel="Ligar ou desligar tratamento"
                accessibilityState={{ checked: effectiveActive }}
              />
            </View>
          )}
        </SectionCard>

        {/* Excluir tratamento */}
        <Pressable
          onPress={onDelete}
          disabled={isDeleting}
          style={({ pressed }) => [
            styles.deleteBtn,
            (pressed || isDeleting) && styles.deleteBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Excluir tratamento"
          accessibilityState={{ disabled: isDeleting }}
        >
          <Trash2 size={18} color={colors.status.error} />
          <Text style={styles.deleteBtnText}>
            {isDeleting ? 'Excluindo…' : 'Excluir tratamento'}
          </Text>
        </Pressable>
      </ScrollView>

      <ProtocolDeleteSheet
        open={deleteOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        protocol={protocol}
        isDeleting={isDeleting}
      />
    </ScreenContainer>
  )
}

function DetailRow({ label, value, valueMuted }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueMuted && styles.detailValueMuted]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  appbarTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  appbarTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  iconBtn: {
    padding: spacing[1],
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.primary[50],
    borderRadius: 16,
  },
  heroPressed: {
    opacity: 0.85,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  heroTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
  },
  heroFooterHint: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
  detailValueMuted: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  scheduleBlock: {
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  timesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  planEmoji: {
    fontSize: 22,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  notesText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 22,
    paddingVertical: spacing[2],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusHelper: {
    fontSize: 12,
    color: colors.text.muted,
  },
  statusFinishedHint: {
    fontSize: 13,
    color: colors.text.muted,
    paddingVertical: spacing[2],
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
  },
  deleteBtnPressed: {
    opacity: 0.85,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.status.error,
  },
})
