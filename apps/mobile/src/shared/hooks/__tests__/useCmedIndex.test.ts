// Fronteiras mockadas: adapter em disco (Map) e fetch. Núcleo cmed e helpers do core são os reais.
const mockCache = new Map<string, { manifest: unknown; data: unknown }>()
const mockWriteFail = { on: false }
jest.mock('@shared/services/_fileSystemStorageAdapter', () => ({
  createFileSystemStorageAdapter: () => ({
    read: jest.fn(async (k: string) => mockCache.get(k) ?? null),
    write: jest.fn(async (k: string, v: { manifest: unknown; data: unknown }) => {
      if (mockWriteFail.on) throw new Error('ENOSPC')
      mockCache.set(k, v)
    }),
  }),
}))

jest.mock('@dosiq/core/utils/dateUtils', () => {
  const actual = jest.requireActual('@dosiq/core/utils/dateUtils')
  return { ...actual, getNow: () => new Date('2026-10-13T12:00:00.000Z') }
})

import { renderHook, waitFor } from '@testing-library/react-native'
import fixture from '@dosiq/core/services/cmed/__tests__/fixtures/cmed-fixture.json'
import { useCmedIndex } from '../useCmedIndex'

global.fetch = jest.fn() as unknown as typeof fetch
const fetchMock = global.fetch as unknown as jest.Mock

const BASE = 'https://test/anvisa/v1'
const remoteManifest = {
  version: '1.1.11',
  files: { cmedIndex: { path: 'anvisa/v1/cmedIndex.json' } },
}
const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

function routeFetch(routes: Record<string, () => Promise<unknown>>) {
  fetchMock.mockImplementation((url: string) => {
    const key = Object.keys(routes).find((suffix) => url.endsWith(suffix))
    return key ? routes[key]() : Promise.reject(new Error(`rota inesperada ${url}`))
  })
}

function seedCache(manifest: Record<string, unknown> = {}, data: unknown = fixture) {
  mockCache.set('cmedIndex', {
    manifest: { ...remoteManifest, cachedAt: '2026-10-13T11:00:00.000Z', ...manifest },
    data,
  })
}

const render = (opts = {}) => renderHook(() => useCmedIndex({ baseUrl: BASE, ...opts }))

describe('useCmedIndex — carga sob demanda do índice CMED (FR-023)', () => {
  beforeEach(() => {
    mockCache.clear()
    mockWriteFail.on = false
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('enabled=false: idle e nenhum I/O', async () => {
    const { result } = render({ enabled: false })
    expect(result.current.status).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('desabilitar depois de pronto solta o índice (idle)', async () => {
    seedCache()
    routeFetch({ 'manifest.json': () => ok(remoteManifest) })
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useCmedIndex({ baseUrl: BASE, enabled }),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ enabled: false })
    expect(result.current).toEqual({ status: 'idle', index: null, lookup: null })
  })

  it('sem cache: preparing → baixa, grava em disco, ready com lookup', async () => {
    routeFetch({ 'manifest.json': () => ok(remoteManifest), 'cmedIndex.json': () => ok(fixture) })
    const { result } = render()
    expect(result.current.status).toBe('preparing')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.index?.n).toBe((fixture as { n: number }).n)
    expect(result.current.lookup?.size).toBeGreaterThan(0)
    expect(mockCache.get('cmedIndex')?.manifest).toMatchObject({ version: '1.1.11', cachedAt: '2026-10-13T12:00:00.000Z' })
  })

  it('cache fresco e mesma versão: ready sem baixar o índice', async () => {
    seedCache()
    routeFetch({ 'manifest.json': () => ok(remoteManifest) })
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('cache presente + rede cai: ready com o cache', async () => {
    seedCache()
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('sem cache + rede cai: offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.index).toBeNull()
  })

  it('sem cache + HTTP 404: failed', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('failed'))
  })

  it('v desconhecido: version', async () => {
    routeFetch({ 'manifest.json': () => ok(remoteManifest), 'cmedIndex.json': () => ok({ ...fixture, v: 2 }) })
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('version'))
  })

  it('shape inválido: failed', async () => {
    routeFetch({ 'manifest.json': () => ok(remoteManifest), 'cmedIndex.json': () => ok({ v: 1 }) })
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('failed'))
  })

  it('cache com v desconhecido + rede cai: version (não offline)', async () => {
    seedCache({}, { ...fixture, v: 2 })
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('version'))
  })

  it('versão remota nova: troca o índice', async () => {
    seedCache({ version: '1.1.10' })
    routeFetch({ 'manifest.json': () => ok(remoteManifest), 'cmedIndex.json': () => ok(fixture) })
    const { result } = render()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockCache.get('cmedIndex')?.manifest).toMatchObject({ version: '1.1.11' }))
    expect(result.current.status).toBe('ready')
  })

  it('gravação em disco falha: segue ready com o dado em memória', async () => {
    mockWriteFail.on = true
    routeFetch({ 'manifest.json': () => ok(remoteManifest), 'cmedIndex.json': () => ok(fixture) })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    warn.mockRestore()
  })

  it('desmontar no meio da carga não atualiza estado', async () => {
    let release: (v: unknown) => void = () => {}
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render()
    unmount()
    release({ ok: true, json: () => Promise.resolve(remoteManifest) })
    await new Promise((r) => setImmediate(r))
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
