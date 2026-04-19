import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useComplexityMode } from '../useComplexityMode'

// Mock do useDashboard — injetamos dados via factory
const mockUseDashboard = vi.fn()

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: () => mockUseDashboard(),
}))

// Helpers
function makeProtocols(medicineIds) {
  return medicineIds.map((id) => ({ id: `p-${id}`, medicine_id: id, active: true }))
}

function makeMedicines(ids) {
  return ids.map((id) => ({ id, name: `Med ${id}` }))
}

function setup(medicineCount) {
  const ids = Array.from({ length: medicineCount }, (_, i) => `m${i + 1}`)
  mockUseDashboard.mockReturnValue({
    medicines: makeMedicines(ids),
    protocols: makeProtocols(ids),
  })
}

describe('useComplexityMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('retorna simple para 0-3 meds', () => {
    setup(3)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.mode).toBe('simple')
  })

  it('retorna moderate para 4-6 meds', () => {
    setup(5)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.mode).toBe('moderate')
  })

  it('retorna complex para 7+ meds', () => {
    setup(8)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.mode).toBe('complex')
  })

  it('ringGaugeSize corresponde ao mode (simple → large)', () => {
    setup(2)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.ringGaugeSize).toBe('large')
  })

  it('ringGaugeSize corresponde ao mode (moderate → medium)', () => {
    setup(5)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.ringGaugeSize).toBe('medium')
  })

  it('ringGaugeSize corresponde ao mode (complex → compact)', () => {
    setup(10)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.ringGaugeSize).toBe('compact')
  })

  it('defaultViewMode é plan para complex', () => {
    setup(9)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.defaultViewMode).toBe('plan')
  })

  it('defaultViewMode é time para simple e moderate', () => {
    setup(1)
    const { result: r1 } = renderHook(() => useComplexityMode())
    expect(r1.current.defaultViewMode).toBe('time')

    setup(4)
    const { result: r2 } = renderHook(() => useComplexityMode())
    expect(r2.current.defaultViewMode).toBe('time')
  })

  it('override via setOverride sobrescreve auto-detection', () => {
    setup(2) // auto = simple
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.mode).toBe('simple')

    act(() => {
      result.current.setOverride('complex')
    })

    expect(result.current.mode).toBe('complex')
    expect(result.current.overrideMode).toBe('complex')
  })

  it('setOverride(null) limpa override e volta para auto-detection', () => {
    setup(2) // auto = simple
    const { result } = renderHook(() => useComplexityMode())

    act(() => {
      result.current.setOverride('complex')
    })
    expect(result.current.mode).toBe('complex')

    act(() => {
      result.current.setOverride(null)
    })
    expect(result.current.mode).toBe('simple')
    expect(result.current.overrideMode).toBeNull()
  })

  it('medicineCount reflete quantidade de meds ativos', () => {
    setup(6)
    const { result } = renderHook(() => useComplexityMode())
    expect(result.current.medicineCount).toBe(6)
  })

  it('ignora protocolos inativos ao contar meds', () => {
    mockUseDashboard.mockReturnValue({
      medicines: makeMedicines(['m1', 'm2', 'm3', 'm4', 'm5']),
      protocols: [
        { id: 'p1', medicine_id: 'm1', active: true },
        { id: 'p2', medicine_id: 'm2', active: false }, // inativo
        { id: 'p3', medicine_id: 'm3', active: true },
      ],
    })
    const { result } = renderHook(() => useComplexityMode())
    // Apenas m1 e m3 têm protocolos ativos
    expect(result.current.medicineCount).toBe(2)
    expect(result.current.mode).toBe('simple')
  })
})
