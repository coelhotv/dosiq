import { describe, it, expect } from 'vitest'
import { parseMessageMarkdown, parseInlineSegments } from '../parseMessageMarkdown'

describe('parseInlineSegments', () => {
  it('texto cru → 1 segmento text', () => {
    expect(parseInlineSegments('oi mundo')).toEqual([{ type: 'text', value: 'oi mundo' }])
  })
  it('**negrito**', () => {
    expect(parseInlineSegments('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' c' },
    ])
  })
  it('_itálico_', () => {
    expect(parseInlineSegments('x _y_ z')).toEqual([
      { type: 'text', value: 'x ' },
      { type: 'italic', value: 'y' },
      { type: 'text', value: ' z' },
    ])
  })
  it('** solto (malformado) → texto cru, sem crash', () => {
    expect(parseInlineSegments('a ** b')).toEqual([{ type: 'text', value: 'a ** b' }])
  })
  it('vazio/null → []', () => {
    expect(parseInlineSegments('')).toEqual([])
    expect(parseInlineSegments(null)).toEqual([])
  })
})

describe('parseMessageMarkdown', () => {
  it('linha simples → bullet none', () => {
    const r = parseMessageMarkdown('olá')
    expect(r).toHaveLength(1)
    expect(r[0].bullet).toBe('none')
    expect(r[0].segments).toEqual([{ type: 'text', value: 'olá' }])
  })
  it('item `-`/`*` → bullet item', () => {
    expect(parseMessageMarkdown('- um')[0].bullet).toBe('item')
    expect(parseMessageMarkdown('* dois')[0].bullet).toBe('item')
  })
  it('sub-item `+` → bullet subitem', () => {
    expect(parseMessageMarkdown('+ filho')[0].bullet).toBe('subitem')
  })
  it('multi-linha preserva ordem + segmentos inline por linha', () => {
    const r = parseMessageMarkdown('intro\n- **A**\n+ b')
    expect(r.map((l) => l.bullet)).toEqual(['none', 'item', 'subitem'])
    expect(r[1].segments).toEqual([{ type: 'bold', value: 'A' }])
  })
  it('null/vazio não lança', () => {
    expect(() => parseMessageMarkdown(null)).not.toThrow()
    expect(parseMessageMarkdown('')).toEqual([{ bullet: 'none', segments: [] }])
  })
})
