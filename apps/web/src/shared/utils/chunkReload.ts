/**
 * chunkReload.ts
 *
 * Recuperação de falha de carregamento de chunk dinâmico pós-deploy (PO-110-4).
 * Escuta o evento 'vite:preloadError', disparando reload único protegido por janela de tempo
 * em sessionStorage para evitar loops em conexões instáveis.
 */

export const CHUNK_RELOAD_STORAGE_KEY = '@dosiq/chunk-reload'
export const CHUNK_RELOAD_WINDOW_MS = 60_000 // 60 segundos

export interface ChunkReloadDependencies {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  location?: Pick<Location, 'reload'>
  now?: () => number
  windowMs?: number
}

function isThrottled(storage: Pick<Storage, 'getItem'>, now: number, windowMs: number): boolean {
  const lastReloadStr = storage.getItem(CHUNK_RELOAD_STORAGE_KEY)
  if (!lastReloadStr) return false
  const lastReload = parseInt(lastReloadStr, 10)
  return !Number.isNaN(lastReload) && now - lastReload < windowMs
}

function resolveStorage(customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  if (customStorage) return customStorage
  if (typeof window !== 'undefined') return window.sessionStorage
  return undefined
}

function resolveLocation(customLocation?: Pick<Location, 'reload'>) {
  if (customLocation) return customLocation
  if (typeof window !== 'undefined') return window.location
  return undefined
}

/**
 * Avalia se o reload deve ser disparado e executa a recuperação protegida.
 * Retorna true se disparou o reload, false se foi throttled/suprimido.
 */
export function handleChunkError(
  event?: { preventDefault?: () => void },
  deps?: ChunkReloadDependencies
): boolean {
  const storage = resolveStorage(deps?.storage)
  const location = resolveLocation(deps?.location)
  const now = deps?.now ?? (() => Date.now())
  const windowMs = deps?.windowMs ?? CHUNK_RELOAD_WINDOW_MS

  if (!storage || !location) return false

  try {
    const currentTime = now()
    if (isThrottled(storage, currentTime, windowMs)) {
      return false
    }

    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(currentTime))

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }

    location.reload()
    return true
  } catch {
    // Falha silenciosa de storage (ex: navegação privada estrita)
    return false
  }
}

/**
 * Inicializa o listener do evento 'vite:preloadError' na janela.
 * Retorna função de desregistro.
 */
export function initChunkReloadListener(targetWindow?: Window): () => void {
  const win = targetWindow ?? (typeof window !== 'undefined' ? window : undefined)
  if (!win || typeof win.addEventListener !== 'function') return () => {}

  const onPreloadError = (event: Event) => {
    handleChunkError(event as any, {
      storage: win.sessionStorage,
      location: win.location,
    })
  }

  win.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    win.removeEventListener('vite:preloadError', onPreloadError)
  }
}
