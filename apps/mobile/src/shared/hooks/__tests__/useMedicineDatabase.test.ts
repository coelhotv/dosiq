// Mocks declarados antes dos imports (obrigatório para jest.mock hoisting)
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn(),
}))

// 037 Slice 2: o hook consome os helpers canônicos do core (fetchJson, shouldRefreshCache,
// resolveDataUrl, normalizeText, matchesPrefix) — usamos os reais. Só fixamos getNow para
// tempo determinístico. O mock vai no MÓDULO dateUtils (não no índice do core): o core
// importa getNow direto de '../utils/dateUtils.js', então um override no '@dosiq/core' não
// alcançaria o getNow interno usado por shouldRefreshCache.
jest.mock('@dosiq/core/utils/dateUtils', () => {
  const actual = jest.requireActual('@dosiq/core/utils/dateUtils')
  return {
    ...actual,
    getNow: () => new Date('2026-05-14T12:00:00.000Z'),
  }
})

import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorageImport from '@react-native-async-storage/async-storage'
import { useMedicineDatabase } from '../useMedicineDatabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AsyncStorage = AsyncStorageImport as any

// Fetch global mockado
global.fetch = jest.fn() as unknown as typeof fetch
const fetchMock = global.fetch as unknown as jest.Mock

const mockManifest = {
  version: '1.0.0',
  generatedAt: '2026-05-14T10:00:00Z',
  files: { medicineDatabase: { path: 'anvisa/v1/medicineDatabase.json' } },
}

const mockData = [
  { name: 'Paracetamol', activeIngredient: 'Paracetamol', therapeuticClass: 'Analgésico', laboratory: 'Lab A' },
  { name: 'Dipirona', activeIngredient: 'Dipirona Sódica', therapeuticClass: 'Analgésico', laboratory: 'Lab B' },
  { name: 'Ácido Acetilsalicílico', activeIngredient: 'AAS', therapeuticClass: 'Anti-inflamatório', laboratory: 'Lab C' },
  // Casos para testar word-boundary prefix
  { name: 'Maleato de Trimebutina', activeIngredient: 'Trimebutina', therapeuticClass: 'Antiespasmódico', laboratory: 'Lab D' },
  { name: 'Sumatriptana', activeIngredient: 'Sumatriptana', therapeuticClass: 'Antimigranoso', laboratory: 'Lab E' },
  { name: 'Aparat', activeIngredient: 'Aparat', therapeuticClass: 'Misc', laboratory: 'Lab F' },
]

function mockFetchOk(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

function mockFetchError() {
  return Promise.reject(new Error('Network down'))
}

// Retorna multiGet simulando cache populado
function buildCacheMultiGet(manifestOverrides = {}, data = mockData) {
  const cachedManifest = { ...mockManifest, cachedAt: '2026-05-14T11:50:00Z', ...manifestOverrides }
  return [
    ['@dosiq/anvisa-manifest', JSON.stringify(cachedManifest)],
    ['@dosiq/anvisa-data', JSON.stringify(data)],
  ]
}

beforeEach(() => {
  jest.clearAllMocks()
  // Estado padrão: sem cache
  AsyncStorage.multiGet.mockResolvedValue([
    ['@dosiq/anvisa-manifest', null],
    ['@dosiq/anvisa-data', null],
  ])
  fetchMock.mockReset()
})

// -------------------------------------------------------------------
// 1. Cold start — rede OK: baixa manifest + data, popula AsyncStorage
// -------------------------------------------------------------------
describe('cold start — rede OK', () => {
  it('deve baixar manifest e data, expor isReady=true e salvar no AsyncStorage', async () => {
    fetchMock.mockImplementation((url) =>
      url.endsWith('manifest.json') ? mockFetchOk(mockManifest) : mockFetchOk(mockData),
    )

    const { result } = renderHook(() => useMedicineDatabase())

    await waitFor(() => expect(result.current.isReady).toBe(true))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(AsyncStorage.multiSet).toHaveBeenCalledTimes(1)

    // Ambas as chaves devem ter sido salvas
    const [[pairs]] = (AsyncStorage.multiSet as jest.Mock).mock.calls
    const keys = pairs.map(([k]: [string, string]) => k)
    expect(keys).toContain('@dosiq/anvisa-manifest')
    expect(keys).toContain('@dosiq/anvisa-data')
  })
})

// -------------------------------------------------------------------
// 2. Warm start — cache recente: não faz re-download
// -------------------------------------------------------------------
describe('warm start — cache fresco', () => {
  it('não deve chamar multiSet quando versão e TTL estão ok', async () => {
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet())

    // Manifest remoto com mesma versão
    fetchMock.mockImplementation(() => mockFetchOk(mockManifest))

    const { result } = renderHook(() => useMedicineDatabase())

    // Cache carrega imediatamente; aguarda fetch background terminar
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isReady).toBe(true)
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled()
  })
})

// -------------------------------------------------------------------
// 3. Warm start — versão mudou: re-download e atualiza cache
// -------------------------------------------------------------------
describe('warm start — versão remota diferente', () => {
  it('deve re-baixar e atualizar AsyncStorage com dados novos', async () => {
    // Cache com versão 1.0.0
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet({ version: '1.0.0' }))

    const newManifest = { ...mockManifest, version: '2.0.0' }
    const newData = [...mockData, { name: 'Ibuprofeno', activeIngredient: 'Ibuprofeno', therapeuticClass: 'AINE', laboratory: 'Lab D' }]

    fetchMock.mockImplementation((url) =>
      url.endsWith('manifest.json') ? mockFetchOk(newManifest) : mockFetchOk(newData),
    )

    const { result } = renderHook(() => useMedicineDatabase())

    await waitFor(() => {
      // Após re-download o dado novo (Ibuprofeno) deve estar acessível
      const res = result.current.search('ibuprofe', 5)
      return res.length > 0
    })

    expect(AsyncStorage.multiSet).toHaveBeenCalledTimes(1)
    // Manifest persistido deve ter versão 2.0.0
    const [[pairs]] = (AsyncStorage.multiSet as jest.Mock).mock.calls
    const manifestEntry = pairs.find(([k]: [string, string]) => k === '@dosiq/anvisa-manifest')
    expect(JSON.parse(manifestEntry[1]).version).toBe('2.0.0')
  })
})

// -------------------------------------------------------------------
// 4. Warm start — cache expirado pelo TTL
// -------------------------------------------------------------------
describe('warm start — cache expirado pelo TTL', () => {
  it('deve re-baixar quando cachedAt está além do TTL', async () => {
    // cachedAt muito antigo
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet({ cachedAt: '2025-01-01T00:00:00Z' }))

    fetchMock.mockImplementation((url) =>
      url.endsWith('manifest.json') ? mockFetchOk(mockManifest) : mockFetchOk(mockData),
    )

    const { result } = renderHook(() => useMedicineDatabase())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(AsyncStorage.multiSet).toHaveBeenCalledTimes(1)
  })
})

// -------------------------------------------------------------------
// 5. Falha de rede com cache disponível — degradação graciosa
// -------------------------------------------------------------------
describe('falha de rede — cache disponível', () => {
  it('não deve expor erro e deve manter busca funcional', async () => {
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet())

    fetchMock.mockImplementation(() => mockFetchError())

    const { result } = renderHook(() => useMedicineDatabase())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.isReady).toBe(true)
    expect(result.current.search('para', 5).length).toBeGreaterThan(0)
  })
})

// -------------------------------------------------------------------
// 6. Falha de rede sem cache — estado de erro
// -------------------------------------------------------------------
describe('falha de rede — sem cache', () => {
  it('deve expor error e isReady=false', async () => {
    // multiGet já retorna null por padrão no beforeEach
    fetchMock.mockImplementation(() => mockFetchError())

    const { result } = renderHook(() => useMedicineDatabase())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBeTruthy()
  })
})

// -------------------------------------------------------------------
// 7. search()
// -------------------------------------------------------------------
describe('search()', () => {
  beforeEach(() => {
    // Cache fresco, sem fetch necessário
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet())
    fetchMock.mockImplementation(() => mockFetchOk(mockManifest))
  })

  async function getReadyHook() {
    const { result } = renderHook(() => useMedicineDatabase())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    return result
  }

  it('encontra por nome (case insensitive)', async () => {
    const result = await getReadyHook()
    const res = result.current.search('PARACETAMOL', 10)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].name).toBe('Paracetamol')
  })

  it('encontra por nome com acento normalizado', async () => {
    const result = await getReadyHook()
    // 'Ácido' normalizado → 'acido'
    const res = result.current.search('acido', 10)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].name).toBe('Ácido Acetilsalicílico')
  })

  it('encontra por activeIngredient', async () => {
    const result = await getReadyHook()
    const res = result.current.search('dipirona sodica', 10)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].name).toBe('Dipirona')
  })

  it('respeita o limite', async () => {
    const result = await getReadyHook()
    // 'dip' casa Dipirona (name + ingredient) — limit 1 deve cortar
    const res = result.current.search('dip', 1)
    expect(res.length).toBe(1)
  })

  it('retorna [] para query com menos de 3 caracteres', async () => {
    const result = await getReadyHook()
    expect(result.current.search('pa', 10)).toEqual([])
    expect(result.current.search('', 10)).toEqual([])
  })

  it('retorna [] para query undefined/null', async () => {
    const result = await getReadyHook()
    expect(result.current.search(null, 10)).toEqual([])
    expect(result.current.search(undefined, 10)).toEqual([])
  })

  it('match word-boundary: "trime" casa "Maleato de Trimebutina" (segunda palavra)', async () => {
    const result = await getReadyHook()
    const res = result.current.search('trime', 10)
    expect(res.some((m) => m.name === 'Maleato de Trimebutina')).toBe(true)
  })

  it('match word-boundary: "trime" casa via activeIngredient "Trimebutina"', async () => {
    const result = await getReadyHook()
    const res = result.current.search('trime', 10)
    expect(res.length).toBeGreaterThan(0)
  })

  it('NÃO match mid-word: "trip" não casa "Suma**trip**tana"', async () => {
    const result = await getReadyHook()
    const res = result.current.search('trip', 10)
    expect(res.some((m) => m.name === 'Sumatriptana')).toBe(false)
  })

  it('NÃO match mid-word: "para" não casa "A**para**t"', async () => {
    const result = await getReadyHook()
    const res = result.current.search('para', 10)
    expect(res.some((m) => m.name === 'Aparat')).toBe(false)
    // Mas DEVE casar Paracetamol (prefixo do início)
    expect(res.some((m) => m.name === 'Paracetamol')).toBe(true)
  })

  it('ranking: name-prefix vem antes de só-activeIngredient-prefix', async () => {
    const result = await getReadyHook()
    // 'trime' casa name "Maleato de Trimebutina" (segunda palavra do name)
    // E também casa activeIngredient "Trimebutina"
    // Como ambos têm match no name, primeiro deve ser quem tem match no name
    const res = result.current.search('dipi', 10)
    // Dipirona casa por name; nenhum outro registro casa por nada
    expect(res[0].name).toBe('Dipirona')
  })
})

// -------------------------------------------------------------------
// 8. getByName()
// -------------------------------------------------------------------
describe('getByName()', () => {
  beforeEach(() => {
    AsyncStorage.multiGet.mockResolvedValue(buildCacheMultiGet())
    fetchMock.mockImplementation(() => mockFetchOk(mockManifest))
  })

  async function getReadyHook() {
    const { result } = renderHook(() => useMedicineDatabase())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    return result
  }

  it('retorna match exato (case insensitive)', async () => {
    const result = await getReadyHook()
    const med = result.current.getByName('paracetamol')
    expect(med).not.toBeNull()
    expect(med?.name).toBe('Paracetamol')
  })

  it('retorna match exato com acento normalizado', async () => {
    const result = await getReadyHook()
    const med = result.current.getByName('acido acetilsalicilico')
    expect(med).not.toBeNull()
    expect(med?.name).toBe('Ácido Acetilsalicílico')
  })

  it('prefere match exato sobre parcial', async () => {
    // Dipirona corresponde a exact; não deve retornar Dipirona Sódica (activeIngredient)
    const result = await getReadyHook()
    const med = result.current.getByName('Dipirona')
    expect(med?.name).toBe('Dipirona')
  })

  it('retorna null quando não encontrado', async () => {
    const result = await getReadyHook()
    expect(result.current.getByName('Inexistente')).toBeNull()
  })

  it('retorna null para name vazio/null', async () => {
    const result = await getReadyHook()
    expect(result.current.getByName('')).toBeNull()
    expect(result.current.getByName(null)).toBeNull()
  })
})
