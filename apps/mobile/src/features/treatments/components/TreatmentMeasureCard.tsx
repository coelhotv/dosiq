// TreatmentMeasureCard.tsx — glicemia ou pressão no detalhe do tratamento (spec 100 B · FR-009 · T025).
//
// Peso continua no TreatmentWeightCard (069: degraus de dose). Aqui o gráfico é o ScatterTrend da 012
// (semana local + navegação), lido dos últimos 90 dias para dar o que navegar. Mínimo para desenhar
// em `measureCardGate` (3 dias/7 glicemia, 2 dias/7 PA). Estados: carregando · erro (vermelho, nunca
// vazio) · vazio (diz SÓ o que falta) · gráfico.
// Descritivo (ADR-062, INV-5): sem faixa-alvo, cor de julgamento ou texto interpretativo.
// "Registrar" grava pela casca `measuresRepo.create` com entry_point (FR-022 da 069).

import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Ruler, AlertCircle, ChevronRight } = LucideIcons as any
import { addDays, getNow, BIOMARKER_TYPE_UNITS } from '@dosiq/core'
import SectionCard from '@shared/components/ui/SectionCard'
import ScatterTrend from '@measures/components/ScatterTrend'
import MeasureLogSheet from '@measures/components/MeasureLogSheet'
import { measuresRepo } from '@measures/services/measuresRepo'
import { ENTRY_POINTS } from '@platform/analytics/analyticsEvents'
import { isNetworkError } from '@shared/utils/networkError'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { missingDaysForChart, type CardMeasure } from '@treatments/utils/measureCardGate'

const FETCH_DAYS = 90

const COPY: Record<
  CardMeasure,
  { title: string; noun: string; cta: string; all: string; saved: string }
> = {
  glicemia: {
    title: 'GLICEMIA DURANTE O TRATAMENTO',
    noun: 'glicemias',
    cta: 'Registrar glicemia',
    all: 'Ver todas as glicemias',
    saved: 'As glicemias continuam salvas.',
  },
  pressao_arterial: {
    title: 'PRESSÃO DURANTE O TRATAMENTO',
    noun: 'pressões',
    cta: 'Registrar pressão',
    all: 'Ver todas as pressões',
    saved: 'As pressões continuam salvas.',
  },
}

const missingText = (k: number) =>
  k === 1 ? 'Falta 1 dia com medida' : `Faltam ${k} dias com medida`

type State = { loading: boolean; error: 'network' | 'other' | null; items: any[] }

async function fetchState(measure: CardMeasure): Promise<State> {
  try {
    const fromTs = addDays(getNow(), -FETCH_DAYS).toISOString()
    const items = await measuresRepo.list({ type: measure, fromTs })
    return { loading: false, error: null, items: items ?? [] }
  } catch (err) {
    return { loading: false, error: isNetworkError(err) ? 'network' : 'other', items: [] }
  }
}

export default function TreatmentMeasureCard({ measure }: { measure: CardMeasure }) {
  // States
  const [state, setState] = useState<State>({ loading: true, error: null, items: [] })
  const [logOpen, setLogOpen] = useState(false)
  const copy = COPY[measure]

  // Effects — 1ª leitura (o estado inicial já é "carregando"; setState só no callback)
  useEffect(() => {
    let cancelled = false
    void fetchState(measure).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [measure])

  // Handlers
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setState(await fetchState(measure))
  }, [measure])

  const handleSaved = useCallback(
    async (payload: any) => {
      const created = await measuresRepo.create(payload, {
        entry_point: ENTRY_POINTS.MEASURE_SERIES,
      })
      void load()
      return created
    },
    [load]
  )

  const goToAll = useCallback(() => {
    selectionTap()
    navigateCrossTab(ROUTES.PROFILE, ROUTES.MEASURES, { type: measure })
  }, [measure])

  const sheet = (
    <MeasureLogSheet
      open={logOpen}
      onClose={() => setLogOpen(false)}
      onSaved={handleSaved}
      lockedType={measure}
    />
  )

  if (state.error) {
    return (
      <SectionCard title={copy.title}>
        <View style={[styles.state, styles.stateError]} testID="measure-card-error">
          <AlertCircle size={20} color={colors.status.error} strokeWidth={2} />
          <View style={styles.stateText}>
            <Text style={[styles.stateTitle, styles.errorText]}>Não deu para carregar</Text>
            <Text style={[styles.stateBody, styles.errorText]}>
              {state.error === 'network' ? 'Verifique a internet.' : 'Tente de novo.'} {copy.saved}
            </Text>
          </View>
        </View>
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={load}
          accessibilityRole="button"
          disabled={state.loading}
        >
          <Text style={styles.btnSecondaryText}>Tentar de novo</Text>
        </Pressable>
      </SectionCard>
    )
  }

  if (state.loading && state.items.length === 0) {
    return (
      <SectionCard title={copy.title}>
        <View style={styles.skeleton} testID="measure-card-loading" />
      </SectionCard>
    )
  }

  const missing = missingDaysForChart(measure, state.items, getNow())

  return (
    <SectionCard title={copy.title}>
      {missing === 0 ? (
        <View testID="measure-card-chart">
          <ScatterTrend
            items={state.items}
            unit={BIOMARKER_TYPE_UNITS[measure]}
            typeLabel={measure === 'glicemia' ? 'Glicemia' : 'Pressão'}
            isPa={measure === 'pressao_arterial'}
          />
          <Pressable onPress={goToAll} style={styles.link} accessibilityRole="link">
            <Text style={styles.linkText}>{copy.all}</Text>
            <ChevronRight size={16} color={colors.status.info} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.state} testID="measure-card-empty">
            <Ruler size={20} color={colors.status.info} strokeWidth={2} />
            <View style={styles.stateText}>
              <Text style={styles.stateTitle}>{missingText(missing)}</Text>
              <Text style={styles.stateBody}>
                O gráfico aparece com {copy.noun} em dias diferentes da última semana.
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => setLogOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>{copy.cta}</Text>
          </Pressable>
        </>
      )}
      {sheet}
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  state: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.infoLight,
  },
  stateError: { backgroundColor: colors.status.errorLight },
  stateText: { flex: 1 },
  stateTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  stateBody: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  errorText: { color: colors.status.error },
  skeleton: { height: 132, borderRadius: borderRadius.md, backgroundColor: colors.neutral[100] },
  // Mesmos botões e link do TreatmentWeightCard (069): os cards de acompanhamento se parecem.
  btn: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[3],
  },
  btnPrimary: { backgroundColor: colors.status.info },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.bg.card },
  btnSecondary: { borderWidth: 1, borderColor: colors.status.info },
  btnSecondaryText: { fontSize: 15, fontWeight: '700', color: colors.status.info },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.status.info },
})
