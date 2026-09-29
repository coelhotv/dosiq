// 086 RC3 E-3 / FR-022 — trava tri-estado: `settled` com a resposta ou no teto de 1,5 s; resposta
// tardia NÃO muda a tela já desenhada, vale no próximo foco.
import { renderHook, act } from '@testing-library/react-native'

let mockFocus = () => {}
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react')
  return {
    // Dublê: cada chamada de mockFocus() simula a tela ganhando foco de novo (cleanup + efeito).
    useFocusEffect: (cb) => {
      const [n, setN] = React.useState(0)
      mockFocus = () => setN((x) => x + 1)
      React.useEffect(cb, [cb, n])
    },
  }
})

const mockFetch = jest.fn()
jest.mock('@dosiq/core', () => ({ fetchIntervalCadenceAvailability: (...a) => mockFetch(...a) }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) } },
}))

import { useIntervalCadenceAvailability, CADENCE_GATE_TIMEOUT_MS } from '../useIntervalCadenceAvailability'

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('useIntervalCadenceAvailability (086)', () => {
  it('começa não resolvida; resposta dentro do teto ⇒ settled com o valor', async () => {
    mockFetch.mockResolvedValue(true)
    const { result } = renderHook(() => useIntervalCadenceAvailability())
    expect(result.current).toEqual({ available: false, settled: false })
    await act(async () => {})
    expect(result.current).toEqual({ available: true, settled: true })
  })

  it('erro ⇒ lado seguro (false), settled', async () => {
    mockFetch.mockRejectedValue(new Error('rede'))
    const { result } = renderHook(() => useIntervalCadenceAvailability())
    await act(async () => {})
    expect(result.current).toEqual({ available: false, settled: true })
  })

  it('teto de 1,5 s ⇒ settled sem a opção; resposta tardia só vale no próximo foco', async () => {
    const d = deferred()
    mockFetch.mockReturnValueOnce(d.promise).mockResolvedValue(true)
    const { result } = renderHook(() => useIntervalCadenceAvailability())
    await act(async () => { jest.advanceTimersByTime(CADENCE_GATE_TIMEOUT_MS) })
    expect(result.current).toEqual({ available: false, settled: true })

    await act(async () => { d.resolve(true) })
    expect(result.current).toEqual({ available: false, settled: true }) // sem salto com a tela desenhada

    await act(async () => { mockFocus() })
    expect(result.current).toEqual({ available: true, settled: true })
  })

  it('reconsulta ao ganhar foco', async () => {
    mockFetch.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const { result } = renderHook(() => useIntervalCadenceAvailability())
    await act(async () => {})
    expect(result.current.available).toBe(false)
    await act(async () => { mockFocus() })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.current.available).toBe(true)
  })
})
