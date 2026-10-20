import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@services/api/pruneAdminService', () => ({
  pruneAdminService: {
    list: vi.fn(),
    approve: vi.fn(),
    defer: vi.fn(),
    reveal: vi.fn(),
    markNotice: vi.fn(),
  },
}))

import { usePruneAdminState, prefixMatches } from '../usePruneAdminState'
import { pruneAdminService } from '@services/api/pruneAdminService'

const svc = pruneAdminService as any

describe('usePruneAdminState', () => {
  beforeEach(() => {
    svc.list.mockResolvedValue({ data: [{ queue_id: 'q1', short_id: 'a9f3e1c2' }], summary: { approved_waiting: 0, executed_30d: 0 }, wave2: [] })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('prefixMatches: mínimo 6, sem diferenciar caixa, só prefixo', () => {
    expect(prefixMatches('a9f3e', 'a9f3e1c2')).toBe(false)
    expect(prefixMatches('A9F3E1', 'a9f3e1c2')).toBe(true)
    expect(prefixMatches(' a9f3e1c2 ', 'a9f3e1c2')).toBe(true)
    expect(prefixMatches('f3e1c2', 'a9f3e1c2')).toBe(false)
  })

  it('carrega a fila e, depois de aprovar, recarrega do servidor (o estado de verdade é lá)', async () => {
    svc.approve.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => usePruneAdminState())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toHaveLength(1)

    await act(async () => { await result.current.approve('q1', 'a9f3e1') })
    expect(svc.approve).toHaveBeenCalledWith('q1', 'a9f3e1')
    expect(svc.list).toHaveBeenCalledTimes(2)
    expect(result.current.message?.type).toBe('success')
  })

  it('recusa do servidor vira mensagem de erro, sem quebrar a tela', async () => {
    svc.approve.mockRejectedValue(new Error('Confirmação inválida'))
    const { result } = renderHook(() => usePruneAdminState())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let ok
    await act(async () => { ok = await result.current.approve('q1', 'zzzzzz') })
    expect(ok).toBe(false)
    expect(result.current.message).toEqual({ type: 'error', text: 'Confirmação inválida' })
  })
})
