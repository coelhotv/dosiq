// useStockUpsell — visibilidade (ready + !enabled + gatilho elegível + não dispensado),
// dismiss persistente (sem re-nag) e tracking único de "shown" (spec 044, F4b / T020).
//
// `hasTrackedShownThisSession` é guarda de MÓDULO (não de teste) — cada teste faz
// `vi.resetModules()` + `import()` dinâmico para isolar essa flag entre casos.

import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  useStockTracking: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  evaluateStockUpsell: vi.fn(),
  trackStockUpsellShown: vi.fn(),
  trackStockUpsellDismissed: vi.fn(),
  useDashboard: vi.fn(),
}))

vi.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: mocks.useStockTracking,
}))

vi.mock('@shared/platform/storage/webStorageAdapter', () => ({
  webStorageAdapter: { getItem: mocks.getItem, setItem: mocks.setItem },
}))

vi.mock('@dosiq/core', () => ({
  evaluateStockUpsell: mocks.evaluateStockUpsell,
}))

vi.mock('@utils/dateUtils', () => ({
  formatLocalDate: (d: unknown) => String(d),
  getUserTime: (d: unknown) => d,
  parseISO: (s: string) => s,
  getTodayLocal: () => '2026-07-12',
}))

vi.mock('@features/settings/services/stockPreferenceService', () => ({
  trackStockUpsellShown: mocks.trackStockUpsellShown,
  trackStockUpsellDismissed: mocks.trackStockUpsellDismissed,
}))

vi.mock('../useDashboardContext', () => ({
  useDashboard: mocks.useDashboard,
}))

const ELIGIBLE = { eligible: true, doses: 21, streakDays: 3 }
const NOT_ELIGIBLE = { eligible: false, doses: 1, streakDays: 1 }

async function importHook() {
  const mod = await import('../useStockUpsell')
  return mod.useStockUpsell
}

describe('useStockUpsell', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.useDashboard.mockReturnValue({ logs: [], timezone: 'America/Sao_Paulo' })
    mocks.evaluateStockUpsell.mockReturnValue(ELIGIBLE)
    mocks.getItem.mockResolvedValue(null)
    mocks.setItem.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('não fica visível enquanto ready é false (não pisca)', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: false, ready: false })
    const useStockUpsell = await importHook()

    const { result } = renderHook(() => useStockUpsell())

    // Mesmo depois do storage resolver, ready=false trava o card fechado.
    await waitFor(() => expect(mocks.getItem).toHaveBeenCalled())
    expect(result.current.visible).toBe(false)
  })

  it('fica visível só com ready=true E enabled=false E gatilho elegível E não dispensado', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: false, ready: true })
    const useStockUpsell = await importHook()

    const { result } = renderHook(() => useStockUpsell())

    await waitFor(() => expect(result.current.visible).toBe(true))
  })

  it('não aparece se o estoque já está enabled', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: true, ready: true })
    const useStockUpsell = await importHook()

    const { result } = renderHook(() => useStockUpsell())

    await waitFor(() => expect(mocks.getItem).toHaveBeenCalled())
    expect(result.current.visible).toBe(false)
  })

  it('não aparece se o gatilho não é elegível', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: false, ready: true })
    mocks.evaluateStockUpsell.mockReturnValue(NOT_ELIGIBLE)
    const useStockUpsell = await importHook()

    const { result } = renderHook(() => useStockUpsell())

    await waitFor(() => expect(mocks.getItem).toHaveBeenCalled())
    expect(result.current.visible).toBe(false)
  })

  it('"Agora não" persiste o dismiss no storage e o card não volta numa nova montagem', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: false, ready: true })
    const useStockUpsell = await importHook()

    const { result, unmount } = renderHook(() => useStockUpsell())
    await waitFor(() => expect(result.current.visible).toBe(true))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.visible).toBe(false)
    expect(mocks.setItem).toHaveBeenCalledWith('dosiq:stock-upsell-dismissed', '1')
    expect(mocks.trackStockUpsellDismissed).toHaveBeenCalledTimes(1)

    unmount()

    // Nova montagem: storage agora "lembra" do dismiss (lê de volta o que foi gravado).
    mocks.getItem.mockResolvedValue('1')
    const { result: remounted } = renderHook(() => useStockUpsell())

    await waitFor(() => expect(mocks.getItem).toHaveBeenCalledTimes(2))
    expect(remounted.current.visible).toBe(false)
  })

  it('trackStockUpsellShown dispara UMA única vez mesmo remontando o hook', async () => {
    mocks.useStockTracking.mockReturnValue({ enabled: false, ready: true })
    const useStockUpsell = await importHook()

    const { result, unmount } = renderHook(() => useStockUpsell())
    await waitFor(() => expect(result.current.visible).toBe(true))
    expect(mocks.trackStockUpsellShown).toHaveBeenCalledTimes(1)

    unmount()
    const { result: remounted } = renderHook(() => useStockUpsell())
    await waitFor(() => expect(remounted.current.visible).toBe(true))

    expect(mocks.trackStockUpsellShown).toHaveBeenCalledTimes(1)
  })
})
