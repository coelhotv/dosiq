/**
 * SparklineAdesao - Gráfico de linha para visualização de adesão.
 *
 * Acessível (role="img" + dots role="button"/aria-label), escala vertical FIXA 0-100
 * (adesão absoluta; clamp AP-191), curva que passa pelos pontos (Catmull-Rom) e tooltip
 * como overlay HTML (não SVG <text>, que esticava no preserveAspectRatio="none").
 */
import { useMemo, useCallback, useState, type CSSProperties } from 'react'
import { analyticsService } from '@dashboard/services/analyticsService'
import { useSparklineData } from '@dashboard/hooks/useSparklineData'
import {
  generateSparklinePath,
  generateSparklineArea,
  getAdherenceColor,
  projectY,
  formatDate,
} from '@dashboard/utils/sparklineUtils'
import './SparklineAdesao.css'

const SIZES = {
  inline: { width: 120, height: 20, padding: 2 },
  small: { width: 120, height: 32, padding: 4 },
  medium: { width: 200, height: 40, padding: 6 },
  large: { width: 280, height: 48, padding: 8 },
  expanded: { width: 320, height: 56, padding: 8 },
}

export function SparklineAdesao({ adherenceByDay = [], size = 'medium', days = null, showAxis = false, showTooltip = true, className = '', onDayClick = (() => {}) as (dayData?: any) => void }) {
  // 1. States
  const [activePoint, setActivePoint] = useState(null)

  // 2. Derived data + memos
  const { width, height, padding } = SIZES[size] || SIZES.medium
  const { chartData, stats } = useSparklineData(adherenceByDay, days ?? (size === 'expanded' ? 30 : 7))

  const linePath = useMemo(
    () => generateSparklinePath(chartData, width, height, padding),
    [chartData, width, height, padding]
  )
  const areaPath = useMemo(
    () => generateSparklineArea(chartData, width, height, padding),
    [chartData, width, height, padding]
  )
  // Dots em todos os tamanhos exceto inline (inline = só a curva).
  const dataPoints = useMemo(
    () =>
      size !== 'inline'
        ? chartData.map((d, i) => ({
            ...d,
            x: padding + i * ((width - padding * 2) / (chartData.length - 1 || 1)),
            y: projectY(d.adherence, height, padding),
            index: i,
          }))
        : [],
    [chartData, width, height, padding, size]
  )

  // 3. Handlers
  const handleDayClick = useCallback((dayData) => {
    analyticsService.track('sparkline_day_clicked', dayData)
    onDayClick?.(dayData)
  }, [onDayClick])

  const handleDotActivate = useCallback((d) => {
    // chave por `date` (única) e não por índice — robusto a reorder/filtro dos dados.
    setActivePoint((prev) => (prev === d.date ? null : d.date))
    handleDayClick(d)
  }, [handleDayClick])

  if (!chartData.length) {
    return (
      <div
        className={`sparkline-adhesion sparkline-empty ${className}`}
        role="img"
        aria-label="Sem dados de adesão"
      >
        Sem dados
      </div>
    )
  }

  const ariaLabel = `Adesão dos últimos ${chartData.length} dias, média ${stats.average}%`
  const active = activePoint !== null ? dataPoints.find((p) => p.date === activePoint) : null

  return (
    <button
      type="button"
      className={`sparkline-adhesion sparkline-adhesion--${size} ${className}`}
      role="img"
      aria-label={ariaLabel}
      onClick={() => setActivePoint(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" /></linearGradient>
          <filter id="sparklineGlow"><feGaussianBlur stdDeviation="0.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {showAxis && <line x1={padding} y1={padding + (height - padding * 2) * 0.2} x2={width - padding} y2={padding + (height - padding * 2) * 0.2} className="sparkline-reference-line" strokeDasharray="2,2" />}
        <path d={areaPath} fill="url(#sparklineGradient)" />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="1" filter="url(#sparklineGlow)" />
        {dataPoints.map((d) => (
          <circle
            key={d.date}
            cx={d.x}
            cy={d.y}
            r={size === 'small' ? 2.5 : 3}
            fill={getAdherenceColor(d.adherence)}
            className="sparkline-dot sparkline-dot--clickable"
            data-testid={`sparkline-dot-${d.index}`}
            role="button"
            tabIndex={0}
            aria-label={`${d.dayName}, ${d.adherence}% de adesão`}
            onClick={(e) => { e.stopPropagation(); handleDotActivate(d) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDotActivate(d) } }}
          />
        ))}
      </svg>
      {/* Tooltip como overlay HTML (posição em %), imune ao stretch do preserveAspectRatio. */}
      {active && (
        <div
          className="sparkline-tooltip-overlay"
          style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / height) * 100}%` }}
          aria-hidden="true"
        >
          <span className="sparkline-tooltip-date">{formatDate(active.date)}</span>
          <span className="sparkline-tooltip-value">{active.adherence}% · {active.taken}/{active.expected} doses</span>
        </div>
      )}
      {showTooltip && size !== 'inline' && size !== 'expanded' && (
        <div className="sparkline-tooltip-container">
          {chartData.map((d, i) => <div key={d.date} className="sparkline-day-tooltip" style={{ '--day-index': i } as CSSProperties}><span className="sparkline-day-name">{d.dayName}</span><span style={{ color: getAdherenceColor(d.adherence) }}>{d.adherence}%</span></div>)}
        </div>
      )}
      <div className={`sparkline-stats sparkline-stats-${size}`}>
        <span className="sparkline-average">{stats.average}%</span>
        <span className={`sparkline-trend sparkline-trend-${stats.trend}`}>{stats.trend === 'up' ? '↑' : stats.trend === 'down' ? '↓' : '→'}</span>
      </div>
    </button>
  )
}
export default SparklineAdesao
