/**
 * SparklineTooltip — Overlay de tooltip para o SparklineAdesao.
 */
import { formatDate } from '@dashboard/utils/sparklineUtils'

export default function SparklineTooltip({ activePoint, dataPoints, width }) {
  if (activePoint === null || !dataPoints[activePoint]) return null
  const pt = dataPoints[activePoint]
  const tooltipW = 80
  const tooltipH = 36
  const tooltipPad = 4
  let tx = pt.x - tooltipW / 2
  if (tx < tooltipPad) tx = tooltipPad
  if (tx + tooltipW > width - tooltipPad) tx = width - tooltipPad - tooltipW
  const ty = pt.y - tooltipH - 6 < tooltipPad ? pt.y + 8 : pt.y - tooltipH - 6

  return (
    <g className="sparkline-tooltip-overlay" aria-hidden="true">
      <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx="4" fill="var(--bg-secondary, #1f2937)" stroke="var(--color-border, #374151)" strokeWidth="1" />
      <text x={tx + tooltipW / 2} y={ty + 13} textAnchor="middle" className="sparkline-tooltip-date">{formatDate(pt.date)}</text>
      <text x={tx + tooltipW / 2} y={ty + 27} textAnchor="middle" className="sparkline-tooltip-value">{pt.adherence}% · {pt.taken}/{pt.expected} doses</text>
    </g>
  )
}
