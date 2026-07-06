// ScatterTrend.jsx — tendência de biomarcador (012 Fase C · FR-011b · mock historico_medidas-glicemia).
// Scatter: pontos por dia, UMA cor, janela 7d FIXA + WeekNav (seta-futuro desabilitada na semana atual).
// Eixo Y = escala "nice" (gridlines + labels) derivada dos dados; eixo X = dias do mês.
// Média da semana = NÚMERO descritivo (jamais linha — seria lida como meta).
// SaMD (ADR-062): SEM zona/meta/faixa-alvo/linha; gridlines são só referência de leitura de valor.

import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, ChevronRight } = LucideIcons as any
import { addDays, parseISO, getRawNow } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const DAY_MS = 24 * 60 * 60 * 1000
const CHART_H = 132
const Y_AXIS_W = 34
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function startOfDay(d) {
  const x = addDays(d, 0) // cópia da Date (evita new Date — R-020)
  x.setHours(0, 0, 0, 0)
  return x
}
// Segunda-feira da semana que contém `d`.
function mondayOf(d) {
  const x = startOfDay(d)
  const wd = (x.getDay() + 6) % 7 // 0=segunda
  x.setDate(x.getDate() - wd)
  return x
}

// "Passo bonito" p/ a escala do eixo Y (1/2/5 × 10ⁿ).
function niceStep(raw) {
  if (raw <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10
  return m * pow
}

// Escala Y a partir de min/max dos dados → {lo, hi, ticks:[hi,mid,lo]} (topo→base).
function buildScale(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 100, ticks: [100, 50, 0] }
  if (min === max) { const lo = Math.max(0, min - 10); const hi = min + 10; return { lo, hi, ticks: [hi, (lo + hi) / 2, lo] } }
  const step = niceStep(max - min)
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  const mid = (lo + hi) / 2
  return { lo, hi, ticks: [hi, mid, lo] }
}

function fmtTick(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

// PA = 2 séries (sistólica + diastólica). Cor diferencia SÉRIE, nunca qualidade (SaMD, ADR-062).
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

export default function ScatterTrend({ items, unit, typeLabel = 'Medida', isPa = false }) {
  // offset em semanas a partir da semana atual (0 = atual; negativo = passado).
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(() => addDays(mondayOf(getRawNow()), weekOffset * 7), [weekOffset])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      const dayEnd = day.getTime() + DAY_MS
      const dayItems = (items || []).filter((it) => {
        const t = parseISO(it.measured_at).getTime()
        return t >= day.getTime() && t < dayEnd
      })
      // PA: série diastólica ignora pontos sem value_secondary (dados legados/defensivo).
      arr.push({
        day,
        values: dayItems.map((it) => it.value),
        valuesSec: isPa ? dayItems.map((it) => it.value_secondary).filter((v) => v != null) : [],
      })
    }
    return arr
  }, [items, weekStart, isPa])

  const sysValues = days.flatMap((d) => d.values)
  const diaValues = days.flatMap((d) => d.valuesSec)
  const allValues = [...sysValues, ...diaValues] // escala unifica as 2 séries (PA)
  const hasData = allValues.length > 0
  const avg = mean(sysValues)
  const avgDia = mean(diaValues)
  const scale = useMemo(
    () => buildScale(hasData ? Math.min(...allValues) : NaN, hasData ? Math.max(...allValues) : NaN),
    [allValues, hasData]
  )
  const span = scale.hi - scale.lo || 1
  const canGoNext = weekOffset < 0

  // y (px do topo do plot) para um valor: hi→0, lo→CHART_H.
  function yFor(v) {
    return CHART_H - ((v - scale.lo) / span) * CHART_H
  }

  const rangeLabel = `${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]}`

  return (
    <View style={styles.wrap}>
      {/* Header: eyebrow + WeekNav com range (dia do mês) */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TENDÊNCIA · {typeLabel.toUpperCase()}</Text>
        <View style={styles.nav}>
          <Pressable onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Semana anterior">
            <ChevronLeft size={18} color={colors.text.secondary} />
          </Pressable>
          <Text style={styles.rangeLabel}>{rangeLabel}</Text>
          <Pressable onPress={() => canGoNext && setWeekOffset((o) => o + 1)} disabled={!canGoNext} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Próxima semana" accessibilityState={{ disabled: !canGoNext }}>
            <ChevronRight size={18} color={canGoNext ? colors.text.secondary : colors.neutral[300]} />
          </Pressable>
        </View>
      </View>

      {/* Plot: eixo Y (labels + gridlines) + colunas de pontos */}
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: CHART_H }]}>
          {scale.ticks.map((t, i) => (
            <Text key={i} style={[styles.yLabel, { top: yFor(t) - 7 }]}>{fmtTick(t)}</Text>
          ))}
        </View>
        <View style={[styles.plot, { height: CHART_H }]}>
          {scale.ticks.map((t, i) => (
            <View key={i} style={[styles.gridline, { top: yFor(t) }]} />
          ))}
          <View style={styles.cols}>
            {days.map((d, i) => (
              <View key={i} style={styles.col}>
                {d.values.map((v, j) => (
                  <View key={`s${j}`} style={[styles.point, { top: yFor(v) - 4 }]} />
                ))}
                {d.valuesSec.map((v, j) => (
                  <View key={`d${j}`} style={[styles.point, styles.pointDia, { top: yFor(v) - 4 }]} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Eixo X: dias do mês (último com mês) */}
      <View style={styles.xAxis}>
        {days.map((d, i) => (
          <Text key={i} style={styles.xLabel}>
            {i === 6 ? `${d.day.getDate()} ${MONTHS[d.day.getMonth()]}` : d.day.getDate()}
          </Text>
        ))}
      </View>

      <View style={styles.footer}>
        {hasData ? (
          isPa ? (
            <Text style={styles.avg}>
              Média: <Text style={styles.avgValue}>SIS {fmtTick(Math.round(avg * 10) / 10)}</Text>
              {avgDia != null ? <Text style={styles.avgValue}> · DIA {fmtTick(Math.round(avgDia * 10) / 10)}</Text> : null}
              <Text style={styles.avgValue}> {unit}</Text>
              <Text style={styles.count}>  ·  {sysValues.length} {sysValues.length === 1 ? 'medida' : 'medidas'}</Text>
            </Text>
          ) : (
            <Text style={styles.avg}>
              Média da semana: <Text style={styles.avgValue}>{fmtTick(Math.round(avg * 10) / 10)} {unit}</Text>
              <Text style={styles.count}>  ·  {allValues.length} {allValues.length === 1 ? 'medida' : 'medidas'}</Text>
            </Text>
          )
        ) : (
          <Text style={styles.empty}>Sem medidas nesta semana.</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing[4], borderWidth: 1, borderColor: colors.border.light },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  eyebrow: { fontSize: 11, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.4 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rangeLabel: { fontSize: 13, fontWeight: '700', color: colors.text.primary, minWidth: 78, textAlign: 'center' },
  chartRow: { flexDirection: 'row' },
  yAxis: { width: Y_AXIS_W, position: 'relative' },
  yLabel: { position: 'absolute', right: spacing[2], fontSize: 10, color: colors.text.muted },
  plot: { flex: 1, position: 'relative' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border.light },
  cols: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  col: { flex: 1, position: 'relative' },
  point: { position: 'absolute', alignSelf: 'center', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.info },
  pointDia: { backgroundColor: colors.neutral[300] }, // diastólica — cinza claro neutro; cor = série, nunca qualidade (SaMD: evita verde/amarelo/vermelho)
  xAxis: { flexDirection: 'row', marginTop: spacing[2], paddingLeft: Y_AXIS_W },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.text.muted },
  footer: { marginTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.light, paddingTop: spacing[3] },
  avg: { fontSize: 13, color: colors.text.secondary, textAlign: 'center' },
  avgValue: { fontWeight: '700', color: colors.text.primary },
  count: { color: colors.text.muted },
  empty: { fontSize: 13, color: colors.text.muted, textAlign: 'center' },
})
