/**
 * injectionBodyMap — Geometria do mapa corporal de sítios de injeção (spec 071, ADR-096)
 *
 * Dado PURO de apresentação: viewBox, silhueta e, por sítio de `INJECTION_SITES`, o `path`
 * desenhado, o `hitPath` (alvo de toque ampliado), o centróide (onde o ✓ e o marcador de
 * "última aplicação" são desenhados) e a face (`frente`|`costas`). Web (SVG inline) e mobile
 * (`react-native-svg`) renderizam a MESMA geometria — nenhum path de região vive em `apps/`.
 *
 * Sem dependência de react/svg lib (ADR-096): os paths saem prontos, em coordenadas absolutas,
 * sem `transform` — braço e coxa são retângulos arredondados rotacionados, já resolvidos aqui.
 *
 * Lateralidade: "esquerdo/direito" é o lado DA PESSOA, e as duas vistas são de ESPELHO — o lado
 * esquerdo da pessoa aparece à DIREITA do desenho na frente e nas costas (DESIGN_DECISOES §3).
 *
 * SaMD: o mapa DESCREVE o fato registrado; nunca sugere sítio nem desenha plano de rodízio
 * (ADR-072).
 *
 * @module injectionBodyMap
 */

export type BodyMapFace = 'frente' | 'costas'

export interface BodyMapPoint {
  x: number
  y: number
}

export interface BodyMapBounds {
  width: number
  height: number
}

export interface BodyMapRegion {
  /** Valor canônico de `INJECTION_SITES` (o mesmo persistido em `medicine_logs.injection_site`). */
  value: string
  face: BodyMapFace
  /** Path absoluto da região desenhada. */
  path: string
  /** Path absoluto da área tocável (maior que `path`; desenhada transparente). */
  hitPath: string
  centroid: BodyMapPoint
  /** Extensão do desenho no eixo da região (antes de rotacionar). */
  bounds: BodyMapBounds
  hitBounds: BodyMapBounds
}

/** Faces na ordem de exibição (frente e costas lado a lado — sem toggle, D-1). */
export const BODY_MAP_FACES: readonly BodyMapFace[] = ['frente', 'costas']

export const INJECTION_BODY_MAP_VIEWBOX = { width: 120, height: 232 } as const

/** Letras de lateralidade no topo de cada vista: D à esquerda do desenho, E à direita. */
export const BODY_MAP_SIDE_LETTERS = { left: 'D', right: 'E' } as const

/**
 * Silhueta neutra única (OQ-4), pose "da Vinci". Membros são traços com espessura
 * (`strokeWidth` + `strokeLinecap: round`); a linha da coluna/escápulas só aparece nas costas.
 */
export const BODY_MAP_SILHOUETTE = {
  head: { cx: 60, cy: 21, r: 13 },
  neck: { x: 54, y: 30, width: 12, height: 9, rx: 4 },
  limbs: [
    { d: 'M53,116 L40,212', strokeWidth: 21 },
    { d: 'M67,116 L80,212', strokeWidth: 21 },
    { d: 'M42,50 L20,112', strokeWidth: 14 },
    { d: 'M78,50 L100,112', strokeWidth: 14 },
  ],
  torso: 'M40,44 C40,39 48,37 60,37 C72,37 80,39 80,44 L76,92 L79,116 C70,121 50,121 41,116 L44,92 Z',
  backDetails: ['M60,46 L60,112', 'M46,54 C52,49 68,49 74,54'],
} as const

/** Margem do alvo de toque em unidades do viewBox (+8 ≈ +24 px na tela). */
const HIT_PAD = 8

const round = (n: number): number => Math.round(n * 100) / 100
const pt = (x: number, y: number): string => `${round(x)},${round(y)}`

/** Retângulo arredondado como path absoluto. */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M${pt(x + rr, y)}`,
    `L${pt(x + w - rr, y)}`,
    `A${round(rr)},${round(rr)} 0 0 1 ${pt(x + w, y + rr)}`,
    `L${pt(x + w, y + h - rr)}`,
    `A${round(rr)},${round(rr)} 0 0 1 ${pt(x + w - rr, y + h)}`,
    `L${pt(x + rr, y + h)}`,
    `A${round(rr)},${round(rr)} 0 0 1 ${pt(x, y + h - rr)}`,
    `L${pt(x, y + rr)}`,
    `A${round(rr)},${round(rr)} 0 0 1 ${pt(x + rr, y)}`,
    'Z',
  ].join(' ')
}

/**
 * Cápsula (retângulo com pontas totalmente arredondadas) entre dois centros de ponta,
 * em coordenadas absolutas — equivale a um retângulo rotacionado com `rx = raio`.
 */
function capsulePath(a: BodyMapPoint, b: BodyMapPoint, radius: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const nx = -uy * radius
  const ny = ux * radius
  const r = round(radius)
  return [
    `M${pt(a.x + nx, a.y + ny)}`,
    `L${pt(b.x + nx, b.y + ny)}`,
    `A${r},${r} 0 0 0 ${pt(b.x - nx, b.y - ny)}`,
    `L${pt(a.x - nx, a.y - ny)}`,
    `A${r},${r} 0 0 0 ${pt(a.x + nx, a.y + ny)}`,
    'Z',
  ].join(' ')
}

interface RectGeo {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  r: number
}

interface CapsuleGeo {
  kind: 'capsule'
  /** Eixo da região: de (x1,y1) a (x2,y2); largura `w`. Pontas arredondadas centradas nos extremos. */
  x1: number
  y1: number
  x2: number
  y2: number
  w: number
}

function buildRegion(
  value: string,
  face: BodyMapFace,
  geo: RectGeo | CapsuleGeo,
  centroid: BodyMapPoint
): BodyMapRegion {
  if (geo.kind === 'rect') {
    return {
      value,
      face,
      path: roundedRectPath(geo.x, geo.y, geo.w, geo.h, geo.r),
      hitPath: roundedRectPath(
        geo.x - HIT_PAD,
        geo.y - HIT_PAD,
        geo.w + HIT_PAD * 2,
        geo.h + HIT_PAD * 2,
        geo.r + 7
      ),
      centroid,
      bounds: { width: geo.w, height: geo.h },
      hitBounds: { width: geo.w + HIT_PAD * 2, height: geo.h + HIT_PAD * 2 },
    }
  }

  const a = { x: geo.x1, y: geo.y1 }
  const b = { x: geo.x2, y: geo.y2 }
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  // Alvo: +HIT_PAD de cada lado na largura e +6 em cada ponta no comprimento.
  const hitRadius = geo.w / 2 + HIT_PAD
  const shrink = HIT_PAD - 6
  const hitA = { x: a.x + ux * shrink, y: a.y + uy * shrink }
  const hitB = { x: b.x - ux * shrink, y: b.y - uy * shrink }
  return {
    value,
    face,
    path: capsulePath(a, b, geo.w / 2),
    hitPath: capsulePath(hitA, hitB, hitRadius),
    centroid,
    bounds: { width: geo.w, height: round(len + geo.w) },
    hitBounds: { width: geo.w + HIT_PAD * 2, height: round(len + geo.w + 12) },
  }
}

/**
 * As 8 regiões, na ordem canônica de `INJECTION_SITES` (= ordem de Tab).
 * Alturas anatômicas da Rev. 2: braço no deltoide, abdômen na barriga, coxa no terço
 * superior, glúteo logo abaixo da cintura.
 */
export const INJECTION_BODY_MAP: readonly BodyMapRegion[] = [
  buildRegion('abdomen_e', 'frente', { kind: 'rect', x: 60.8, y: 72, w: 15.5, h: 34, r: 7.5 }, { x: 68.5, y: 89 }),
  buildRegion('abdomen_d', 'frente', { kind: 'rect', x: 43.7, y: 72, w: 15.5, h: 34, r: 7.5 }, { x: 51.5, y: 89 }),
  buildRegion('braco_e', 'frente', { kind: 'capsule', x1: 80.5, y1: 57, x2: 87.5, y2: 77, w: 12.5 }, { x: 84, y: 67 }),
  buildRegion('braco_d', 'frente', { kind: 'capsule', x1: 39.5, y1: 57, x2: 32.5, y2: 77, w: 12.5 }, { x: 36, y: 67 }),
  buildRegion('coxa_e', 'frente', { kind: 'capsule', x1: 68.4, y1: 128, x2: 73.2, y2: 164, w: 18 }, { x: 70.8, y: 146 }),
  buildRegion('coxa_d', 'frente', { kind: 'capsule', x1: 51.6, y1: 128, x2: 46.8, y2: 164, w: 18 }, { x: 49.2, y: 146 }),
  buildRegion('gluteo_e', 'costas', { kind: 'rect', x: 60.5, y: 98, w: 16.5, h: 26, r: 10 }, { x: 68.7, y: 111 }),
  buildRegion('gluteo_d', 'costas', { kind: 'rect', x: 43, y: 98, w: 16.5, h: 26, r: 10 }, { x: 51.3, y: 111 }),
]

const REGION_BY_VALUE = new Map(INJECTION_BODY_MAP.map((r) => [r.value, r]))

/** Região de um sítio, ou null quando vazio/desconhecido (não lança). */
export function getBodyMapRegion(value: string | null | undefined): BodyMapRegion | null {
  if (!value) return null
  return REGION_BY_VALUE.get(value) ?? null
}

/** Regiões de uma face, na ordem canônica. */
export function getBodyMapRegionsByFace(face: BodyMapFace): BodyMapRegion[] {
  return INJECTION_BODY_MAP.filter((r) => r.face === face)
}

/**
 * Divergências entre o enum de sítios e as regiões do mapa (FR-008), nos dois sentidos.
 * Exportada para o teste de paridade poder provar que falha com um sítio fictício.
 */
export function findBodyMapParityGaps(
  siteValues: readonly string[],
  regions: readonly Pick<BodyMapRegion, 'value'>[]
): { missing: string[]; orphan: string[]; duplicated: string[] } {
  const regionValues = regions.map((r) => r.value)
  const seen = new Set<string>()
  const duplicated: string[] = []
  for (const v of regionValues) {
    if (seen.has(v)) duplicated.push(v)
    seen.add(v)
  }
  const siteSet = new Set(siteValues)
  return {
    missing: siteValues.filter((v) => !seen.has(v)),
    orphan: [...seen].filter((v) => !siteSet.has(v)),
    duplicated,
  }
}
