// Paridade do wedge (spec 115 · FR-010 · INV-4): a RPC get_admin_growth_analytics classifica por
// prefixo de therapeutic_class_code com uma lista literal no SQL. Esta lista e WEDGE_CLASS_PREFIXES
// do core têm de ser a mesma — senão o painel e o app discordam sobre o que é GLP-1.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WEDGE_CLASS_PREFIXES, classifyWedge, inferMeasure } from '../trackedMeasure'

const MIGRATION = resolve(__dirname, '../../../../../docs/migrations/20261103_admin_growth_analytics.sql')

/** Extrai a lista marcada `-- WEDGE_CLASS_PREFIXES` do SQL (linha seguinte ao marcador). */
function sqlWedgePrefixes(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8')
  const match = sql.match(/--\s*WEDGE_CLASS_PREFIXES[^\n]*\n[^\n]*ARRAY\[([^\]]+)\]/)
  if (!match) throw new Error('marcador WEDGE_CLASS_PREFIXES ausente na migração')
  return match[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
}

describe('wedge GLP-1/antiobesidade (115 FR-010)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('SQL da migração espelha WEDGE_CLASS_PREFIXES', () => {
    expect([...sqlWedgePrefixes()].sort()).toEqual([...WEDGE_CLASS_PREFIXES].sort())
  })

  it('os prefixos do wedge mapeiam para peso na matriz de medidas (mesma fonte clínica)', () => {
    expect(WEDGE_CLASS_PREFIXES).toEqual(['A10S', 'A10X9', 'A8A'])
    for (const prefix of WEDGE_CLASS_PREFIXES) {
      expect(inferMeasure({ classCode: prefix, frequency: 'diário' })).toBe('peso')
    }
  })

  it('classifyWedge: prefixo mais longo vence; resto de A10 é antidiabético; NULL é sem código', () => {
    expect(classifyWedge('A10S')).toBe('glp1_antiobesidade')
    expect(classifyWedge(' a10x9 ')).toBe('glp1_antiobesidade')
    expect(classifyWedge('A8A')).toBe('glp1_antiobesidade')
    expect(classifyWedge('A10C9')).toBe('antidiabeticos_outros')
    expect(classifyWedge('A10')).toBe('antidiabeticos_outros')
    expect(classifyWedge('C7A')).toBe('outras')
    expect(classifyWedge('A8B')).toBe('outras')
    expect(classifyWedge(null)).toBe('sem_codigo')
    expect(classifyWedge('   ')).toBe('sem_codigo')
    expect(classifyWedge('invalido!')).toBe('sem_codigo')
  })
})
