// useStockTracking.test.tsx — escada de 3 degraus (055-W1.7): remoto → cache → default ATIVO.
// Foco no degrau negativo, que é o ponto do PR: cache diz `false` + rede falha ⇒ NÃO reativa.
import { renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StockTrackingProvider, useStockTracking } from '../useStockTracking'

jest.mock('@dosiq/core', () => {
  const getStockTracking = jest.fn()
  return { __esModule: true, createProfileRepository: () => ({ getStockTracking }), __getStockTracking: getStockTracking }
})
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) } },
}))

const { __getStockTracking: mockGetStockTracking } = jest.requireMock('@dosiq/core') as { __getStockTracking: jest.Mock }
const mockedGetItem = AsyncStorage.getItem as jest.Mock

function wrapper({ children }: { children: React.ReactNode }) {
  return <StockTrackingProvider session={{ user: { id: 'user-1' } }}>{children}</StockTrackingProvider>
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('useStockTracking — escada de 3 degraus', () => {
  it('degrau 1: remoto OK → usa remoto e cacheia', async () => {
    mockedGetItem.mockResolvedValue(null)
    mockGetStockTracking.mockResolvedValueOnce({ stock_tracking_enabled: false, stock_paused_at: '2026-07-01T00:00:00Z' })

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.enabled).toBe(false)
    expect(result.current.pausedAt).toBe('2026-07-01T00:00:00Z')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@dosiq/stock-tracking-pref',
      JSON.stringify({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' }),
    )
  })

  it('degrau 2: remoto falha, HÁ cache → usa o cache (preserva decisão explícita)', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ enabled: false, pausedAt: '2026-07-01T00:00:00Z' }))
    mockGetStockTracking.mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.enabled).toBe(false)
    expect(result.current.pausedAt).toBe('2026-07-01T00:00:00Z')
  })

  it('degrau 3: remoto falha, SEM cache → default ATIVO (fail-safe AP-277)', async () => {
    mockedGetItem.mockResolvedValue(null)
    mockGetStockTracking.mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.enabled).toBe(true)
    expect(result.current.pausedAt).toBeNull()
  })

  it('NEGATIVO (ponto do PR): cache diz false + rede falha ⇒ aba Estoque NÃO reaparece', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ enabled: false, pausedAt: null }))
    mockGetStockTracking.mockRejectedValueOnce(new Error('offline'))

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.enabled).toBe(false)
  })

  it('rede sempre vence o cache quando resolve (AP-284): cache diz false, remoto diz true', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ enabled: false, pausedAt: null }))
    mockGetStockTracking.mockResolvedValueOnce({ stock_tracking_enabled: true, stock_paused_at: null })

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => {
      expect(result.current.enabled).toBe(true)
      expect(result.current.ready).toBe(true)
    })
  })

  it('ready não espera rede quando há cache (tab bar monta na hora, offline)', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ enabled: false, pausedAt: null }))
    let resolveRemote: (v: unknown) => void = () => {}
    mockGetStockTracking.mockReturnValueOnce(new Promise((resolve) => { resolveRemote = resolve }))

    const { result } = renderHook(() => useStockTracking(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.enabled).toBe(false)

    resolveRemote({ stock_tracking_enabled: true, stock_paused_at: null })
  })
})
