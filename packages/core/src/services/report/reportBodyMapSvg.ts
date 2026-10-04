/**
 * renderBodyMapSvg — mapa do corpo do relatório em SVG string (spec 097 FR-014, ADR-096).
 * Terceiro renderer da geometria do core (web e mobile já desenham a mesma): nenhum path de região
 * vive fora de `injectionBodyMap.ts`.
 *
 * Linha SaMD (NC-3): região usada tem o mesmo desenho, seja 1 ou 30 aplicações — o número dentro
 * dela é a única informação. Sem intensidade, tom, tamanho ou cor de risco. Região não usada:
 * contorno tracejado claro, sem número. Legível impresso em preto e branco.
 */
import {
  BODY_MAP_FACES,
  BODY_MAP_SIDE_LETTERS,
  BODY_MAP_SILHOUETTE,
  getBodyMapRegionsByFace,
  INJECTION_BODY_MAP_VIEWBOX,
  type BodyMapFace,
} from '../../utils/injectionBodyMap'

const FACE_LABEL: Record<BodyMapFace, string> = { frente: 'Frente', costas: 'Costas' }
const TOP = 12

function silhouette(face: BodyMapFace): string {
  const s = BODY_MAP_SILHOUETTE
  const fill = '#f3f4f6'
  const limbs = s.limbs
    .map((l) => `<path d="${l.d}" stroke="${fill}" stroke-width="${l.strokeWidth}" stroke-linecap="round" fill="none"/>`)
    .join('')
  const back =
    face === 'costas' ? s.backDetails.map((d) => `<path d="${d}" stroke="#d1d5db" stroke-width="1" fill="none"/>`).join('') : ''
  return (
    limbs +
    `<circle cx="${s.head.cx}" cy="${s.head.cy}" r="${s.head.r}" fill="${fill}"/>` +
    `<rect x="${s.neck.x}" y="${s.neck.y}" width="${s.neck.width}" height="${s.neck.height}" rx="${s.neck.rx}" fill="${fill}"/>` +
    `<path d="${s.torso}" fill="${fill}"/>` +
    back
  )
}

function face(face: BodyMapFace, counts: ReadonlyMap<string, number>, offsetX: number): string {
  const { width } = INJECTION_BODY_MAP_VIEWBOX
  const regions = getBodyMapRegionsByFace(face)
    .map((r) => {
      const n = counts.get(r.value) ?? 0
      if (n <= 0) return `<path d="${r.path}" fill="none" stroke="#9ca3af" stroke-width=".8" stroke-dasharray="2 1.5"/>`
      return (
        `<path d="${r.path}" fill="#ffffff" stroke="#0f766e" stroke-width="1.4" data-site="${r.value}"/>` +
        `<text x="${r.centroid.x}" y="${r.centroid.y + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#1f2937">${n}</text>`
      )
    })
    .join('')
  const letters =
    `<text x="6" y="${TOP - 3}" font-size="8" fill="#6b7280">${BODY_MAP_SIDE_LETTERS.left}</text>` +
    `<text x="${width - 6}" y="${TOP - 3}" font-size="8" fill="#6b7280" text-anchor="end">${BODY_MAP_SIDE_LETTERS.right}</text>` +
    `<text x="${width / 2}" y="${TOP - 3}" font-size="8" fill="#6b7280" text-anchor="middle">${FACE_LABEL[face]}</text>`
  return `<g transform="translate(${offsetX},0)">${letters}<g transform="translate(0,${TOP})">${silhouette(face)}${regions}</g></g>`
}

/**
 * Frente e costas lado a lado. `counts`: local canônico → aplicações. Local desconhecido é ignorado
 * (não tem região). `label` vai no `aria-label`, já escapado pelo chamador.
 */
export function renderBodyMapSvg(counts: Record<string, number>, label: string): string {
  const { width, height } = INJECTION_BODY_MAP_VIEWBOX
  const map = new Map(Object.entries(counts))
  const faces = BODY_MAP_FACES.map((f, i) => face(f, map, i * width)).join('')
  return (
    `<svg class="bodymap" viewBox="0 0 ${width * BODY_MAP_FACES.length} ${height + TOP}" role="img" aria-label="${label}">` +
    `${faces}</svg>`
  )
}
