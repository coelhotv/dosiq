// Mapa do corpo do relatório (spec 097 Slice C — PO-10, PO-11; FR-014, NC-3).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INJECTION_BODY_MAP } from '../../../utils/injectionBodyMap'
import { renderBodyMapSvg } from '../reportBodyMapSvg'

describe('renderBodyMapSvg', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('desenha as 8 regiões da geometria do core: usadas com número, demais tracejadas sem número', () => {
    const svg = renderBodyMapSvg({ abdomen_e: 9, gluteo_d: 1 }, 'Locais')
    for (const r of INJECTION_BODY_MAP) expect(svg).toContain(`d="${r.path}"`)
    expect(svg.match(/data-site="/g)).toHaveLength(2)
    expect(svg.match(/stroke-dasharray/g)).toHaveLength(6)
    expect(svg).toMatch(/>9<\/text>/)
    expect(svg).toMatch(/>1<\/text>/)
  })

  it('NC-3: região usada tem o mesmo desenho com 1 ou 30 aplicações (sem intensidade nem tamanho)', () => {
    const one = renderBodyMapSvg({ abdomen_e: 1 }, 'x')
    const many = renderBodyMapSvg({ abdomen_e: 30 }, 'x')
    expect(one.replace(/>1<\/text>/, '>N</text>')).toBe(many.replace(/>30<\/text>/, '>N</text>'))
    expect(one).not.toMatch(/opacity|#dc2626|#ef4444|red|orange/i)
  })

  it('local desconhecido ou contagem 0 não desenha número', () => {
    const svg = renderBodyMapSvg({ orelha: 3, coxa_e: 0 }, 'x')
    expect(svg).not.toContain('data-site=')
  })
})
