/**
 * SparklineUtils — Utilitários de desenho para o SparklineAdesao.
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
    if (i === 0) path = `M ${x},${height} L ${x},${y}`
    else if (i < points.length - 1) {
      const [nextX, nextY] = points[i + 1].split(',').map(Number)
      const cpX = (x + nextX) / 2
      path += ` Q ${cpX},${y} ${cpX},${(y + nextY) / 2}`
    } else path += ` L ${x},${y} L ${x},${height}`
  }
  return path + ' Z'
}

export const generateSparklinePath = (data, width, height, padding) => {
  if (!data?.length) return ''
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const stepX = availableWidth / (data.length - 1 || 1)
  const points = data.map((d, i) => {
    const x = padding + i * stepX
    const y = padding + availableHeight - (d.adherence / 100) * availableHeight
    return `${x},${y}`
  })
  return createSmoothPath(points, availableHeight)
}

export const getAdherenceColor = (adherence) => {
  if (adherence >= 80) return 'var(--color-success, #10b981)'
  if (adherence >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-error, #ef4444)'
}

export function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
