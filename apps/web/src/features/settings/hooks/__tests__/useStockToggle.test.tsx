// useStockToggle — máquina de estados do toggle de estoque (spec 044, F4a / PO-5).
//
// O que estes testes protegem (e por quê):
//  • opt-out CONGELA: grava a preferência e NUNCA toca em saldo (`adjustToBalance`/`resumeAndZero`).
//  • retomada < 30d é SILENCIOSA e anunciada por TEXTO (sem sheet).
//  • retomada >= 30d NÃO escreve nada até o usuário escolher.
//  • fechar o sheet sem decidir NÃO ativa (zero escrita) e o sheet reaparece na próxima tentativa.
//  • AP-281: TODA escrita da preferência chama `refresh()` do provider.
//
// AP-279: os mocks honram a semântica que os testes afirmam — `assessResume` devolve o gap que o
// cenário declara e as escritas são spies distintos, para que "não mutou saldo" seja verificável.

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const assessResume = vi.fn()
const resumeAsIs = vi.fn()
const resumeAndZero = vi.fn()
const setStockTracking = vi.fn()
const refresh = vi.fn()

let trackingState = { enabled: true, pausedAt: null as string | null, ready: true }

// T017: useStockToggle não fala mais direto com @dosiq/core — a origem comum é o
// stockPreferenceService (garante o analytics do opt-in, AP-281/R-284). Mock aqui, não em
// @dosiq/core, senão o teste passaria "por acidente" contra um caminho que o hook já não usa.
vi.mock('@features/settings/services/stockPreferenceService', () => ({
  disableStockTracking: (...args: unknown[]) => setStockTracking(false, ...args),
  resumeStockAsIs: (...args: unknown[]) => resumeAsIs(...args),
  resumeStockAndZero: (...args: unknown[]) => resumeAndZero(...args),
  assessStockResume: (...args: unknown[]) => assessResume(...args),
}))

vi.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: () => ({ ...trackingState, refresh }),
}))

const { useStockToggle } = await import('../useStockToggle')

describe('useStockToggle (044 F4a)', () => {
  beforeEach(() => {
    trackingState = { enabled: true, pausedAt: null, ready: true }
    assessResume.mockResolvedValue({ pausedAt: null, gapDays: null, needsReconciliation: false, hasFrozenBalance: true })
    resumeAsIs.mockResolvedValue({ pausedAt: null, gapDays: null, needsReconciliation: false, hasFrozenBalance: true })
    resumeAndZero.mockResolvedValue({ zeroedMedicineIds: [] })
    setStockTracking.mockResolvedValue({ stock_tracking_enabled: false, stock_paused_at: '2026-06-01T10:00:00Z' })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('on→off: abre o sheet de congelamento sem escrever nada', () => {
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())

    expect(result.current.sheet).toBe('freeze')
    expect(setStockTracking).not.toHaveBeenCalled()
    expect(resumeAndZero).not.toHaveBeenCalled()
  })

  it('on→off confirmado: congela (preferência false) sem mutar saldo e chama refresh (AP-281)', async () => {
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await act(async () => {
      await result.current.confirmFreeze()
    })

    expect(setStockTracking).toHaveBeenCalledWith(false, 'settings')
    // OPT-OUT SEMPRE CONGELA: zero mutação de saldo.
    expect(resumeAndZero).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(result.current.sheet).toBeNull()
    expect(result.current.announcement).toMatch(/guardado como estava/i)
  })

  it('off→on com gap < 30d: retoma as-is, sem sheet, com anúncio textual', async () => {
    trackingState = { enabled: false, pausedAt: '2026-07-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-07-01T10:00:00Z',
      gapDays: 11,
      needsReconciliation: false,
      hasFrozenBalance: true,
    })
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())

    await waitFor(() => expect(resumeAsIs).toHaveBeenCalledTimes(1))
    expect(result.current.sheet).toBeNull()
    expect(resumeAndZero).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(result.current.announcement).toBe(
      'Controle de estoque reativado · saldo retomado como estava',
    )
  })

  it('off→on com gap >= 30d: abre a reconciliação e NÃO escreve nada ainda', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())

    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))
    expect(result.current.reconcile).toEqual({ gapDays: 47, pausedAt: '2026-05-01T10:00:00Z' })
    expect(resumeAsIs).not.toHaveBeenCalled()
    expect(resumeAndZero).not.toHaveBeenCalled()
    expect(setStockTracking).not.toHaveBeenCalled()
  })

  it('reconciliação → "começar do zero": zera por medicamento e reativa (append-only)', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))

    await act(async () => {
      await result.current.resumeAndZero()
    })

    expect(resumeAndZero).toHaveBeenCalledTimes(1)
    expect(resumeAsIs).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(result.current.sheet).toBeNull()
  })

  it('reconciliação → "retomar o saldo": reativa sem mutar saldo', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))

    await act(async () => {
      await result.current.resumeAsIs()
    })

    expect(resumeAsIs).toHaveBeenCalledTimes(1)
    expect(resumeAndZero).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('reconciliação fechada sem decidir: NÃO ativa, zero escrita, e o sheet reaparece depois', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))

    act(() => result.current.closeSheet())

    expect(result.current.sheet).toBeNull()
    expect(result.current.reconcile).toBeNull()
    expect(resumeAsIs).not.toHaveBeenCalled()
    expect(resumeAndZero).not.toHaveBeenCalled()
    expect(setStockTracking).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()

    // Próxima tentativa: o sheet reaparece (a preferência continua OFF no banco).
    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))
  })

  it('falha ao zerar mantém o controle OFF (o service só liga no fim) e reporta o erro', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    resumeAndZero.mockRejectedValue(new Error('falha no ajuste'))
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))

    await act(async () => {
      await result.current.resumeAndZero()
    })

    expect(result.current.error).toBe('falha no ajuste')
    // Sheet segue aberto: o usuário pode escolher de novo; nada ficou meio-ligado.
    expect(result.current.sheet).toBe('reconcile')
    expect(result.current.announcement).toBeNull()
  })

  it('fechar o sheet limpa o erro da tentativa abandonada', async () => {
    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-05-01T10:00:00Z',
      gapDays: 47,
      needsReconciliation: true,
      hasFrozenBalance: true,
    })
    resumeAndZero.mockRejectedValue(new Error('falha no ajuste'))
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    await waitFor(() => expect(result.current.sheet).toBe('reconcile'))
    await act(async () => {
      await result.current.resumeAndZero()
    })
    expect(result.current.error).toBe('falha no ajuste')

    act(() => result.current.closeSheet())

    // Erro de uma ação que o usuário desistiu de fazer não pode sobreviver ao fechamento.
    expect(result.current.error).toBeNull()
  })

  it('usuário que nunca teve estoque (off sem carimbo) é distinguido do congelado', () => {
    trackingState = { enabled: false, pausedAt: null, ready: true }
    const { result } = renderHook(() => useStockToggle())

    expect(result.current.neverHadStock).toBe(true)

    trackingState = { enabled: false, pausedAt: '2026-05-01T10:00:00Z', ready: true }
    const frozen = renderHook(() => useStockToggle())
    expect(frozen.result.current.neverHadStock).toBe(false)
  })

  // T017: quem nunca teve estoque não ativa direto — abre o form de saldo inicial. A escrita
  // real fica com InitialBalanceForm/stockPreferenceService, fora deste hook.
  it('off→on de quem nunca teve estoque: abre o form de saldo inicial sem escrever nada', () => {
    trackingState = { enabled: false, pausedAt: null, ready: true }
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())

    expect(result.current.sheet).toBe('initial-balance')
    expect(assessResume).not.toHaveBeenCalled()
    expect(resumeAsIs).not.toHaveBeenCalled()
    expect(setStockTracking).not.toHaveBeenCalled()
  })

  // Regressão do smoke da F4b: carimbo SEM saldo por trás (conta que nasceu dose-only com o
  // carimbo indevido, ou opt-out feito com o estoque já vazio). Não há o que retomar — retomar
  // as-is ligaria o FIFO sobre zero e o usuário nunca seria perguntado quanto tem (PO-3).
  it('off→on com carimbo mas SEM saldo: abre o saldo inicial em vez de retomar', async () => {
    trackingState = { enabled: false, pausedAt: '2026-07-12T23:29:00Z', ready: true }
    assessResume.mockResolvedValue({
      pausedAt: '2026-07-12T23:29:00Z',
      gapDays: 0,
      needsReconciliation: false,
      hasFrozenBalance: false,
    })
    const { result } = renderHook(() => useStockToggle())

    await act(async () => { result.current.requestToggle() })

    expect(result.current.sheet).toBe('initial-balance')
    expect(resumeAsIs).not.toHaveBeenCalled()
  })

  it('fechar o form de saldo inicial sem concluir NÃO ativa (zero escrita)', () => {
    trackingState = { enabled: false, pausedAt: null, ready: true }
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    expect(result.current.sheet).toBe('initial-balance')

    act(() => result.current.closeInitialBalance())

    expect(result.current.sheet).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('concluir o saldo inicial fecha o sheet, chama refresh (AP-281) e anuncia', async () => {
    trackingState = { enabled: false, pausedAt: null, ready: true }
    const { result } = renderHook(() => useStockToggle())

    act(() => result.current.requestToggle())
    expect(result.current.sheet).toBe('initial-balance')

    await act(async () => {
      await result.current.finishInitialBalance()
    })

    expect(refresh).toHaveBeenCalled()
    expect(result.current.sheet).toBeNull()
    expect(result.current.announcement).toBe('Controle de estoque ativado')
  })
})
