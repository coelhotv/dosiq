import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAnvisaDatabase,
  normalizeText,
  matchesPrefix,
  shouldRefreshCache,
  resolveDataUrl,
} from '../anvisaDatabase'

const BASE = 'https://x.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1'
const FILE = 'medicineDatabase'

const MANIFEST = {
  version: '1.1.2',
  files: { medicineDatabase: { path: 'anvisa/v1/medicineDatabase.json' } },
}
const DATA = [
  { name: 'Losartana', activeIngredient: 'losartana potássica' },
  { name: 'Metformina', activeIngredient: 'metformina' },
]

// Response-like helper
function ok(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}
function httpErr(status = 500) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve(null) })
}

// Adapter in-memory configurável (simula Cache Storage / AsyncStorage)
function makeAdapter(initial = null, { writeFails = false } = {}) {
  let store = initial
  return {
    read: vi.fn(() => Promise.resolve(store)),
    write: vi.fn((_key, value) => {
      if (writeFails) return Promise.reject(new Error('quota'))
      store = value
      return Promise.resolve()
    }),
    _get: () => store,
  }
}

describe('anvisaDatabase — helpers puros', () => {
  it('normalizeText remove diacríticos + lowercase', () => {
    expect(normalizeText('Ácido Acetilsalicílico')).toBe('acido acetilsalicilico')
    expect(normalizeText('')).toBe('')
    expect(normalizeText(null)).toBe('')
  })

  it('matchesPrefix casa início e word-boundary, não mid-word', () => {
    expect(matchesPrefix('maleato de trimebutina', 'trime')).toBe(true)
    expect(matchesPrefix('trimetoprima', 'trime')).toBe(true)
    expect(matchesPrefix('sumatriptana', 'trime')).toBe(false)
    expect(matchesPrefix('', 'x')).toBe(false)
  })

  it('resolveDataUrl usa basename do manifest; fallback p/ fileKey.json', () => {
    expect(resolveDataUrl(BASE, MANIFEST, FILE)).toBe(`${BASE}/medicineDatabase.json`)
    expect(resolveDataUrl(BASE, { files: {} }, FILE)).toBe(`${BASE}/medicineDatabase.json`)
  })

  it('shouldRefreshCache: sem cache / sem data / versão difere / TTL', () => {
    const ttl = 7 * 24 * 60 * 60 * 1000
    expect(shouldRefreshCache({ remoteManifest: MANIFEST, cachedManifest: null, ttlMs: ttl, hasData: false })).toBe(true)
    expect(shouldRefreshCache({ remoteManifest: MANIFEST, cachedManifest: { version: '1.1.2' }, ttlMs: ttl, hasData: false })).toBe(true)
    expect(shouldRefreshCache({ remoteManifest: MANIFEST, cachedManifest: { version: '1.0.0', cachedAt: new Date().toISOString() }, ttlMs: ttl, hasData: true })).toBe(true)
    // versão igual + recente → não refresca
    expect(shouldRefreshCache({ remoteManifest: MANIFEST, cachedManifest: { version: '1.1.2', cachedAt: new Date().toISOString() }, ttlMs: ttl, hasData: true })).toBe(false)
    // versão igual + cachedAt antigo → TTL expirado → refresca
    expect(shouldRefreshCache({ remoteManifest: MANIFEST, cachedManifest: { version: '1.1.2', cachedAt: '2000-01-01T00:00:00.000Z' }, ttlMs: ttl, hasData: true })).toBe(true)
  })
})

describe('anvisaDatabase — createAnvisaDatabase.load()', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.unstubAllGlobals()
  })

  it('sem cache + online: baixa manifest + data e persiste', async () => {
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok(DATA)))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = makeAdapter(null)
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: adapter })

    const data = await db.load()
    expect(data).toEqual(DATA)
    expect(adapter.write).toHaveBeenCalledTimes(1)
    expect(adapter._get().data).toEqual(DATA)
  })

  it('memoiza: 2ª chamada não refaz fetch', async () => {
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok(DATA)))
    vi.stubGlobal('fetch', fetchMock)
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: makeAdapter(null) })

    await db.load()
    const callsAfterFirst = fetchMock.mock.calls.length
    await db.load()
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst)
  })

  it('cache válido (versão igual + recente): não rebaixa data', async () => {
    const cached = {
      manifest: { ...MANIFEST, cachedAt: new Date().toISOString() },
      data: DATA,
    }
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok([{ name: 'X' }])))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = makeAdapter(cached)
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: adapter })

    const data = await db.load()
    expect(data).toEqual(DATA)
    // só buscou manifest, não o data file
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(adapter.write).not.toHaveBeenCalled()
  })

  it('offline sem cache: load() → [] sem throw', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: makeAdapter(null) })
    await expect(db.load()).resolves.toEqual([])
  })

  it('offline COM cache válido: serve cache stale (não apaga)', async () => {
    const cached = { manifest: { ...MANIFEST, cachedAt: '2000-01-01T00:00:00.000Z' }, data: DATA }
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: makeAdapter(cached) })
    await expect(db.load()).resolves.toEqual(DATA)
  })

  it('data file HTTP 500 com cache válido: usa cache', async () => {
    const cached = { manifest: { version: '1.0.0', cachedAt: new Date().toISOString() }, data: DATA }
    // versão difere → tenta refresh; data file falha → cai no catch → serve cache
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : httpErr(500)))
    vi.stubGlobal('fetch', fetchMock)
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: makeAdapter(cached) })
    await expect(db.load()).resolves.toEqual(DATA)
  })

  it('write falha (quota): não quebra busca, retorna data baixada', async () => {
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok(DATA)))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = makeAdapter(null, { writeFails: true })
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: adapter })
    await expect(db.load()).resolves.toEqual(DATA)
  })

  it('versão do manifest difere: re-download + repersiste', async () => {
    const cached = { manifest: { version: '1.0.0', cachedAt: new Date().toISOString() }, data: [{ name: 'velho' }] }
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok(DATA)))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = makeAdapter(cached)
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: adapter })

    const data = await db.load()
    expect(data).toEqual(DATA)
    expect(adapter.write).toHaveBeenCalledTimes(1)
    expect(adapter._get().manifest.version).toBe('1.1.2')
  })

  it('read do adapter rejeita: trata como sem cache (baixa do remoto)', async () => {
    const fetchMock = vi.fn((url) => (url.endsWith('manifest.json') ? ok(MANIFEST) : ok(DATA)))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = { read: vi.fn(() => Promise.reject(new Error('corrupt'))), write: vi.fn(() => Promise.resolve()) }
    const db = createAnvisaDatabase({ baseUrl: BASE, fileKey: FILE, storageAdapter: adapter })
    await expect(db.load()).resolves.toEqual(DATA)
  })
})
