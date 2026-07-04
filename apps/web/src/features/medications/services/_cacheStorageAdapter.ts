/**
 * Storage adapter da base ANVISA para a web (CON-027) — Cache Storage API.
 *
 * Persistente, quota grande, integra PWA e funciona offline após a 1ª carga.
 *
 * FR-008: `caches` é undefined em jsdom/vitest e em contexto não-seguro (HTTP).
 * Guarda `typeof caches` e cai num fallback in-memory (Map module-level), sem throw —
 * garante que os services e seus testes funcionem mesmo sem Cache Storage.
 *
 * Interface (injetada em createAnvisaDatabase):
 *   read(fileKey)  → Promise<{ manifest, data } | null>
 *   write(fileKey, { manifest, data }) → Promise<void>
 */

const CACHE_NAME = 'dosiq-anvisa-v1'

// URL sintética (mesma origem) usada como chave no Cache Storage. Não é uma rota real.
function cacheKeyUrl(fileKey) {
  return `/__anvisa_cache__/${fileKey}.json`
}

export function createCacheStorageAdapter() {
  const memoryFallback = new Map()
  // `caches` pode existir mas ser `null` em alguns contextos (WebView Android,
  // navegação anônima) — checar não-nulo evita exceções desnecessárias.
  const hasCaches = typeof caches !== 'undefined' && caches !== null

  return {
    async read(fileKey) {
      if (!hasCaches) return memoryFallback.get(fileKey) ?? null
      try {
        const cache = await caches.open(CACHE_NAME)
        const res = await cache.match(cacheKeyUrl(fileKey))
        if (!res) return null
        return await res.json()
      } catch {
        return memoryFallback.get(fileKey) ?? null
      }
    },

    async write(fileKey, value) {
      if (!hasCaches) {
        memoryFallback.set(fileKey, value)
        return
      }
      try {
        const cache = await caches.open(CACHE_NAME)
        const body = JSON.stringify(value)
        await cache.put(
          cacheKeyUrl(fileKey),
          new Response(body, { headers: { 'Content-Type': 'application/json' } }),
        )
      } catch {
        // Quota/serialização falhou — mantém em memória; busca segue funcionando.
        memoryFallback.set(fileKey, value)
      }
    },
  }
}

export default createCacheStorageAdapter
