import { useState } from 'react'
import { debugLog } from '@shared/utils/logger'
import HeatmapGrid from './HeatmapGrid'
import HeatmapStacked from './HeatmapStacked'
import './AdherenceHeatmap.css'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

/**
 * Calcula opacidade baseada na adherência (0-100%)
 */
const getOpacity = (adherence) => {
  if (adherence === null) return 1.0
  if (adherence >= 90) return 1.0
  if (adherence >= 75) return 0.8
  if (adherence >= 50) return 0.5
  if (adherence >= 25) return 0.25
  return 0.1
}

/**
 * Retorna cor CSS com opacidade adequada. null = cinza neutro.
 */
const getCellColor = (adherence) => {
  if (adherence === null) return 'rgba(120, 120, 140, 0.15)'
  return `rgba(34, 197, 94, ${getOpacity(adherence)})`
}

/**
 * Componente de heatmap de adesão por dia da semana e período do dia.
 * Desktop (>= 380px): Grid 7x4 | Mobile (< 380px): Stacked cards (via CSS).
 */
export default function AdherenceHeatmap({ pattern }) {
  const [hoveredCell, setHoveredCell] = useState(null)
  const [touchedCell, setTouchedCell] = useState(null)

  debugLog('AdherenceHeatmap', 'Pattern recebido:', pattern)

  if (!pattern || !pattern.hasEnoughData) {
    debugLog('AdherenceHeatmap', 'Dados insuficientes:', {
      hasPattern: !!pattern,
      hasEnoughData: pattern?.hasEnoughData,
      narrative: pattern?.narrative,
    })
    return (
      <div className="adherence-heatmap adherence-heatmap--empty" role="status">
        <p className="adherence-heatmap__empty-message">
          {pattern?.narrative || 'Registre pelo menos 21 dias de doses para análise de padrões.'}
        </p>
      </div>
    )
  }

  const buildTooltip = (dayIndex, periodIndex) => {
    const cell = pattern.grid[dayIndex][periodIndex]
    const adherenceText = cell.adherence === null ? 'N/D' : `${cell.adherence}%`
    const totalExpected = cell.expected * (pattern.dayOccurrences?.[dayIndex] || 1)
    return `${DAY_NAMES[dayIndex]} ${PERIOD_NAMES[periodIndex]}: ${adherenceText} (${cell.taken}/${totalExpected} doses)`
  }

  const handleCellMouseEnter = (dayIndex, periodIndex) => {
    setHoveredCell(buildTooltip(dayIndex, periodIndex))
  }

  const handleCellTouchEnd = (dayIndex, periodIndex) => {
    const tooltip = buildTooltip(dayIndex, periodIndex)
    setTouchedCell(tooltip === touchedCell ? null : tooltip)
  }

  const handleCellMouseLeave = () => setHoveredCell(null)

  return (
    <div
      className="adherence-heatmap"
      role="region"
      aria-label="Heatmap de adesão por dia e período"
    >
      <HeatmapGrid
        pattern={pattern}
        hoveredCell={hoveredCell}
        touchedCell={touchedCell}
        getCellColor={getCellColor}
        onCellMouseEnter={handleCellMouseEnter}
        onCellMouseLeave={handleCellMouseLeave}
        onCellTouchEnd={handleCellTouchEnd}
      />

      <HeatmapStacked pattern={pattern} getCellColor={getCellColor} />

      {pattern.narrative && (
        <div className="adherence-heatmap__narrative" role="status">
          💡 {pattern.narrative}
        </div>
      )}
    </div>
  )
}
