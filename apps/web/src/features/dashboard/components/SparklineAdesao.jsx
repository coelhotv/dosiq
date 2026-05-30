/**
 * SparklineAdesao - Gráfico de linha para visualização de adesão.
 *
 * Acessível (role="img" + dots role="button"/aria-label), com auto-escala vertical
 * (computeDomain/projectY) e adesão clampada 0-100 (AP-191, defesa no componente).
 */
import { useMemo, useCallback, useState } from 'react'
import { analyticsService } from '@dashboard/services/analyticsService'
import { useSparklineData } from '@dashboard/hooks/useSparklineData'
import {
  generateSparklinePath,
  getAdherenceColor,
  computeDomain,
  projectY,
} from '@dashboard/utils/sparklineUtils'
import SparklineTooltip from '@dashboard/components/SparklineTooltip'
import './SparklineAdesao.css'

const SIZES = {
  inline: { width: 120, height: 20, padding: 2 },
  small: { width: 120, height: 32, padding: 4 },
  medium: { width: 200, height: 40, padding: 6 },
  large: { width: 280, height: 48, padding: 8 },
  expanded: { width: 320, height: 56, padding: 8 },
}

export function SparklineAdesao({ adherenceByDay = [], size = 'medium', days = null, showAxis = false, showTooltip = true, className = '', onDayClick }) {
  // 1. States
  const [activePoint, setActivePoint] = useState(null)

  // 2. Derived data + memos
  const { width, height, padding } = SIZES[size] || SIZES.medium
  const { chartData, stats } = useSparklineData(adherenceByDay, days ?? (size === 'expanded' ? 30 : 7))

  const domain = useMemo(() => computeDomain(chartData), [chartData])
  const sparklinePath = useMemo(
    () => generateSparklinePath(chartData, width, height, padding, domain),
    [chartData, width, height, padding, domain]
  )
  // Dots em todos os tamanhos exceto inline (inline = só a curva); habilita drill-down
  // e tooltip mesmo sem o `showTooltip` da legenda HTML.
  const dataPoints = useMemo(
    () =>
      size !== 'inline'
        ? chartData.map((d, i) => ({
            ...d,
            x: padding + i * ((width - padding * 2) / (chartData.length - 1 || 1)),
            y: projectY(d.adherence, domain, height, padding),
            index: i,
          }))
        : [],
    [chartData, width, height, padding, size, domain]
  )

  // 3. Handlers
  const handleDayClick = useCallback((dayData) => {
    analyticsService.track('sparkline_day_clicked', dayData)
    onDayClick?.(dayData)
  }, [onDayClick])

  const handleDotActivate = useCallback((d) => {
    setActivePoint((prev) => (prev === d.index ? null : d.index))
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
        <path d={sparklinePath} fill="url(#sparklineGradient)" />
        <path d={sparklinePath} fill="none" stroke="var(--color-primary)" strokeWidth="1" filter="url(#sparklineGlow)" />
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
        <SparklineTooltip activePoint={activePoint} dataPoints={dataPoints} width={width} />
      </svg>
      {showTooltip && size !== 'inline' && size !== 'expanded' && (
        <div className="sparkline-tooltip-container">
          {chartData.map((d, i) => <div key={d.date} className="sparkline-day-tooltip" style={{ '--day-index': i }}><span className="sparkline-day-name">{d.dayName}</span><span style={{ color: getAdherenceColor(d.adherence) }}>{d.adherence}%</span></div>)}
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
