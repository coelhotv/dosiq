/**
 * SparklineUtils — Utilitários de desenho para o SparklineAdesao.
 *
 * Projeção vertical centralizada (`computeDomain` + `projectY`): path e dots usam
 * o MESMO domínio → ficam sempre alinhados. Auto-escala (min-max com margem) tira
 * a curva do "bloco chapado" quando os valores variam pouco; clamp 0-100 evita o
 * overflow visual do bug de adesão >100% (AP-191, defesa no componente).
 */

/** Garante adesão no intervalo [0, 100] (defesa contra fonte que mande >100%, AP-191). */
export const clampAdherence = (a) => Math.max(0, Math.min(100, Number.isFinite(a) ? a : 0))

/**
 * Domínio vertical [min, max] auto-escalado a partir dos dados (clampados 0-100).
 * - Valores variados: usa min/max com 15% de margem (curva ocupa a altura).
 * - Valores ~iguais (degenerado): banda centrada de ±20 (linha no meio, não colada).
 */
export const computeDomain = (data) => {
  if (!data?.length) return { min: 0, max: 100 }
  const vals = data.map((d) => clampAdherence(d.adherence))
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1) {
    const mid = (min + max) / 2
    min = Math.max(0, mid - 20)
    max = Math.min(100, mid + 20)
    if (max - min < 1) {
      min = 0
      max = 100
    }
  } else {
    const margin = (max - min) * 0.15
    min = Math.max(0, min - margin)
    max = Math.min(100, max + margin)
  }
  return { min, max }
}

/** Projeta uma adesão para a coordenada y do SVG, dado o domínio auto-escalado. */
export const projectY = (adherence, domain, height, padding) => {
  const avail = height - padding * 2
  const span = domain.max - domain.min || 1
  const ratio = (clampAdherence(adherence) - domain.min) / span
  return padding + avail - ratio * avail
}

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

export const generateSparklinePath = (data, width, height, padding, domain) => {
  if (!data?.length) return ''
  const dom = domain || computeDomain(data)
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const stepX = availableWidth / (data.length - 1 || 1)
  const points = data.map((d, i) => {
    const x = padding + i * stepX
    const y = projectY(d.adherence, dom, height, padding)
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
