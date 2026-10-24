import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleChunkError,
  initChunkReloadListener,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_WINDOW_MS,
} from '../chunkReload'

describe('chunkReload (PO-110-4 / AC-4)', () => {
  let mockStorage: Record<string, string>
  let storageAdapter: Storage
  let reloadMock: () => void
  let preventDefaultMock: () => void

  beforeEach(() => {
    mockStorage = {}
    storageAdapter = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value },
      removeItem: (key: string) => { delete mockStorage[key] },
      clear: () => { mockStorage = {} },
      key: () => null,
      length: 0,
    }
    reloadMock = vi.fn()
    preventDefaultMock = vi.fn()
  })

  it('dispara reload 1x na primeira falha de chunk e salva timestamp no storage', () => {
    const nowTime = 1_000_000
    const handled = handleChunkError(
      { preventDefault: preventDefaultMock },
      {
        storage: storageAdapter,
        location: { reload: reloadMock },
        now: () => nowTime,
      }
    )

    expect(handled).toBe(true)
    expect(preventDefaultMock).toHaveBeenCalledTimes(1)
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(mockStorage[CHUNK_RELOAD_STORAGE_KEY]).toBe(String(nowTime))
  })

  it('segunda falha na mesma janela (<= 60s) NÃO recarrega nem previne o erro (sobe para boundary)', () => {
    const t0 = 1_000_000
    mockStorage[CHUNK_RELOAD_STORAGE_KEY] = String(t0)

    // Ocorre 30 segundos depois do primeiro reload
    const t1 = t0 + 30_000
    const handled = handleChunkError(
      { preventDefault: preventDefaultMock },
      {
        storage: storageAdapter,
        location: { reload: reloadMock },
        now: () => t1,
        windowMs: CHUNK_RELOAD_WINDOW_MS,
      }
    )

    expect(handled).toBe(false)
    expect(preventDefaultMock).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
    expect(mockStorage[CHUNK_RELOAD_STORAGE_KEY]).toBe(String(t0))
  })

  it('falha após a expiração da janela (> 60s) permite novo reload recuperativo', () => {
    const t0 = 1_000_000
    mockStorage[CHUNK_RELOAD_STORAGE_KEY] = String(t0)

    // Ocorre 61 segundos depois
    const t2 = t0 + 61_000
    const handled = handleChunkError(
      { preventDefault: preventDefaultMock },
      {
        storage: storageAdapter,
        location: { reload: reloadMock },
        now: () => t2,
        windowMs: CHUNK_RELOAD_WINDOW_MS,
      }
    )

    expect(handled).toBe(true)
    expect(preventDefaultMock).toHaveBeenCalledTimes(1)
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(mockStorage[CHUNK_RELOAD_STORAGE_KEY]).toBe(String(t2))
  })

  it('lida com falha de acesso a storage (ex: navegação privada estrita) sem lançar exceção', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('QuotaExceeded or SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
      removeItem: () => {},
    }

    expect(() => {
      const handled = handleChunkError(
        { preventDefault: preventDefaultMock },
        {
          storage: throwingStorage as any,
          location: { reload: reloadMock },
          now: () => Date.now(),
        }
      )
      expect(handled).toBe(false)
    }).not.toThrow()
  })

  it('initChunkReloadListener registra o listener no window e dispara handleChunkError no evento', () => {
    const listeners: Record<string, EventListener> = {}
    const mockWindow = {
      addEventListener: vi.fn((event: string, cb: EventListener) => { listeners[event] = cb }),
      removeEventListener: vi.fn((event: string) => { delete listeners[event] }),
      sessionStorage: storageAdapter,
      location: { reload: reloadMock },
    } as unknown as Window

    const cleanup = initChunkReloadListener(mockWindow)
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))

    // Dispara o evento
    const mockEvent = { preventDefault: preventDefaultMock }
    listeners['vite:preloadError'](mockEvent as unknown as Event)

    expect(preventDefaultMock).toHaveBeenCalledTimes(1)
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // Cleanup
    cleanup()
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))
  })
})
