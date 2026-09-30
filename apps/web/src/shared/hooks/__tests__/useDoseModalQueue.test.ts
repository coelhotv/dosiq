import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDoseModalQueue } from '@shared/hooks/useDoseModalQueue'

const fire = (detail?: unknown) =>
  act(() => {
    window.dispatchEvent(new CustomEvent('mr:open-dose-modal', { detail }))
  })

describe('useDoseModalQueue (071)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('fila de 2: abre a 1ª, fechar avança para a 2ª, fechar de novo fecha o modal', () => {
    const setOpen = vi.fn()
    const setValues = vi.fn()
    const { result } = renderHook(() => useDoseModalQueue(setOpen, setValues))
    fire({ queue: [{ instance_id: 'a' }, { instance_id: 'b' }] })
    expect(setValues).toHaveBeenLastCalledWith({ instance_id: 'a' })
    expect(setOpen).toHaveBeenLastCalledWith(true)

    act(() => result.current())
    expect(setValues).toHaveBeenLastCalledWith({ instance_id: 'b' })
    expect(setOpen).not.toHaveBeenCalledWith(false)

    act(() => result.current())
    expect(setOpen).toHaveBeenLastCalledWith(false)
    expect(setValues).toHaveBeenLastCalledWith(null)
  })

  it('evento sem fila (insight card) só abre, sem mexer nos valores iniciais', () => {
    const setOpen = vi.fn()
    const setValues = vi.fn()
    renderHook(() => useDoseModalQueue(setOpen, setValues))
    fire()
    expect(setOpen).toHaveBeenCalledWith(true)
    expect(setValues).not.toHaveBeenCalled()
  })
})
