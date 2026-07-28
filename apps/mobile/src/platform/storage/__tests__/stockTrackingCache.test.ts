import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  readStockTrackingCache,
  writeStockTrackingCache,
  clearStockTrackingCache,
  STOCK_TRACKING_CACHE_KEY,
} from '../stockTrackingCache'

const mockedGetItem = AsyncStorage.getItem as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

describe('stockTrackingCache', () => {
  it('lê null quando não há valor persistido', async () => {
    mockedGetItem.mockResolvedValueOnce(null)
    expect(await readStockTrackingCache()).toBeNull()
  })

  it('persiste e lê enabled+pausedAt', async () => {
    await writeStockTrackingCache({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STOCK_TRACKING_CACHE_KEY,
      JSON.stringify({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' }),
    )

    mockedGetItem.mockResolvedValueOnce(JSON.stringify({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' }))
    expect(await readStockTrackingCache()).toEqual({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' })
  })

  it('null → falha de leitura (fail-safe do degrau 3 fica a cargo do hook)', async () => {
    mockedGetItem.mockRejectedValueOnce(new Error('boom'))
    expect(await readStockTrackingCache()).toBeNull()
  })

  it('JSON corrompido → null', async () => {
    mockedGetItem.mockResolvedValueOnce('{not json')
    expect(await readStockTrackingCache()).toBeNull()
  })

  it('shape inválido (enabled ausente) → null', async () => {
    mockedGetItem.mockResolvedValueOnce(JSON.stringify({ pausedAt: null }))
    expect(await readStockTrackingCache()).toBeNull()
  })

  it('clear remove a chave (invalidação no logout)', async () => {
    await clearStockTrackingCache()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STOCK_TRACKING_CACHE_KEY)
  })

  it('escrita falha → best-effort, não lança', async () => {
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'))
    await expect(writeStockTrackingCache({ enabled: true, pausedAt: null })).resolves.toBeUndefined()
  })
})
