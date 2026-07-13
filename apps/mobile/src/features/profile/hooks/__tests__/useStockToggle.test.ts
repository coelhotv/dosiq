// useStockToggle.test.ts — invariantes F4b (neverHadStock -> needsInitialBalance sem escrita)
// e regressão do fluxo F4a (assess -> resume/reconcile) intacto (spec 044, T020).
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook, waitFor, act } from '@testing-library/react-native'
import { useStockToggle as useStockToggleImport } from '../useStockToggle'
import {
  disableStockTracking as disableStockTrackingImport,
  resumeStockAsIs as resumeStockAsIsImport,
  resumeStockAndZero as resumeStockAndZeroImport,
  assessStockResume as assessStockResumeImport,
} from '@profile/services/stockPreferenceService'
import { useStockTracking as useStockTrackingImport } from '@shared/hooks/useStockTracking'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStockToggle = useStockToggleImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const disableStockTracking = disableStockTrackingImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resumeStockAsIs = resumeStockAsIsImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resumeStockAndZero = resumeStockAndZeroImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assessStockResume = assessStockResumeImport as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStockTracking = useStockTrackingImport as any

jest.mock('@profile/services/stockPreferenceService', () => ({
  disableStockTracking: jest.fn(),
  resumeStockAsIs: jest.fn(),
  resumeStockAndZero: jest.fn(),
  assessStockResume: jest.fn(),
}))

jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: jest.fn(),
}))

describe('useStockToggle', () => {
  const refresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    refresh.mockResolvedValue(undefined)
  })

  it('neverHadStock (off + sem stock_paused_at): ligar NÃO escreve nada e sinaliza needsInitialBalance', async () => {
    useStockTracking.mockReturnValue({ enabled: false, pausedAt: null, ready: true, refresh })

    const { result } = renderHook(() => useStockToggle())
    expect(result.current.neverHadStock).toBe(true)

    act(() => {
      result.current.requestToggle()
    })

    expect(result.current.needsInitialBalance).toBe(true)
    expect(result.current.sheet).toBe(null)
    expect(assessStockResume).not.toHaveBeenCalled()
    expect(resumeStockAsIs).not.toHaveBeenCalled()
    expect(disableStockTracking).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  // Regressão do smoke da F4b: conta que nasceu dose-only ganhava carimbo indevido (o
  // onboarding chamava setStockTracking(false), que congela) → o toggle a tratava como
  // "congelada", retomava em silêncio (gap de minutos) e a tela de saldo inicial NUNCA aparecia.
  // Raiz corrigida no core (freeze:false); este é o cinto de segurança na UI.
  it('carimbo SEM saldo por trás: pede saldo inicial em vez de retomar sobre zero', async () => {
    useStockTracking.mockReturnValue({
      enabled: false,
      pausedAt: '2026-07-12T23:29:00Z',
      ready: true,
      refresh,
    })
    assessStockResume.mockResolvedValue({
      needsReconciliation: false,
      gapDays: 0,
      pausedAt: '2026-07-12T23:29:00Z',
      hasFrozenBalance: false,
    })

    const { result } = renderHook(() => useStockToggle())

    await act(async () => {
      result.current.requestToggle()
      await waitFor(() => expect(assessStockResume).toHaveBeenCalledTimes(1))
    })

    await waitFor(() => expect(result.current.needsInitialBalance).toBe(true))
    expect(resumeStockAsIs).not.toHaveBeenCalled()
    expect(result.current.sheet).toBe(null)
  })

  it('usuário com stock_paused_at (gap curto): mantém fluxo F4a — resume as-is silencioso', async () => {
    useStockTracking.mockReturnValue({
      enabled: false,
      pausedAt: '2026-07-01T10:00:00Z',
      ready: true,
      refresh,
    })
    assessStockResume.mockResolvedValue({ needsReconciliation: false, gapDays: 5, pausedAt: '2026-07-01T10:00:00Z', hasFrozenBalance: true })
    resumeStockAsIs.mockResolvedValue(undefined)

    const { result } = renderHook(() => useStockToggle())
    expect(result.current.neverHadStock).toBe(false)

    await act(async () => {
      result.current.requestToggle()
      await waitFor(() => expect(assessStockResume).toHaveBeenCalledTimes(1))
    })

    await waitFor(() => expect(resumeStockAsIs).toHaveBeenCalledWith('settings'))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result.current.needsInitialBalance).toBe(false)
    expect(result.current.sheet).toBe(null)
    expect(result.current.announcement).toContain('retomado')
  })

  it('usuário com stock_paused_at (gap longo): abre sheet reconcile sem escrever ainda', async () => {
    useStockTracking.mockReturnValue({
      enabled: false,
      pausedAt: '2026-05-01T10:00:00Z',
      ready: true,
      refresh,
    })
    assessStockResume.mockResolvedValue({
      needsReconciliation: true,
      gapDays: 72,
      pausedAt: '2026-05-01T10:00:00Z',
      hasFrozenBalance: true,
    })

    const { result } = renderHook(() => useStockToggle())

    await act(async () => {
      result.current.requestToggle()
      await waitFor(() => expect(assessStockResume).toHaveBeenCalledTimes(1))
    })

    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))
    expect(result.current.reconcile).toEqual({ gapDays: 72, pausedAt: '2026-05-01T10:00:00Z' })
    expect(resumeStockAsIs).not.toHaveBeenCalled()
    expect(resumeStockAndZero).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.resumeAndZero()
    })
    expect(resumeStockAndZero).toHaveBeenCalledWith('settings')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ligado (enabled=true): toggle abre sheet freeze; confirmFreeze chama disableStockTracking + refresh', async () => {
    useStockTracking.mockReturnValue({ enabled: true, pausedAt: null, ready: true, refresh })
    disableStockTracking.mockResolvedValue(undefined)

    const { result } = renderHook(() => useStockToggle())

    act(() => {
      result.current.requestToggle()
    })
    expect(result.current.sheet).toBe('freeze')

    await act(async () => {
      await result.current.confirmFreeze()
    })

    expect(disableStockTracking).toHaveBeenCalledWith('settings')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result.current.sheet).toBe(null)
  })
})
