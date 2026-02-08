/**
 * SparklineAdesao - Componente de gráfico de linha para visualização de adesão
 * 
 * Gráfico SVG inline mostrando tendência de adesão dos últimos 7 dias
 * com cores semânticas e animações suaves.
 * 
 * @component
 * @example
 * <SparklineAdesao adherenceByDay={data} />
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { analyticsService } from '../../services/analyticsService'
import './SparklineAdesao.css'

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
 * Componente SparklineAdesao
 * 
 * @param {Object} props
 * @param {Array} props.adherenceByDay - Array de objetos { date: 'YYYY-MM-DD', adherence: number, taken: number, expected: number }
 * @param {string} props.size - Tamanho: 'small', 'medium', 'large'
 * @param {boolean} props.showAxis - Mostrar eixo X
 * @param {boolean} props.showTooltip - Mostrar tooltips
 * @param {string} props.className - Classes CSS adicionais
 */
export function SparklineAdesao({
  adherenceByDay = [],
  size = 'medium',
  showAxis = false,
  showTooltip = true,
  className = ''
}) {
  const handleSparklineTap = (dayData) => {
    analyticsService.track('sparkline_tapped', {
      date: dayData.date,
      adherence: dayData.adherence
    })
  }
  const sizes = {
    small: { width: 120, height: 32, padding: 4 },
    medium: { width: 200, height: 40, padding: 6 },
    large: { width: 280, height: 48, padding: 8 }
  }

  const { width, height, padding } = sizes[size] || sizes.medium

  // Processar dados - últimos 7 dias
  const chartData = useMemo(() => {
    if (!adherenceByDay || adherenceByDay.length === 0) return []

    const today = new Date()
    const data = []

    // Gerar últimos 7 dias
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      
      const dayData = adherenceByDay.find(d => d.date === dateKey)
      data.push({
        date: dateKey,
        dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        adherence: dayData?.adherence ?? 0,
        taken: dayData?.taken ?? 0,
        expected: dayData?.expected ?? 0
      })
    }

    return data
  }, [adherenceByDay])

  // Calcular estatísticas
  const stats = useMemo(() => {
    if (chartData.length === 0) return { average: 0, trend: 'stable' }

    const validData = chartData.filter(d => d.adherence > 0)
    if (validData.length === 0) return { average: 0, trend: 'stable' }

    const average = Math.round(validData.reduce((sum, d) => sum + d.adherence, 0) / validData.length)

    // Calcular tendência
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

  // Gerar pontos para tooltips
  const dataPoints = useMemo(() => {
    if (!showTooltip) return []

    return chartData.map((d, i) => {
      const stepX = (width - padding * 2) / (chartData.length - 1 || 1)
      const x = padding + i * stepX
      const y = padding + (height - padding * 2) - (d.adherence / 100) * (height - padding * 2)
      return { ...d, x, y }
    })
  }, [chartData, width, height, padding, showTooltip])

  // Não renderizar se não há dados
  if (chartData.length === 0) {
    return (
      <div className={`sparkline-adhesion sparkline-empty ${className}`} role="img" aria-label="Sem dados de adesão">
        <span className="sparkline-empty-text">Sem dados</span>
      </div>
    )
  }

  // Detectar prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className={`sparkline-adhesion ${className}`}
      role="img"
      aria-label={`Gráfico de adesão: ${stats.average}% média em 7 dias. Tendência: ${stats.trend}`}
      onClick={() => handleSparklineTap(chartData[chartData.length - 1])}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradiente de área */}
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary, #ec4899)" stopOpacity="0.05" />
          </linearGradient>

          {/* Filtro para brilho suave */}
          <filter id="sparklineGlow">
            <feGaussianBlur stdDeviation="1" result="blur" />
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
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#sparklineGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: 1, 
            opacity: 1 
          }}
          transition={{ 
            duration: prefersReducedMotion ? 0 : 0.8,
            ease: 'easeOut'
          }}
        />

        {/* Pontos de dados */}
        {dataPoints.map((d, i) => (
          <motion.circle
            key={d.date}
            cx={d.x}
            cy={d.y}
            r={size === 'small' ? 2 : 3}
            fill={getAdherenceColor(d.adherence)}
            className="sparkline-dot"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              delay: prefersReducedMotion ? 0 : i * 0.1,
              duration: 0.2
            }}
            role="graphics-symbol"
            aria-label={`${d.dayName}: ${d.adherence}%`}
          />
        ))}
      </svg>

      {/* Tooltips de dias (desktop) */}
      {showTooltip && (
        <div className="sparkline-tooltip-container">
          {chartData.map((d, i) => (
            <div 
              key={d.date}
              className="sparkline-day-tooltip"
              style={{ '--day-index': i }}
            >
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
