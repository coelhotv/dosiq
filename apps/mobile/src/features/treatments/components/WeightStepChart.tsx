// WeightStepChart.tsx — pontos de peso sobre faixas por etapa (spec 069 Bb · FR-013 · DESIGN §3.2).
//
// Mesmo desenho do ScatterTrend (012): pontos `info` 0,85 r4,5, UMA cor, sem linha, sem média.
// Única adição: uma faixa NEUTRA por etapa (bg/branco alternados) com o rótulo da dose no topo —
// o degrau é contexto, não dado. Adesão nunca vira cor. SaMD (ADR-062): sem alvo, seta ou zona.
// Sem titulação (`showBands=false`): sem faixa — o card mostra "Dose atual".
// View/StyleSheet puro, sem dep nativa (SC-005b).

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { daysBetween, type TreatmentMeasureSeries } from '@dosiq/core'
import { buildScale, fmtTick } from '@measures/utils/chartScale'
import { colors, spacing } from '@shared/styles/tokens'
import { formatMeasureSeriesA11y, formatShortDay } from '@treatments/utils/formatMeasureSeriesA11y'
import { BAND_HIDE_PX, BAND_SHORT_PX, WEIGHT_CHART_H, shortDoseLabel } from '@treatments/utils/weightChartLayout'

const Y_AXIS_W = 34
const POINT_R = 4.5
const X_LABEL_MIN_GAP = 44
const CHART_H = WEIGHT_CHART_H

export interface WeightStepChartProps {
  series: TreatmentMeasureSeries
  today: string
  showBands: boolean
}

export default function WeightStepChart({ series, today, showBands }: WeightStepChartProps) {
  // States
  const [width, setWidth] = useState(0)

  // Memos
  const domainFrom = useMemo(() => {
    const candidates = [series.steps[0]?.start, series.firstDay].filter(Boolean) as string[]
    return candidates.sort()[0] ?? today
  }, [series, today])
  const spanDays = Math.max(1, daysBetween(domainFrom, today))
  const scale = useMemo(() => {
    const kgs = series.points.map((p) => p.kg)
    return buildScale(kgs.length ? Math.min(...kgs) : NaN, kgs.length ? Math.max(...kgs) : NaN)
  }, [series])
  const ySpan = scale.hi - scale.lo || 1

  const xFor = (day: string) => (width * Math.min(spanDays, Math.max(0, daysBetween(domainFrom, day)))) / spanDays
  // Recuo pelo raio: o plot corta o que passa da borda (overflow hidden) e o ponto de HOJE cai em
  // x = width. Faixas e eixo X seguem na largura toda; só o centro do ponto anda ≤ POINT_R px.
  const pointX = (day: string) => POINT_R + (xFor(day) * Math.max(0, width - 2 * POINT_R)) / (width || 1)
  const yFor = (kg: number) => POINT_R + (CHART_H - 2 * POINT_R) * (1 - (kg - scale.lo) / ySpan)

  const bands = useMemo(() => {
    if (!showBands || width === 0) return []
    const raw = series.steps.map((s) => {
      const left = xFor(s.start)
      const right = s.end ? xFor(s.end) : width
      return { key: s.index, left, width: Math.max(0, right - left), dose: s.dose }
    })
    const anyShort = raw.some((b) => b.width < BAND_SHORT_PX)
    return raw.map((b) => ({
      ...b,
      label: b.width < BAND_HIDE_PX ? null : anyShort ? shortDoseLabel(b.dose) : b.dose,
    }))
    // xFor depende de width/domínio, já nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, showBands, width, domainFrom, spanDays])

  const xLabels = useMemo(() => {
    if (width === 0) return []
    const days = [...(showBands ? series.steps.map((s) => s.start) : [domainFrom]), today]
    const out: { day: string; x: number }[] = []
    for (const day of days) {
      const x = xFor(day)
      const last = out[out.length - 1]
      if (last && x - last.x < X_LABEL_MIN_GAP) {
        if (day === today) out[out.length - 1] = { day, x } // hoje sempre aparece
        continue
      }
      out.push({ day, x })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, showBands, width, domainFrom, today, spanDays])

  // Rótulo encurtado ⇒ a unidade sai da faixa e vai para uma legenda (FR-013).
  const shortUnit = bands.some((b) => b.label && b.label !== b.dose) ? bands[0]?.dose.split(' ')[1] : null

  const a11yLabel = useMemo(() => formatMeasureSeriesA11y(series), [series])

  // Handlers
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11yLabel} testID="weight-step-chart">
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: CHART_H }]}>
          {scale.ticks.map((t, i) => (
            <Text key={i} style={[styles.yLabel, { top: yFor(t) - 7 }]}>{fmtTick(t)}</Text>
          ))}
        </View>
        <View style={[styles.plot, { height: CHART_H }]} onLayout={onLayout} testID="weight-plot">
          {bands.map((b, i) => (
            <View
              key={b.key}
              testID="weight-step-band"
              style={[styles.band, { left: b.left, width: b.width }, i % 2 === 0 ? styles.bandA : styles.bandB]}
            >
              {b.label ? <Text style={styles.bandLabel} numberOfLines={1}>{b.label}</Text> : null}
            </View>
          ))}
          {scale.ticks.map((t, i) => (
            <View key={`g${i}`} style={[styles.gridline, { top: yFor(t) }]} />
          ))}
          {width > 0 &&
            series.points.map((p) => (
              <View
                key={p.day}
                testID="weight-point"
                style={[styles.point, { left: pointX(p.day) - POINT_R, top: yFor(p.kg) - POINT_R }]}
              />
            ))}
        </View>
      </View>
      <View style={styles.xAxis}>
        {xLabels.map((l) => (
          <Text key={l.day} style={[styles.xLabel, { left: Y_AXIS_W + l.x - 22 }]}>{formatShortDay(l.day)}</Text>
        ))}
      </View>
      {shortUnit ? <Text style={styles.unitNote}>Dose em {shortUnit}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chartRow: { flexDirection: 'row' },
  yAxis: { width: Y_AXIS_W, position: 'relative' },
  yLabel: { position: 'absolute', right: spacing[2], fontSize: 11, color: colors.text.muted },
  plot: { flex: 1, position: 'relative', overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, paddingTop: 4, alignItems: 'center' },
  bandA: { backgroundColor: colors.bg.screen },
  bandB: { backgroundColor: colors.bg.card },
  bandLabel: { fontSize: 11, fontWeight: '600', color: colors.text.secondary, paddingHorizontal: 2 },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border.light },
  point: {
    position: 'absolute',
    width: POINT_R * 2,
    height: POINT_R * 2,
    borderRadius: POINT_R,
    backgroundColor: colors.status.info,
    opacity: 0.85,
  },
  xAxis: { height: 18, marginTop: spacing[2], position: 'relative' },
  unitNote: { fontSize: 11, color: colors.text.muted, marginTop: spacing[1] },
  xLabel: { position: 'absolute', width: 44, textAlign: 'center', fontSize: 11, color: colors.text.muted },
})
