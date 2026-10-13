import { describe, it, expect, afterEach, vi } from 'vitest'
import fixture from './fixtures/cmed-fixture.json'
import fixtureRows from './fixtures/cmed-fixture.rows.json'
import {
  decodeCmedIndex,
  isValidEan13,
  buildEanLookup,
  resolveEan,
  searchCmedByName,
  findRowsByProductName,
  groupForPicker,
} from '../cmedIndex'
import type { CmedIndex } from '../cmedIndex'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function decodeFixture(): CmedIndex {
  const result = decodeCmedIndex(structuredClone(fixture))
  if (result.ok === false) throw new Error(`fixture não decodifica: ${result.reason}`)
  return result.index
}

describe('decodeCmedIndex', () => {
  it('ida e volta: cada linha decodificada é igual ao rows.json do pipeline (FR-024)', () => {
    const index = decodeFixture()
    expect(index.n).toBe(fixtureRows.length)
    index.rows.forEach((row, i) => {
      const expected = fixtureRows[i]
      expect(row).toEqual({ ...expected, e: row.e })
      // o EAN de checksum inválido fica na linha decodificada; quem filtra é o lookup
      if (expected.e.length > 0) expect(row.e).toEqual(expected.e)
    })
  })

  it('normaliza amb 0/1 para booleano', () => {
    const index = decodeFixture()
    expect(index.rows.every((r) => typeof r.amb === 'boolean')).toBe(true)
    expect(index.rows.filter((r) => r.amb)).toHaveLength(1)
  })

  it('recusa v desconhecido com reason version (E10), sem throw', () => {
    expect(decodeCmedIndex({ ...structuredClone(fixture), v: 2 })).toEqual({ ok: false, reason: 'version' })
    const semV: Record<string, unknown> = structuredClone(fixture)
    delete semV.v
    expect(decodeCmedIndex(semV)).toEqual({ ok: false, reason: 'version' })
  })

  it.each([null, 'texto', [], 42])('entrada %p não-objeto ⇒ shape', (raw) => {
    expect(decodeCmedIndex(raw)).toEqual({ ok: false, reason: 'shape' })
  })

  it('coluna com comprimento ≠ n ⇒ shape', () => {
    const raw = structuredClone(fixture)
    raw.cols.q.pop()
    expect(decodeCmedIndex(raw)).toEqual({ ok: false, reason: 'shape' })
  })

  it('coluna ausente ⇒ shape', () => {
    const raw: { cols: Record<string, unknown> } = structuredClone(fixture)
    delete raw.cols.amb
    expect(decodeCmedIndex(raw)).toEqual({ ok: false, reason: 'shape' })
  })

  it('índice de dicionário fora do range vira null, nunca undefined', () => {
    const raw = structuredClone(fixture)
    raw.cols.l[0] = 999
    raw.cols.u[1] = -1
    const result = decodeCmedIndex(raw)
    if (result.ok === false) throw new Error('não decodificou')
    expect(result.index.rows[0].l).toBeNull()
    expect(result.index.rows[1].u).toBeNull()
  })
})

describe('isValidEan13', () => {
  it('confere dígito verificador e formato', () => {
    expect(isValidEan13('7896004778402')).toBe(true)
    expect(isValidEan13('7891317020576')).toBe(true)
    expect(isValidEan13('7890000000025')).toBe(false)
    expect(isValidEan13('789600477840')).toBe(false)
    expect(isValidEan13('78960047784021')).toBe(false)
    expect(isValidEan13('78960047784a2')).toBe(false)
    expect(isValidEan13('')).toBe(false)
    expect(isValidEan13(null)).toBe(false)
  })
})

describe('buildEanLookup + resolveEan', () => {
  const index = decodeFixture()
  const lookup = buildEanLookup(index)

  it('SC-005: 7896004778402 resolve para uma linha', () => {
    const res = resolveEan(lookup, index, '7896004778402')
    expect(res.kind).toBe('found')
    if (res.kind === 'found') expect(index.rows[res.rowIdx].ds).toBe('500 mg + 125 mg')
  })

  it('PO-9: EAN com linhas divergentes ⇒ multiple com X 30 e X 60', () => {
    const res = resolveEan(lookup, index, '7891317020576')
    expect(res.kind).toBe('multiple')
    if (res.kind === 'multiple') expect(res.rowIdxs.map((i) => index.rows[i].q)).toEqual([30, 60])
  })

  it('PO-9: EAN duplicado com linhas idênticas colapsa em found', () => {
    expect(lookup.get('7890000000017')).toHaveLength(2)
    expect(resolveEan(lookup, index, '7890000000017').kind).toBe('found')
  })

  it('PO-9: EAN de checksum inválido fica fora do lookup', () => {
    expect(lookup.has('7890000000025')).toBe(false)
    expect(resolveEan(lookup, index, '7890000000025')).toEqual({ kind: 'not_found' })
  })

  it.each(['', '123', '0000000000000'])('EAN %p ausente ⇒ not_found', (ean) => {
    expect(resolveEan(lookup, index, ean)).toEqual({ kind: 'not_found' })
  })

  it('EAN repetido na mesma linha entra uma vez', () => {
    const raw = structuredClone(fixture)
    raw.cols.e[8] = '7896004778402|7896004778402'
    const result = decodeCmedIndex(raw)
    if (result.ok === false) throw new Error('não decodificou')
    expect(buildEanLookup(result.index).get('7896004778402')).toEqual([8])
  })
})

describe('searchCmedByName / findRowsByProductName', () => {
  const index = decodeFixture()

  it('prefixo sem acento em produto ou substância', () => {
    expect(searchCmedByName(index, 'amoxi').map((i) => index.rows[i].p)).toContain(
      'Amoxicilina + Clavulanato de Potassio'
    )
    expect(searchCmedByName(index, 'clavul')).toHaveLength(1)
    expect(searchCmedByName(index, 'potássio').length).toBeGreaterThan(0)
  })

  it('respeita o limite e query vazia devolve []', () => {
    expect(searchCmedByName(index, 'c', 2)).toHaveLength(2)
    expect(searchCmedByName(index, '   ')).toEqual([])
  })

  it('lookup exato por nome do produto, sem acento', () => {
    expect(findRowsByProductName(index, 'DIVALPROATO DE SODIO')).toHaveLength(2)
    expect(findRowsByProductName(index, 'Divalproato')).toEqual([])
    expect(findRowsByProductName(index, null)).toEqual([])
  })
})

describe('groupForPicker', () => {
  const index = decodeFixture()

  it('força → quantidade: X 30 e X 60 na mesma força', () => {
    const groups = groupForPicker(index, findRowsByProductName(index, 'Divalproato de Sódio'))
    expect(groups).toHaveLength(1)
    expect(groups[0].quantities.map((q) => q.quantity)).toEqual([30, 60])
    expect(groups[0].quantities.every((q) => q.laboratories.length === 0)).toBe(true)
  })

  it('genérico com mesma força/quantidade colapsa sem pedir laboratório (D11)', () => {
    const groups = groupForPicker(index, findRowsByProductName(index, 'Clopidogrel'))
    expect(groups).toHaveLength(1)
    expect(groups[0].quantities).toHaveLength(1)
    expect(groups[0].quantities[0].laboratories).toEqual([])
  })

  it('não-genérico com 2 laboratórios na mesma caixa pergunta o laboratório', () => {
    const raw = structuredClone(fixture)
    raw.cols.l[10] = 0
    const result = decodeCmedIndex(raw)
    if (result.ok === false) throw new Error('não decodificou')
    const rows = [9, 10]
    result.index.rows[10].q = 30
    const groups = groupForPicker(result.index, rows)
    expect(groups[0].quantities[0].laboratories.map((l) => l.laboratory)).toHaveLength(2)
  })

  it('lista vazia ⇒ []', () => {
    expect(groupForPicker(index, [])).toEqual([])
  })
})
