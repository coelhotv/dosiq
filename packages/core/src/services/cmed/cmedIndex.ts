// Núcleo puro do índice CMED (spec 066 Slice A · CON-038).
//
// Decodifica o formato colunar `cmedIndex v1` (prompt A §5.2), indexa EAN-13 → linhas,
// resolve o scan e agrupa apresentações para o passo 2 da busca 2C. Sem rede, disco
// nem relógio: o loader do mobile (Slice B) entrega o JSON já baixado.

import { normalizeText, matchesPrefix } from '../anvisaDatabase'

/** Versão de layout que este app sabe ler. Layout novo ⇒ `v` novo (E10). */
export const CMED_INDEX_VERSION = 1

const STRING_COLS = ['e', 'p', 's', 'a', 'r'] as const
const NULLABLE_STRING_COLS = ['ds'] as const
const DICT_COLS = ['l', 'k', 'c', 't', 'u', 'f'] as const
const NUMBER_COLS = ['d', 'nc', 'q', 'amb'] as const

/** Uma apresentação comercial (schema lógico, prompt A §5.1). */
export interface CmedRow {
  /** EANs da linha como vieram no arquivo (sem filtro de checksum). */
  e: string[]
  p: string
  s: string
  a: string
  r: string
  l: string | null
  k: string | null
  c: string | null
  cn: string | null
  t: string | null
  d: number | null
  u: string | null
  ds: string | null
  nc: number | null
  f: string | null
  q: number | null
  amb: boolean
}

export interface CmedIndex {
  n: number
  rows: CmedRow[]
  /** Chave de busca sem acento, gerada na carga (DF-2). */
  productKeys: string[]
  substanceKeys: string[]
}

export type CmedDecodeResult =
  | { ok: true; index: CmedIndex }
  | { ok: false; reason: 'version' | 'shape' }

type Raw = Record<string, unknown>

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function dictValue(dict: unknown[], idx: unknown): string | null {
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= dict.length) return null
  const value = dict[idx]
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Decodifica o `cmedIndex.json` colunar. Nunca lança: `v` desconhecido ⇒ `version`
 * (o app cai no manual com motivo); qualquer coluna ausente ou de tamanho ≠ `n` ⇒ `shape`.
 */
export function decodeCmedIndex(raw: unknown): CmedDecodeResult {
  if (!isObject(raw)) return { ok: false, reason: 'shape' }
  if (raw.v !== CMED_INDEX_VERSION) return { ok: false, reason: 'version' }
  const n = raw.n
  const cols = raw.cols
  const dict = raw.dict
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false, reason: 'shape' }
  if (!isObject(cols) || !isObject(dict)) return { ok: false, reason: 'shape' }

  const allCols = [...STRING_COLS, ...NULLABLE_STRING_COLS, ...DICT_COLS, ...NUMBER_COLS]
  for (const key of allCols) {
    const col = cols[key]
    if (!Array.isArray(col) || col.length !== n) return { ok: false, reason: 'shape' }
  }
  const dicts: Record<string, unknown[]> = {}
  for (const key of [...DICT_COLS, 'cn']) {
    const d = dict[key]
    if (!Array.isArray(d)) return { ok: false, reason: 'shape' }
    dicts[key] = d
  }

  const col = (key: string) => cols[key] as unknown[]
  const rows: CmedRow[] = new Array(n)
  const productKeys: string[] = new Array(n)
  const substanceKeys: string[] = new Array(n)
  for (let i = 0; i < n; i += 1) {
    const eRaw = col('e')[i]
    const cIdx = col('c')[i]
    const row: CmedRow = {
      e: typeof eRaw === 'string' && eRaw ? eRaw.split('|').filter(Boolean) : [],
      p: String(col('p')[i] ?? ''),
      s: String(col('s')[i] ?? ''),
      a: String(col('a')[i] ?? ''),
      r: String(col('r')[i] ?? ''),
      l: dictValue(dicts.l, col('l')[i]),
      k: dictValue(dicts.k, col('k')[i]),
      c: dictValue(dicts.c, cIdx),
      cn: dictValue(dicts.cn, cIdx),
      t: dictValue(dicts.t, col('t')[i]),
      u: dictValue(dicts.u, col('u')[i]),
      f: dictValue(dicts.f, col('f')[i]),
      d: numberOrNull(col('d')[i]),
      nc: numberOrNull(col('nc')[i]),
      q: numberOrNull(col('q')[i]),
      ds: typeof col('ds')[i] === 'string' ? (col('ds')[i] as string) : null,
      amb: col('amb')[i] === 1 || col('amb')[i] === true,
    }
    rows[i] = row
    productKeys[i] = normalizeText(row.p)
    substanceKeys[i] = normalizeText(row.s)
  }
  return { ok: true, index: { n, rows, productKeys, substanceKeys } }
}

/** Dígito verificador do EAN-13 (pesos 1,3 alternados). */
export function isValidEan13(ean: string | null | undefined): boolean {
  if (typeof ean !== 'string' || !/^[0-9]{13}$/.test(ean)) return false
  let sum = 0
  for (let i = 0; i < 12; i += 1) sum += Number(ean[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10 === Number(ean[12])
}

export type EanLookup = Map<string, number[]>

/** EAN-13 válido → linhas (um EAN pode apontar para N linhas). Inválido fica fora (E1). */
export function buildEanLookup(index: CmedIndex): EanLookup {
  const lookup: EanLookup = new Map()
  index.rows.forEach((row, rowIdx) => {
    for (const ean of row.e) {
      if (!isValidEan13(ean)) continue
      const list = lookup.get(ean)
      if (!list) lookup.set(ean, [rowIdx])
      else if (!list.includes(rowIdx)) list.push(rowIdx)
    }
  })
  return lookup
}

export type EanResolution =
  | { kind: 'found'; rowIdx: number }
  | { kind: 'multiple'; rowIdxs: number[] }
  | { kind: 'not_found' }

function identityKey(row: CmedRow): string {
  return JSON.stringify([row.d, row.u, row.f, row.q, row.l])
}

/**
 * Resolve um EAN lido. Linhas iguais em dose/unidade/forma/quantidade/laboratório
 * colapsam em `found`; divergentes viram `multiple` (FR-026 — nunca escolhe a primeira).
 */
export function resolveEan(lookup: EanLookup, index: CmedIndex, ean: string): EanResolution {
  const rowIdxs = lookup.get(ean)
  if (!rowIdxs || rowIdxs.length === 0) return { kind: 'not_found' }
  const distinct: number[] = []
  const seen = new Set<string>()
  for (const idx of rowIdxs) {
    const key = identityKey(index.rows[idx])
    if (seen.has(key)) continue
    seen.add(key)
    distinct.push(idx)
  }
  if (distinct.length === 1) return { kind: 'found', rowIdx: distinct[0] }
  return { kind: 'multiple', rowIdxs: distinct }
}

/** Passo 1 (prefixo word-boundary em produto ou substância). */
export function searchCmedByName(index: CmedIndex, query: string, limit = 50): number[] {
  const q = normalizeText(query).trim()
  if (!q) return []
  const out: number[] = []
  for (let i = 0; i < index.n && out.length < limit; i += 1) {
    if (matchesPrefix(index.productKeys[i], q) || matchesPrefix(index.substanceKeys[i], q)) out.push(i)
  }
  return out
}

/** Passo 2: linhas cujo produto é exatamente o nome escolhido na base ANVISA. */
export function findRowsByProductName(index: CmedIndex, name: string | null | undefined): number[] {
  const key = normalizeText(name).trim()
  if (!key) return []
  const out: number[] = []
  for (let i = 0; i < index.n; i += 1) if (index.productKeys[i] === key) out.push(i)
  return out
}

export interface PickerLab {
  laboratory: string | null
  rowIdxs: number[]
}

export interface PickerQuantity {
  quantity: number | null
  /** Linha representativa (para genérico, qualquer laboratório serve — D11). */
  rowIdx: number
  /** Só não-genérico com 2+ laboratórios; vazio = não perguntar laboratório. */
  laboratories: PickerLab[]
}

export interface PickerStrength {
  /** `ds` cru; a UI formata com `formatStrength`. */
  strength: string | null
  dose: number | null
  unit: string | null
  form: string | null
  quantities: PickerQuantity[]
}

/**
 * Agrupa linhas para o passo 2 da 2C: força (ds+dose+unidade+forma) → quantidade →
 * laboratório só para não-genérico (D11). Ordem estável pela 1ª aparição.
 */
export function groupForPicker(index: CmedIndex, rowIdxs: number[]): PickerStrength[] {
  const strengths = new Map<string, PickerStrength>()
  const qtyMaps = new Map<string, Map<string, PickerQuantity>>()
  for (const idx of rowIdxs) {
    const row = index.rows[idx]
    if (!row) continue
    const sKey = JSON.stringify([row.ds, row.d, row.u, row.f])
    let strength = strengths.get(sKey)
    if (!strength) {
      strength = { strength: row.ds, dose: row.d, unit: row.u, form: row.f, quantities: [] }
      strengths.set(sKey, strength)
      qtyMaps.set(sKey, new Map())
    }
    const qMap = qtyMaps.get(sKey) as Map<string, PickerQuantity>
    const qKey = String(row.q)
    let qty = qMap.get(qKey)
    if (!qty) {
      qty = { quantity: row.q, rowIdx: idx, laboratories: [] }
      qMap.set(qKey, qty)
      strength.quantities.push(qty)
    }
    if (row.k === 'generico') continue
    const lab = qty.laboratories.find((l) => l.laboratory === row.l)
    if (lab) lab.rowIdxs.push(idx)
    else qty.laboratories.push({ laboratory: row.l, rowIdxs: [idx] })
  }
  for (const strength of strengths.values()) {
    for (const qty of strength.quantities) {
      if (qty.laboratories.length < 2) qty.laboratories = []
    }
  }
  return [...strengths.values()]
}
