import { describe, it, expect } from 'vitest'
import { INJECTION_SITE_VALUES } from '../injectionSites'
import {
  INJECTION_BODY_MAP,
  INJECTION_BODY_MAP_VIEWBOX,
  BODY_MAP_FACES,
  getBodyMapRegion,
  getBodyMapRegionsByFace,
  findBodyMapParityGaps,
} from '../injectionBodyMap'

// Um path SVG válido aqui é só M/L/A/Z com números — o renderer não faz transform (ADR-096).
const PATH_RE = /^M[-\d.]+,[-\d.]+( [LA][-\d., ]+)+ Z$/

describe('injectionBodyMap — paridade com o enum (FR-008)', () => {
  it('todo sítio do enum tem exatamente uma região e toda região tem sítio no enum', () => {
    expect(findBodyMapParityGaps(INJECTION_SITE_VALUES, INJECTION_BODY_MAP)).toEqual({
      missing: [],
      orphan: [],
      duplicated: [],
    })
    expect(INJECTION_BODY_MAP).toHaveLength(INJECTION_SITE_VALUES.length)
  })

  it('acusa sítio do enum sem desenho (enum cresceu)', () => {
    const gaps = findBodyMapParityGaps([...INJECTION_SITE_VALUES, 'panturrilha_e'], INJECTION_BODY_MAP)
    expect(gaps.missing).toEqual(['panturrilha_e'])
  })

  it('acusa região sem sítio no enum (enum encolheu)', () => {
    const gaps = findBodyMapParityGaps(
      INJECTION_SITE_VALUES.filter((v) => v !== 'gluteo_d'),
      INJECTION_BODY_MAP
    )
    expect(gaps.orphan).toEqual(['gluteo_d'])
  })

  it('acusa região duplicada', () => {
    const gaps = findBodyMapParityGaps(INJECTION_SITE_VALUES, [
      ...INJECTION_BODY_MAP,
      INJECTION_BODY_MAP[0],
    ])
    expect(gaps.duplicated).toEqual([INJECTION_BODY_MAP[0].value])
  })

  it('segue a ordem canônica do enum (ordem de Tab)', () => {
    expect(INJECTION_BODY_MAP.map((r) => r.value)).toEqual(INJECTION_SITE_VALUES)
  })
})

describe('injectionBodyMap — geometria', () => {
  it('declara o viewBox 120×232', () => {
    expect(INJECTION_BODY_MAP_VIEWBOX).toEqual({ width: 120, height: 232 })
  })

  it('glúteo só nas costas; abdômen, braço e coxa só na frente', () => {
    const costas = getBodyMapRegionsByFace('costas').map((r) => r.value)
    const frente = getBodyMapRegionsByFace('frente').map((r) => r.value)
    expect(costas).toEqual(['gluteo_e', 'gluteo_d'])
    expect(frente).toEqual(['abdomen_e', 'abdomen_d', 'braco_e', 'braco_d', 'coxa_e', 'coxa_d'])
    expect(BODY_MAP_FACES).toEqual(['frente', 'costas'])
  })

  it('lado esquerdo da pessoa fica à direita do desenho (espelho) nas duas vistas', () => {
    for (const region of ['abdomen', 'braco', 'coxa', 'gluteo']) {
      const e = getBodyMapRegion(`${region}_e`)
      const d = getBodyMapRegion(`${region}_d`)
      expect(e.centroid.x).toBeGreaterThan(60)
      expect(d.centroid.x).toBeLessThan(60)
    }
  })

  it('path e hitPath são paths absolutos sem transform, com centróide dentro do viewBox', () => {
    for (const r of INJECTION_BODY_MAP) {
      expect(r.path).toMatch(PATH_RE)
      expect(r.hitPath).toMatch(PATH_RE)
      expect(r.centroid.x).toBeGreaterThan(0)
      expect(r.centroid.x).toBeLessThan(120)
      expect(r.centroid.y).toBeGreaterThan(0)
      expect(r.centroid.y).toBeLessThan(232)
    }
  })

  it('hitPath é maior que o desenho (alvo de toque ampliado)', () => {
    for (const r of INJECTION_BODY_MAP) {
      expect(r.hitBounds.width).toBeGreaterThan(r.bounds.width)
      expect(r.hitBounds.height).toBeGreaterThan(r.bounds.height)
    }
  })

  it('getBodyMapRegion devolve null para vazio ou desconhecido', () => {
    expect(getBodyMapRegion(null)).toBeNull()
    expect(getBodyMapRegion('')).toBeNull()
    expect(getBodyMapRegion('joelho_e')).toBeNull()
  })
})
