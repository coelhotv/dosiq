// ScatterTrend.jsx — tendência de biomarcador no web (012 Fase C · FR-011b). Porta do mobile.
// Scatter SVG: pontos por dia, UMA cor, janela 7d FIXA + WeekNav (seta-futuro desabilitada na
// semana atual). Média da semana = NÚMERO descritivo (jamais linha — seria lida como meta).
// SaMD (ADR-062): SEM zona/meta/faixa-alvo/linha; gridlines são só referência de leitura.

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, parseISO, getRawNow } from '@dosiq/core'
import './ScatterTrend.css'

const DAY_MS = 24 * 60 * 60 * 1000
const VB_W = 320
const VB_H = 132
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function startOfDay(d) {
  const x = addDays(d, 0) // cópia da Date (evita new Date — R-020)
  x.setHours(0, 0, 0, 0)
  return x
}
function mondayOf(d) {
  const x = startOfDay(d)
  const wd = (x.getDay() + 6) % 7 // 0=segunda
  x.setDate(x.getDate() - wd)
  return x
}
function niceStep(raw) {
  if (raw <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10
  return m * pow
}
function buildScale(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 100, ticks: [100, 50, 0] }
  if (min === max) { const lo = Math.max(0, min - 10); const hi = min + 10; return { lo, hi, ticks: [hi, (lo + hi) / 2, lo] } }
  const step = niceStep(max - min)
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  return { lo, hi, ticks: [hi, (lo + hi) / 2, lo] }
}
function fmtTick(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

// PA = 2 séries (sistólica + diastólica). Cor diferencia SÉRIE, nunca qualidade (SaMD, ADR-062).
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

export default function ScatterTrend({ items, unit, typeLabel = 'Medida', isPa = false }) {
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(() => addDays(mondayOf(getRawNow()), weekOffset * 7), [weekOffset])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      const dayEnd = day.getTime() + DAY_MS
      const dayItems = (items || [])
        .filter((it) => { const t = parseISO(it.measured_at).getTime(); return t >= day.getTime() && t < dayEnd })
      arr.push({
        day,
        values: dayItems.map((it) => it.value),
        // PA: série diastólica ignora pontos sem value_secondary (dados legados/defensivo).
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

  const yFor = (v) => VB_H - ((v - scale.lo) / span) * VB_H
  const xFor = (i) => (i + 0.5) * (VB_W / 7)

  const rangeLabel = `${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]}`

  return (
    <div className="scatter">
      <div className="scatter__header">
        <span className="scatter__eyebrow">TENDÊNCIA · {typeLabel.toUpperCase()}</span>
        <div className="scatter__nav">
          <button type="button" className="scatter__nav-btn" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Semana anterior">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="scatter__range">{rangeLabel}</span>
          <button type="button" className="scatter__nav-btn" onClick={() => canGoNext && setWeekOffset((o) => o + 1)} disabled={!canGoNext} aria-label="Próxima semana">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="scatter__plot">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="scatter__svg" preserveAspectRatio="none" role="img" aria-label={`Tendência de ${typeLabel} na semana`}>
          {scale.ticks.map((t, i) => (
            <line key={i} x1="0" x2={VB_W} y1={yFor(t)} y2={yFor(t)} className="scatter__grid" />
          ))}
          {days.flatMap((d, i) => d.values.map((v, j) => (
            <circle key={`s${i}-${j}`} cx={xFor(i)} cy={yFor(v)} r="4" className="scatter__point" />
          )))}
          {days.flatMap((d, i) => d.valuesSec.map((v, j) => (
            <circle key={`d${i}-${j}`} cx={xFor(i)} cy={yFor(v)} r="4" className="scatter__point scatter__point--dia" />
          )))}
        </svg>
        <div className="scatter__ylabels">
          {scale.ticks.map((t, i) => <span key={i}>{fmtTick(t)}</span>)}
        </div>
      </div>

      <div className="scatter__xaxis">
        {days.map((d, i) => (
          <span key={i}>{i === 6 ? `${d.day.getDate()} ${MONTHS[d.day.getMonth()]}` : d.day.getDate()}</span>
        ))}
      </div>

      <div className="scatter__footer">
        {hasData ? (
          isPa ? (
            <span className="scatter__avg">
              Média: <strong>SIS {fmtTick(Math.round(avg * 10) / 10)}</strong>
              {avgDia != null ? <strong> · DIA {fmtTick(Math.round(avgDia * 10) / 10)}</strong> : null}
              <strong> {unit}</strong>
              <span className="scatter__count">  ·  {sysValues.length} {sysValues.length === 1 ? 'medida' : 'medidas'}</span>
            </span>
          ) : (
            <span className="scatter__avg">
              Média da semana: <strong>{fmtTick(Math.round(avg * 10) / 10)} {unit}</strong>
              <span className="scatter__count">  ·  {allValues.length} {allValues.length === 1 ? 'medida' : 'medidas'}</span>
            </span>
          )
        ) : (
          <span className="scatter__empty">Sem medidas nesta semana.</span>
        )}
      </div>
    </div>
  )
}
