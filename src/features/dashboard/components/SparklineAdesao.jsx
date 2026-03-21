/**
 * SparklineAdesao - Componente de gráfico de linha para visualização de adesão
 *
 * Gráfico SVG inline mostrando tendência de adesão com cores semânticas e animações suaves.
 *
 * Suporta drill-down: clique em qualquer ponto para ver detalhes do dia.
 * Suporta tooltip interativo: tap no ponto mostra data + % + doses.
 *
 * Tamanhos disponíveis:
 *  - 'inline'   — Minimalista (20px altura) para uso dentro de RingGauge
 *  - 'small'    — Compacto
 *  - 'medium'   — Padrão
 *  - 'large'    — Expandido 7d
 *  - 'expanded' — 30 pontos (Minha Saúde)
 *
 * @component
 */

import { useMemo, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsService } from '@dashboard/services/analyticsService'
import { debugLog } from '@utils/logger'
import './SparklineAdesao.css'

/**
 * Helper to check if a date is "today or before" in Brazil time (GMT-3)
 * Until 3AM UTC (which is midnight in Brazil), we don't show the "next day"
 * @param {string} dateStr - Date in format YYYY-MM-DD
 * @returns {boolean} true if date is visible (today or past)
 */
function isDateVisibleInBrazil(dateStr) {
  const now = new Date()
  const brazilOffset = -3 * 60 * 60 * 1000 // GMT-3 in milliseconds

  // Current time in Brazil
  const nowInBrazil = new Date(now.getTime() + brazilOffset)

  // Compare dates (ignoring time)
  const nowDateStr = nowInBrazil.toISOString().split('T')[0]
  const nowDate = new Date(nowDateStr + 'T00:00:00')
  const inputDate = new Date(dateStr + 'T00:00:00')

  return inputDate <= nowDate
}

/**
 * Gera path SVG para o sparkline
 * @param {Array} data - Array de objetos { date, adherence }
 * @param {number} width - Largura do SVG
 * @param {number} height - Altura do SVG
 * @param {number} padding - Padding interno
 * @returns {string} Path SVG
 */
const generateSparklinePath = (data, width, height, padding) => {
  if (!data || data.length === 0) return ''

  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const stepX = availableWidth / (data.length - 1 || 1)

  const points = data.map((d, i) => {
    const x = padding + i * stepX
    // Inverter Y (100% no topo = y: padding)
    const y = padding + availableHeight - (d.adherence / 100) * availableHeight
    return `${x},${y}`
  })

  // Gerar curva suave usando spline
  return createSmoothPath(points, availableHeight)
}

/**
 * Cria path suave usando curvas quadráticas
 * @param {Array} points - Array de strings "x,y"
 * @param {number} height - Altura disponível
 * @returns {string} Path SVG
 */
const createSmoothPath = (points, height) => {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const [x, y] = points[0].split(',').map(Number)
    return `M ${x},${height} L ${x},${y} L ${x},${height}`
  }

  let path = `M ${points[0]},${height}`

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i].split(',').map(Number)

    if (i === 0) {
      path = `M ${x},${height} L ${x},${y}`
    } else if (i < points.length - 1) {
      const [nextX, nextY] = points[i + 1].split(',').map(Number)
      const cpX = (x + nextX) / 2
      path += ` Q ${cpX},${y} ${cpX},${(y + nextY) / 2}`
    } else {
      path += ` L ${x},${y} L ${x},${height}`
    }
  }

  path += ' Z'
  return path
}

/**
 * Retorna cor semântica baseada na adesão
 * @param {number} adherence - Valor de adesão (0-100)
 * @returns {string} Cor CSS
 */
const getAdherenceColor = (adherence) => {
  if (adherence >= 80) return 'var(--color-success, #10b981)'
  if (adherence >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-error, #ef4444)'
}

/**
 * Formata data YYYY-MM-DD para DD/MM
 */
function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

/**
 * Componente SparklineAdesao
 *
 * @param {Object} props
 * @param {Array} props.adherenceByDay - Array de objetos { date: 'YYYY-MM-DD', adherence: number, taken: number, expected: number }
 * @param {'inline'|'small'|'medium'|'large'|'expanded'} props.size - Tamanho do gráfico
 * @param {boolean} props.showAxis - Mostrar eixo X
 * @param {boolean} props.showTooltip - Mostrar tooltips de label (legenda)
 * @param {string} props.className - Classes CSS adicionais
 * @param {Function} props.onDayClick - Callback quando um dia é clicado (dayData) => void
 */
export function SparklineAdesao({
  adherenceByDay = [],
  size = 'medium',
  days = null,
  showAxis = false,
  showTooltip = true,
  className = '',
  onDayClick,
}) {
  // Estado do tooltip interativo (tap num ponto)
  const [activePoint, setActivePoint] = useState(null)

  // Handler memoizado para evitar recriações
  const handleDayClick = useCallback(
    (dayData) => {
      analyticsService.track('sparkline_day_clicked', {
        date: dayData.date,
        adherence: dayData.adherence,
        taken: dayData.taken,
        expected: dayData.expected,
      })

      onDayClick?.(dayData)
    },
    [onDayClick]
  )

  const handleSparklineTap = (dayData) => {
    analyticsService.track('sparkline_tapped', {
      date: dayData.date,
      adherence: dayData.adherence,
    })
  }

  const sizes = {
    inline: { width: 120, height: 20, padding: 2 },
    small: { width: 120, height: 32, padding: 4 },
    medium: { width: 200, height: 40, padding: 6 },
    large: { width: 280, height: 48, padding: 8 },
    expanded: { width: 320, height: 56, padding: 8 },
  }

  const { width, height, padding } = sizes[size] || sizes.medium

  // Quantos dias processar: prop days > expanded (30) > outros (7)
  const daysCount = days ?? (size === 'expanded' ? 30 : 7)

  // Processar dados — últimos N dias (filtrando dias futuros no horário do Brasil)
  const chartData = useMemo(() => {
    if (!adherenceByDay || adherenceByDay.length === 0) {
      return []
    }

    const today = new Date()
    const data = []

    // Itera de d-daysCount até d-1 (exclui hoje — adesão de hoje é sempre parcial)
    for (let i = daysCount; i >= 1; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]

      if (!isDateVisibleInBrazil(dateKey)) {
        continue
      }

      const dayData = adherenceByDay.find((d) => d.date === dateKey)
      data.push({
        date: dateKey,
        dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        adherence: dayData?.adherence ?? 0,
        taken: dayData?.taken ?? 0,
        expected: dayData?.expected ?? 0,
      })
    }

    debugLog('SparklineAdesao', `chartData final: ${data.length} dias`)
    if (data.length > 0) {
      debugLog('SparklineAdesao', 'Amostra de valores:', {
        primeiro: data[0],
        ultimo: data[data.length - 1],
        todosAdherencia: data.map((d) => d.adherence),
      })
    }
    return data
  }, [adherenceByDay, daysCount])

  // Calcular estatísticas
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { average: 0, trend: 'stable' }
    }

    const validData = chartData.filter((d) => d.adherence > 0)
    debugLog('SparklineAdesao', 'Stats:', {
      totalDays: chartData.length,
      validDays: validData.length,
      adherenceValues: chartData.map((d) => d.adherence),
    })
    if (validData.length === 0) {
      return { average: 0, trend: 'stable' }
    }

    const average = Math.round(
      validData.reduce((sum, d) => sum + d.adherence, 0) / validData.length
    )

    let trend = 'stable'
    if (validData.length >= 2) {
      const firstHalf = validData.slice(0, Math.floor(validData.length / 2))
      const secondHalf = validData.slice(Math.floor(validData.length / 2))

      const firstAvg = firstHalf.reduce((sum, d) => sum + d.adherence, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.adherence, 0) / secondHalf.length

      if (secondAvg > firstAvg + 5) trend = 'up'
      else if (secondAvg < firstAvg - 5) trend = 'down'
    }

    return { average, trend }
  }, [chartData])

  // Gerar path do gráfico
  const sparklinePath = useMemo(() => {
    return generateSparklinePath(chartData, width, height, padding)
  }, [chartData, width, height, padding])

  // Gerar área de gradiente
  const gradientArea = useMemo(() => {
    if (!chartData.length || !sparklinePath) return null

    const points = chartData.map((d, i) => {
      const stepX = (width - padding * 2) / (chartData.length - 1 || 1)
      const x = padding + i * stepX
      const y = padding + (width - padding * 2) - (d.adherence / 100) * (height - padding * 2)
      return `${x},${y}`
    })

    const firstX = points[0]?.split(',')[0] || 0
    const lastX = points[points.length - 1]?.split(',')[0] || width

    return `${sparklinePath} L ${lastX},${height} L ${firstX},${height} Z`
  }, [chartData, sparklinePath, width, height, padding])

  // Calcular posições dos pontos de dados
  const dataPoints = useMemo(() => {
    const showDots = showTooltip && size !== 'inline'
    if (!showDots) return []

    return chartData.map((d, i) => {
      const stepX = (width - padding * 2) / (chartData.length - 1 || 1)
      const x = padding + i * stepX
      const y = padding + (height - padding * 2) - (d.adherence / 100) * (height - padding * 2)
      return { ...d, x, y, index: i }
    })
  }, [chartData, width, height, padding, showTooltip, size])

  // Não renderizar se não há dados
  if (chartData.length === 0) {
    return (
      <div
        className={`sparkline-adhesion sparkline-empty ${className}`}
        role="img"
        aria-label="Sem dados de adesão"
      >
        <span className="sparkline-empty-text">Sem dados</span>
      </div>
    )
  }

  // Detectar prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // -------------------------
  // SIZE: inline — minimalista (sem labels, dots, stats, tooltip)
  // -------------------------
  if (size === 'inline') {
    return (
      <div
        className={`sparkline-adhesion sparkline-adhesion--inline ${className}`}
        role="img"
        aria-label={`Tendência de adesão: ${stats.average}% média`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          className="sparkline-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sparklineGradientInline" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gradientArea && (
            <motion.path
              d={gradientArea}
              fill="url(#sparklineGradientInline)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            />
          )}
          <motion.path
            d={sparklinePath}
            fill="none"
            stroke="var(--color-primary, #ec4899)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
          />
        </svg>
      </div>
    )
  }

  // -------------------------
  // SIZE: small, medium, large, expanded — renderização completa
  // -------------------------
  return (
    <div
      className={`sparkline-adhesion sparkline-adhesion--${size} ${className}`}
      role="img"
      aria-label={`Gráfico de adesão: ${stats.average}% média em ${daysCount} dias. Tendência: ${stats.trend}`}
      onClick={(e) => {
        // Fechar tooltip ao clicar fora dos dots
        if (e.target.tagName !== 'circle') {
          setActivePoint(null)
        }
        handleSparklineTap(chartData[chartData.length - 1])
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.05" />
          </linearGradient>
          <filter id="sparklineGlow">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Linha de referência 80% */}
        {showAxis && (
          <line
            x1={padding}
            y1={padding + (height - padding * 2) * 0.2}
            x2={width - padding}
            y2={padding + (height - padding * 2) * 0.2}
            className="sparkline-reference-line"
            strokeDasharray="2,2"
          />
        )}

        {/* Área de gradiente */}
        {gradientArea && (
          <motion.path
            d={gradientArea}
            fill="url(#sparklineGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          />
        )}

        {/* Linha do sparkline */}
        <motion.path
          d={sparklinePath}
          fill="none"
          stroke="var(--color-primary, #ec4899)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#sparklineGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut' }}
        />

        {/* Pontos de dados clicáveis para drill-down */}
        {dataPoints.map((d) => (
          <motion.circle
            key={d.date}
            cx={d.x}
            cy={d.y}
            r={size === 'small' ? 2.5 : 3}
            fill={getAdherenceColor(d.adherence)}
            className="sparkline-dot sparkline-dot--clickable"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : d.index * 0.1, duration: 0.2 }}
            role="button"
            tabIndex={0}
            aria-label={`Ver detalhes de ${d.dayName}: ${d.adherence}% de adesão, ${d.taken} de ${d.expected} doses`}
            onClick={(e) => {
              e.stopPropagation()
              setActivePoint(activePoint === d.index ? null : d.index)
              if (onDayClick) handleDayClick(d)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setActivePoint(activePoint === d.index ? null : d.index)
                if (onDayClick) handleDayClick(d)
              }
            }}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            data-date={d.date}
            data-adherence={d.adherence}
            data-testid={`sparkline-dot-${d.date}`}
          />
        ))}

        {/* Tooltip interativo ao tap num ponto — só em sizes médios ou maiores */}
        {activePoint !== null &&
          dataPoints[activePoint] &&
          size !== 'small' &&
          (() => {
            const pt = dataPoints[activePoint]
            const tooltipW = 80
            const tooltipH = 36
            const tooltipPad = 4

            // Clamp horizontal para não sair do SVG
            let tx = pt.x - tooltipW / 2
            if (tx < tooltipPad) tx = tooltipPad
            if (tx + tooltipW > width - tooltipPad) tx = width - tooltipPad - tooltipW

            // Posicionar acima do ponto
            const ty = pt.y - tooltipH - 6 < tooltipPad ? pt.y + 8 : pt.y - tooltipH - 6

            return (
              <g className="sparkline-tooltip-overlay" aria-hidden="true">
                <rect
                  x={tx}
                  y={ty}
                  width={tooltipW}
                  height={tooltipH}
                  rx="4"
                  fill="var(--bg-secondary, #1f2937)"
                  stroke="var(--color-border, #374151)"
                  strokeWidth="1"
                />
                <text
                  x={tx + tooltipW / 2}
                  y={ty + 13}
                  textAnchor="middle"
                  className="sparkline-tooltip-date"
                >
                  {formatDate(pt.date)}
                </text>
                <text
                  x={tx + tooltipW / 2}
                  y={ty + 27}
                  textAnchor="middle"
                  className="sparkline-tooltip-value"
                >
                  {pt.adherence}% · {pt.taken}/{pt.expected} doses
                </text>
              </g>
            )
          })()}
      </svg>

      {/* Tooltips de dias (legenda) */}
      {showTooltip && size !== 'expanded' && (
        <div className="sparkline-tooltip-container">
          {chartData.map((d, i) => (
            <div key={d.date} className="sparkline-day-tooltip" style={{ '--day-index': i }}>
              <span className="sparkline-day-name">{d.dayName}</span>
              <span
                className="sparkline-day-value"
                style={{ color: getAdherenceColor(d.adherence) }}
              >
                {d.adherence}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Badge de estatística */}
      <div className={`sparkline-stats sparkline-stats-${size}`}>
        <span className="sparkline-average">{stats.average}%</span>
        <span className={`sparkline-trend sparkline-trend-${stats.trend}`}>
          {stats.trend === 'up' && '↑'}
          {stats.trend === 'down' && '↓'}
          {stats.trend === 'stable' && '→'}
        </span>
      </div>
    </div>
  )
}

export default SparklineAdesao
