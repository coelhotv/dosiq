// useTreatmentMeasureSeries — carregando/erro/dados, corrida por reqId e `measure_series_viewed`
// 1× por foco e reemitido após salvar só se o estado mudou (069 Bb · PO-7/PO-21 · RC3 E-B4/E-B5).
import { renderHook, act, waitFor } from '@testing-library/react-native'

let mockFocus = () => {}
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react')
  return {
    useFocusEffect: (cb) => {
      const [n, setN] = React.useState(0)
      mockFocus = () => setN((x) => x + 1)
      React.useEffect(cb, [cb, n])
    },
  }
})

const mockLoad = jest.fn()
jest.mock('../../services/treatmentMeasureService', () => ({
  loadTreatmentMeasureSeries: (...a) => mockLoad(...a),
}))

const mockLog = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a) => mockLog(...a) }))

import { useTreatmentMeasureSeries } from '../useTreatmentMeasureSeries'

const PROTO = { id: 'p1', medicine_id: 'm1', frequency: 'semanal', intake_unit: 'mg', dosage_per_intake: 5, start_date: '2026-09-01' }

const result = (state, steps = 1) => ({
  state,
  series: { points: [], steps: Array.from({ length: steps }, (_, i) => ({ index: i + 1 })), firstDay: null, lastDay: null },
  hasLadder: steps > 1,
  today: '2026-10-05',
  timezone: 'America/Sao_Paulo',
})

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

const viewed = () => mockLog.mock.calls.filter((c) => c[0] === 'measure_series_viewed').map((c) => c[1])

describe('useTreatmentMeasureSeries', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('carregando sem evento; dados emitem viewed com o estado final', async () => {
    const d = deferred()
    mockLoad.mockReturnValueOnce(d.promise)
    const { result: h } = renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    expect(h.current.loading).toBe(true)
    expect(viewed()).toEqual([])
    await act(async () => d.resolve(result('B0', 3)))
    expect(h.current.data?.state).toBe('B0')
    expect(viewed()).toEqual([
      { biomarker_type: 'peso', state: 'chart', step_count: 3, treatment_id: 'p1', surface: 'mobile' },
    ])
  })

  it('erro de rede (objeto plano do PostgREST) ⇒ network; outro ⇒ other; viewed state error', async () => {
    mockLoad.mockRejectedValueOnce({ message: 'TypeError: Network request failed', code: '' })
    const { result: h } = renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    await waitFor(() => expect(h.current.error).toBe('network'))
    mockLoad.mockRejectedValueOnce({ message: 'boom', code: 'PGRST301' })
    await act(async () => { await h.current.retry() })
    expect(h.current.error).toBe('other')
    expect(viewed().map((v) => v.state)).toEqual(['error', 'error'])
  })

  it('1× por foco: novo foco reemite', async () => {
    mockLoad.mockResolvedValue(result('B3'))
    renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    await waitFor(() => expect(viewed()).toHaveLength(1))
    await act(async () => { mockFocus() })
    await waitFor(() => expect(viewed()).toHaveLength(2))
  })

  it('após salvar: reemite só quando o estado muda (E-B5)', async () => {
    mockLoad.mockResolvedValueOnce(result('B3'))
    const { result: h } = renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    await waitFor(() => expect(viewed()).toHaveLength(1))
    mockLoad.mockResolvedValueOnce(result('B3'))
    await act(async () => { await h.current.refreshAfterSave() })
    expect(viewed()).toHaveLength(1)
    mockLoad.mockResolvedValueOnce(result('B2'))
    await act(async () => { await h.current.refreshAfterSave() })
    expect(viewed().map((v) => v.state)).toEqual(['missing_both', 'missing_time'])
  })

  it('resposta velha chegando depois é descartada (reqId)', async () => {
    const old = deferred()
    mockLoad.mockReturnValueOnce(old.promise).mockResolvedValueOnce(result('B0', 2))
    const { result: h } = renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    await act(async () => { await h.current.retry() })
    await act(async () => old.resolve(result('B3')))
    expect(h.current.data?.state).toBe('B0')
    expect(viewed().map((v) => v.state)).toEqual(['chart'])
  })

  it('não elegível (null): sem dados e sem evento', async () => {
    mockLoad.mockResolvedValueOnce(null)
    const { result: h } = renderHook(() => useTreatmentMeasureSeries(PROTO as any))
    await waitFor(() => expect(h.current.loading).toBe(false))
    expect(h.current.data).toBeNull()
    expect(viewed()).toEqual([])
  })
})
