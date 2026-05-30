/**
 * SparklineUtils — Utilitários de desenho para o SparklineAdesao.
 *
 * Escala vertical FIXA 0-100 (adesão é métrica absoluta — 50% parece 50%; não
 * auto-escala min-max, que distorce o nível). Clamp 0-100 defende contra fonte
 * que mande >100% (AP-191). A curva usa Catmull-Rom → passa EXATAMENTE pelos
 * pontos (dots não descasam da linha).
 */

/** Garante adesão no intervalo [0, 100] (defesa contra fonte que mande >100%, AP-191). */
export const clampAdherence = (a) => Math.max(0, Math.min(100, Number.isFinite(a) ? a : 0))

/** Projeta adesão (0-100 fixo) para a coordenada y do SVG. */
export const projectY = (adherence, height, padding) => {
  const avail = height - padding * 2
  return padding + avail - (clampAdherence(adherence) / 100) * avail
}

/** x igualmente espaçado por índice. */
const projectX = (i, count, width, padding) =>
  padding + i * ((width - padding * 2) / (count - 1 || 1))

/**
 * Curva suave que PASSA pelos pontos (Catmull-Rom → Bézier cúbica). Diferente da
 * suavização por ponto-médio (que não toca os pontos → dots descasam).
 */
const catmullRomPath = (pts) => {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

/** Path da linha (passa pelos pontos). */
export const generateSparklinePath = (data, width, height, padding) => {
  if (!data?.length) return ''
  const pts = data.map((d, i) => ({
    x: projectX(i, data.length, width, padding),
    y: projectY(d.adherence, height, padding),
  }))
  return catmullRomPath(pts)
}

/** Path da área preenchida (linha + fecha na base). */
export const generateSparklineArea = (data, width, height, padding) => {
  const line = generateSparklinePath(data, width, height, padding)
  if (!line) return ''
  const baseY = height - padding
  const firstX = projectX(0, data.length, width, padding)
  const lastX = projectX(data.length - 1, data.length, width, padding)
  return `${line} L ${lastX},${baseY} L ${firstX},${baseY} Z`
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
