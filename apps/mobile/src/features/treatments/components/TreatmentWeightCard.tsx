// TreatmentWeightCard.tsx — "Peso durante o tratamento" no detalhe do tratamento (spec 069 Bb · T053).
//
// 6 estados explícitos (FR-009/FR-014): B-4 carregando · B-5 erro (vermelho, nunca vazio) · B-0
// gráfico · B-2/B-1/B-3 vazios (azul-info + régua, dizem SÓ o que falta). Regra de estado no core
// (`pickMeasureSeriesState`); aqui só copy e layout (R-12).
// Descritivo (ADR-062, INV-5): o mesmo desenho e o mesmo texto para perda e ganho de peso.
// "Registrar peso" grava por `measuresRepo.create` com entry_point (FR-022) — nunca o repo cru.

import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Ruler, AlertCircle, ChevronDown, ChevronUp, ChevronRight } = LucideIcons as any
import { shiftDay, MEASURE_SERIES_MIN_POINTS, MEASURE_SERIES_MIN_SPAN_DAYS, type MeasureSeriesStep } from '@dosiq/core'
import SectionCard from '@shared/components/ui/SectionCard'
import MeasureLogSheet from '@measures/components/MeasureLogSheet'
import { measuresRepo } from '@measures/services/measuresRepo'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES, ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { useTreatmentMeasureSeries, type MeasureSeriesError } from '@treatments/hooks/useTreatmentMeasureSeries'
import type { TreatmentMeasureProtocol, TreatmentMeasureResult } from '@treatments/services/treatmentMeasureService'
import WeightStepChart from '@treatments/components/WeightStepChart'
import { formatKg, formatShortDay, pluralWeighings } from '@treatments/utils/formatMeasureSeriesA11y'
import { WEIGHT_CHART_H, stepsStorageKey } from '@treatments/utils/weightChartLayout'

const TITLE = 'PESO DURANTE O TRATAMENTO'

// O gráfico conta 1 pesagem por DIA local (smoke 05/10: o 2º peso do mesmo dia "não contava" sem aviso).
const moreDays = (k: number) => (k === 1 ? 'mais 1 dia diferente' : `mais ${k} dias diferentes`)
const missingTitle = (k: number) => (k === 1 ? 'Falta 1 pesagem' : `Faltam ${k} pesagens`)

function stepPeriod(s: MeasureSeriesStep): string {
  if (!s.end) return `desde ${formatShortDay(s.start)}`
  return `${formatShortDay(s.start)} – ${formatShortDay(shiftDay(s.end, -1))}`
}

async function currentUserId(): Promise<string | null> {
  try {
    const session = await supabase.auth.getSession()
    return session?.data?.session?.user?.id ?? null
  } catch {
    return null
  }
}

function WeightErrorState({ error, loading, onRetry }: { error: MeasureSeriesError; loading: boolean; onRetry: () => void }) {
  return (
    <SectionCard title={TITLE}>
      <View style={[styles.state, styles.stateError]} testID="weight-card-error">
        <AlertCircle size={20} color={colors.status.error} strokeWidth={2} />
        <View style={styles.stateText}>
          <Text style={[styles.stateTitle, styles.errorText]}>Não deu para carregar</Text>
          <Text style={[styles.stateBody, styles.errorText]}>
            {error === 'network' ? 'Verifique a internet.' : 'Tente de novo.'} Os pesos continuam salvos.
          </Text>
        </View>
      </View>
      <Pressable onPress={onRetry} style={[styles.btn, styles.btnSecondary]} accessibilityRole="button" disabled={loading}>
        <Text style={styles.btnSecondaryText}>Tentar de novo</Text>
      </Pressable>
    </SectionCard>
  )
}

// B-4: mesma geometria do B-0 (subtítulo, gráfico, linha).
function WeightSkeleton() {
  return (
    <SectionCard title={TITLE}>
      <View testID="weight-card-skeleton" accessibilityLabel="Carregando peso durante o tratamento">
        <View style={[styles.skelLine, styles.skelWide]} />
        <View style={styles.skelBlock} />
        <View style={[styles.skelLine, styles.skelNarrow]} />
      </View>
    </SectionCard>
  )
}

// Vazios (FR-009): dizem SÓ o que falta. B-2 tem a ação secundária (P4); B-1/B-3 primária.
function emptyCopy({ series, state }: TreatmentMeasureResult) {
  const n = series.points.length
  const k = Math.max(0, MEASURE_SERIES_MIN_POINTS - n)
  const unlockDay = series.firstDay ? formatShortDay(shiftDay(series.firstDay, MEASURE_SERIES_MIN_SPAN_DAYS)) : ''
  if (state === 'B2') return { title: `O gráfico aparece em ${unlockDay}`, body: 'Registre o peso nesse dia ou depois.', primary: false }
  if (state === 'B1') return { title: missingTitle(k), body: `Registre o peso em ${moreDays(k)} para ver o gráfico.`, primary: true }
  if (n === 0) return { title: 'Nenhum peso registrado', body: 'Registre o peso em 3 dias diferentes, ao longo de 2 semanas, para ver o gráfico.', primary: true }
  return { title: missingTitle(k), body: `Registre o peso em ${moreDays(k)}. O gráfico aparece a partir de ${unlockDay}.`, primary: true }
}

function WeightEmptyState({ data, onRegister }: { data: TreatmentMeasureResult; onRegister: () => void }) {
  const empty = emptyCopy(data)
  return (
    <>
      <View style={[styles.state, styles.stateEmpty]} testID={`weight-card-${data.state}`}>
        <Ruler size={20} color={colors.status.info} strokeWidth={2} />
        <View style={styles.stateText}>
          <Text style={styles.stateTitle}>{empty.title}</Text>
          <Text style={styles.stateBody}>{empty.body}</Text>
        </View>
      </View>
      <Pressable
        onPress={onRegister}
        style={[styles.btn, empty.primary ? styles.btnPrimary : styles.btnSecondary]}
        accessibilityRole="button"
      >
        <Text style={empty.primary ? styles.btnPrimaryText : styles.btnSecondaryText}>Registrar peso</Text>
      </Pressable>
    </>
  )
}

// AC-9b: uma linha por etapa — adesão só como número, nunca cor.
function WeightStepsList({ steps }: { steps: MeasureSeriesStep[] }) {
  return (
    <>
      {steps.map((s) => (
        <View key={s.index} style={styles.stepRow} testID="weight-step-row">
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>
              Etapa {s.index} · {s.dose}
              {s.current ? ' · atual' : ''}
            </Text>
            <Text style={styles.stepPeriod}>{stepPeriod(s)}</Text>
          </View>
          <Text style={styles.stepLine}>
            {s.meanKg === null ? 'Sem pesagens' : `Peso médio ${formatKg(s.meanKg)} kg · ${pluralWeighings(s.count)}`}
          </Text>
          <Text style={styles.stepLine}>
            Doses tomadas: {s.taken} de {s.expected}
          </Text>
        </View>
      ))}
    </>
  )
}


export default function TreatmentWeightCard({ protocol }: { protocol: TreatmentMeasureProtocol }) {
  // States
  const { data, loading, error, refreshAfterSave, retry } = useTreatmentMeasureSeries(protocol)
  const [logOpen, setLogOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Effects — "Ver por etapa" lembrado por conta (FR-020); falha de leitura = recolhido.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const uid = await currentUserId()
      if (!alive || !uid) return
      setUserId(uid)
      try {
        if ((await AsyncStorage.getItem(stepsStorageKey(uid))) === '1' && alive) setExpanded(true)
      } catch {
        // recolhido
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Handlers
  const openLog = useCallback(() => {
    selectionTap()
    setLogOpen(true)
  }, [])

  const handleSaved = useCallback(
    async (payload: any) => {
      const created = await measuresRepo.create(payload, { entry_point: ENTRY_POINTS.MEASURE_SERIES })
      refreshAfterSave()
      return created
    },
    [refreshAfterSave]
  )

  const toggleSteps = useCallback(() => {
    selectionTap()
    const next = !expanded
    setExpanded(next)
    void logEvent(EVENTS.MEASURE_SERIES_STEPS_TOGGLED, { expanded: next, treatment_id: protocol.id, surface: SURFACES.MOBILE })
    if (userId) AsyncStorage.setItem(stepsStorageKey(userId), next ? '1' : '0').catch(() => {})
  }, [expanded, protocol.id, userId])

  const goToWeights = useCallback(() => {
    selectionTap()
    navigateCrossTab(ROUTES.PROFILE, ROUTES.MEASURES, { type: 'peso' })
  }, [])

  const sheet = <MeasureLogSheet open={logOpen} onClose={() => setLogOpen(false)} onSaved={handleSaved} lockedType="peso" />

  if (error) return <WeightErrorState error={error} loading={loading} onRetry={retry} />

  if (!data) {
    if (!loading) return null // não elegível (R-11)
    return <WeightSkeleton />
  }

  const { series, state, hasLadder } = data
  const n = series.points.length
  const current = series.steps.find((s) => s.current) ?? series.steps[series.steps.length - 1]

  if (state !== 'B0') {
    return (
      <SectionCard title={TITLE}>
        <WeightEmptyState data={data} onRegister={openLog} />
        {sheet}
      </SectionCard>
    )
  }

  return (
    <SectionCard title={TITLE}>
      <Text style={styles.subtitle} testID="weight-card-B0">
        {pluralWeighings(n)} · {formatShortDay(series.firstDay)} a {formatShortDay(series.lastDay)} · kg
      </Text>
      <WeightStepChart series={series} today={data.today} showBands={hasLadder} />
      {hasLadder ? (
        <>
          <Pressable
            onPress={toggleSteps}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <Text style={styles.toggleText}>Ver por etapa</Text>
            {expanded ? <ChevronUp size={18} color={colors.text.secondary} /> : <ChevronDown size={18} color={colors.text.secondary} />}
          </Pressable>
          {expanded ? <WeightStepsList steps={series.steps} /> : null}
        </>
      ) : current ? (
        <Text style={styles.currentDose}>
          Dose atual · {current.dose} · desde {formatShortDay(current.start)}
        </Text>
      ) : null}
      <Pressable onPress={goToWeights} style={styles.link} accessibilityRole="link">
        <Text style={styles.linkText}>Ver todos os pesos</Text>
        <ChevronRight size={16} color={colors.status.info} />
      </Pressable>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing[3] },
  state: { flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderRadius: borderRadius.md },
  stateEmpty: { backgroundColor: colors.status.infoLight },
  stateError: { backgroundColor: colors.status.errorLight },
  stateText: { flex: 1 },
  stateTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  stateBody: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  errorText: { color: colors.status.error },
  btn: { minHeight: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[3] },
  btnPrimary: { backgroundColor: colors.status.info },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.bg.card },
  btnSecondary: { borderWidth: 1, borderColor: colors.status.info },
  btnSecondaryText: { fontSize: 15, fontWeight: '700', color: colors.status.info },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[3] },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  stepRow: { paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border.light },
  stepHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing[2] },
  stepTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  stepPeriod: { fontSize: 13, color: colors.text.muted },
  stepLine: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  currentDose: { fontSize: 14, color: colors.text.secondary, marginTop: spacing[3] },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[2] },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.status.info },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: colors.border.light, marginVertical: spacing[2] },
  skelWide: { width: '60%' },
  skelNarrow: { width: '40%' },
  skelBlock: { height: WEIGHT_CHART_H, borderRadius: borderRadius.md, backgroundColor: colors.border.light },
})
