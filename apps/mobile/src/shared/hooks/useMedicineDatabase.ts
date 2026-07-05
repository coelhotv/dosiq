import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getNow,
  parseISO,
  fetchJson,
  shouldRefreshCache,
  resolveDataUrl,
  normalizeText,
  matchesPrefix,
} from '@dosiq/core'
import { createAsyncStorageAdapter } from '@shared/services/_asyncStorageAdapter'
import { nativePublicAppConfig } from '@platform/config/nativePublicAppConfig'

interface Medicine {
  name: string
  activeIngredient: string
  [key: string]: unknown
}

interface CachedManifest {
  cachedAt?: string
  files?: Record<string, { path?: string }>
  [key: string]: unknown
}

// Hook que baixa, faz cache local e expõe busca na base ANVISA de medicamentos.
// Fluxo:
//   1. Mount: lê manifest cacheado em AsyncStorage (via storage adapter)
//   2. Busca remoto manifest.json em background
//   3. Se versão remota difere ou cache vazio: baixa medicineDatabase.json
//      e atualiza o cache
//   4. TTL 7 dias força re-check mesmo com versão igual
//
// Falha de rede → degradação graciosa: form continua funcional sem autocomplete.
//
// 037 Slice 2: a lógica pura (fetch/timeout, manifest/TTL, normalize, match) vive
// em `@dosiq/core` (CON-027/ADR-073), compartilhada com a web; aqui o hook só orquestra
// a UX de 2 fases (cache instantâneo + refresh em background) e a persistência via
// `_asyncStorageAdapter` (AsyncStorage). Comportamento idêntico ao anterior.
//
// Uso:
//   const { search, getByName, isReady, isLoading, lastUpdated, error } = useMedicineDatabase()
//   const results = search('paracetamol', 10)

// Subdomínio do Supabase vem do env (EXPO_PUBLIC_SUPABASE_URL via nativePublicAppConfig),
// nunca hardcoded — repo é opensource público.
const ANVISA_BASE_URL = `${nativePublicAppConfig.supabaseUrl}/storage/v1/object/public/dosiq-assets/anvisa/v1`

const FILE_KEY = 'medicineDatabase'

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

const storageAdapter = createAsyncStorageAdapter()

// Persiste novo manifest+data via adapter; retorna manifestToCache (com cachedAt).
async function persistRemote(remoteManifest: CachedManifest, remoteData: unknown) {
  const manifestToCache: CachedManifest = {
    ...remoteManifest,
    cachedAt: getNow().toISOString(),
  }
  await storageAdapter.write(FILE_KEY, { manifest: manifestToCache, data: remoteData })
  return manifestToCache
}

interface UseMedicineDatabaseOptions {
  baseUrl?: string
  ttlMs?: number
}

export function useMedicineDatabase({
  baseUrl = ANVISA_BASE_URL,
  ttlMs = TTL_MS,
}: UseMedicineDatabaseOptions = {}) {
  // States
  const [database, setDatabase] = useState<Medicine[] | null>(null)
  const [manifest, setManifest] = useState<CachedManifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memos (R-010: declarados antes de Effects e Handlers)
  // Pré-normaliza nome e princípio ativo uma única vez quando a base carrega.
  // Evita executar normalize('NFD') + regex em ~6800 registros a cada keystroke.
  const normalizedDatabase = useMemo(() => {
    if (!database) return null
    return database.map((med) => ({
      med,
      nName: normalizeText(med.name),
      nIngredient: normalizeText(med.activeIngredient),
    }))
  }, [database])

  const lastUpdated = useMemo(
    () => (manifest?.cachedAt ? parseISO(manifest.cachedAt) : null),
    [manifest],
  )

  // Effects
  // Carrega cache local (rápido) e dispara background sync (atualização)
  useEffect(() => {
    let canceled = false

    async function bootstrap() {
      // 1. Cache local primeiro (UX instantânea)
      const cached = (await storageAdapter.read()) as
        | { manifest: CachedManifest; data: Medicine[] }
        | null
      let hasData = false
      if (cached && !canceled) {
        setManifest(cached.manifest)
        setDatabase(cached.data)
        setIsLoading(false)
        hasData = true
      }

      // 2. Background: busca remoto e decide se re-download é necessário
      try {
        const remoteManifest = (await fetchJson(`${baseUrl}/manifest.json`)) as CachedManifest
        if (canceled) return

        const refresh = shouldRefreshCache({
          remoteManifest,
          cachedManifest: cached?.manifest,
          ttlMs,
          hasData,
        })

        if (refresh) {
          const remoteData = (await fetchJson(
            resolveDataUrl(baseUrl, remoteManifest, FILE_KEY),
          )) as Medicine[]
          if (canceled) return
          const manifestToCache = await persistRemote(remoteManifest, remoteData)
          if (!canceled) {
            setManifest(manifestToCache)
            setDatabase(remoteData)
            setError(null)
          }
        }
      } catch (fetchErr) {
        if (canceled) return
        // Degradação graciosa: se já tem cache, ignora erro de rede
        if (!hasData) {
          const message = fetchErr instanceof Error ? fetchErr.message : undefined
          setError(message || 'Falha ao baixar base ANVISA')
        }
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }

    bootstrap()
    return () => {
      canceled = true
    }
  }, [baseUrl, ttlMs])

  // Handlers
  // Busca autocomplete: word-boundary prefix em name OU activeIngredient.
  // Ranking: matches no name vêm antes dos só-em-activeIngredient.
  // Early break: para de iterar assim que atinge o limite total.
  const search = useCallback(
    (query: string, limit = 10): Medicine[] => {
      if (!normalizedDatabase || !query || query.trim().length < 3) return []
      const q = normalizeText(query)
      const nameMatches: Medicine[] = []
      const ingredientMatches: Medicine[] = []
      for (const entry of normalizedDatabase) {
        if (matchesPrefix(entry.nName, q)) {
          nameMatches.push(entry.med)
          if (nameMatches.length + ingredientMatches.length >= limit) break
          continue
        }
        if (matchesPrefix(entry.nIngredient, q)) {
          ingredientMatches.push(entry.med)
          if (nameMatches.length + ingredientMatches.length >= limit) break
        }
      }
      return [...nameMatches, ...ingredientMatches].slice(0, limit)
    },
    [normalizedDatabase],
  )

  const getByName = useCallback(
    (name: string): Medicine | null => {
      if (!normalizedDatabase || !name) return null
      const n = normalizeText(name)
      const exact = normalizedDatabase.find((entry) => entry.nName === n)
      if (exact) return exact.med
      const partial = normalizedDatabase.find((entry) => entry.nName.includes(n))
      return partial ? partial.med : null
    },
    [normalizedDatabase],
  )

  return {
    search,
    getByName,
    isReady: database !== null,
    isLoading,
    lastUpdated,
    error,
  }
}

export default useMedicineDatabase
