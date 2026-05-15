import { useCallback, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getNow, parseISO } from '@dosiq/core'

// Hook que baixa, faz cache local e expõe busca na base ANVISA de medicamentos.
// Fluxo:
//   1. Mount: lê manifest cacheado em AsyncStorage
//   2. Busca remoto manifest.json em background
//   3. Se versão remota difere ou cache vazio: baixa medicineDatabase.json
//      e atualiza AsyncStorage
//   4. TTL 7 dias força re-check mesmo com versão igual
//
// Falha de rede → degradação graciosa: form continua funcional sem autocomplete.
//
// Uso:
//   const { search, getByName, isReady, isLoading, lastUpdated, error } = useMedicineDatabase()
//   const results = search('paracetamol', 10)

const ANVISA_BASE_URL =
  'https://kwqjtdsqkkbebfiaxubb.supabase.co/storage/v1/object/public/dosiq-assets/anvisa/v1'

const STORAGE_KEYS = {
  manifest: '@dosiq/anvisa-manifest',
  data: '@dosiq/anvisa-data',
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

// Normaliza texto para busca (remove diacríticos + lowercase). Idêntico à web.
function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Match por prefixo com word-boundary: "trime" casa "Maleato de Trimebutina"
// (após espaço) e "Trimetoprima" (início), mas NÃO "Sumatripta**" (mid-word).
// Boundaries reconhecidos: início, espaço, hífen, ponto, parêntese, slash, vírgula.
function matchesPrefix(normalizedText, normalizedQuery) {
  if (!normalizedText || !normalizedQuery) return false
  if (normalizedText.startsWith(normalizedQuery)) return true
  // Procura ocorrências após boundary
  const boundaryChars = ' -.,(/\\'
  for (let i = 1; i < normalizedText.length; i += 1) {
    if (boundaryChars.includes(normalizedText[i - 1])) {
      if (normalizedText.startsWith(normalizedQuery, i)) return true
    }
  }
  return false
}

// Fetch JSON com timeout (R-168) e tratamento de erro silencioso para o caller.
async function fetchJson(url, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} em ${url}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

// Lê manifest+data cacheados em AsyncStorage. Retorna { manifest, data } ou null.
async function readCachedDatabase() {
  try {
    const entries = await AsyncStorage.multiGet([
      STORAGE_KEYS.manifest,
      STORAGE_KEYS.data,
    ])
    const [rawManifest, rawData] = entries.map(([, v]) => v)
    if (!rawManifest || !rawData) return null
    return {
      manifest: JSON.parse(rawManifest),
      data: JSON.parse(rawData),
    }
  } catch (cacheErr) {
    console.warn('[useMedicineDatabase] cache read falhou:', cacheErr?.message)
    return null
  }
}

// Decide se cache atual precisa ser substituído. Boolean.
function shouldRefreshCache({ remoteManifest, cachedManifest, ttlMs, hasData }) {
  if (!cachedManifest) return true
  if (!hasData) return true
  if (cachedManifest.version !== remoteManifest.version) return true
  const cachedAtMs = cachedManifest.cachedAt
    ? parseISO(cachedManifest.cachedAt).getTime()
    : 0
  // R-020: usa getNow() em vez de Date.now() para consistência com regras gerais
  return getNow().getTime() - cachedAtMs > ttlMs
}

// Resolve URL absoluto do medicineDatabase.json a partir do manifest remoto.
function resolveDataUrl(baseUrl, remoteManifest) {
  const fileName =
    remoteManifest?.files?.medicineDatabase?.path?.split('/').pop() ||
    'medicineDatabase.json'
  return `${baseUrl}/${fileName}`
}

// Persiste novo manifest+data em AsyncStorage; retorna manifestToCache.
async function persistRemote(remoteManifest, remoteData) {
  const manifestToCache = {
    ...remoteManifest,
    cachedAt: getNow().toISOString(),
  }
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.manifest, JSON.stringify(manifestToCache)],
    [STORAGE_KEYS.data, JSON.stringify(remoteData)],
  ])
  return manifestToCache
}

export function useMedicineDatabase({
  baseUrl = ANVISA_BASE_URL,
  ttlMs = TTL_MS,
} = {}) {
  // States
  const [database, setDatabase] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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
      const cached = await readCachedDatabase()
      let hasData = false
      if (cached && !canceled) {
        setManifest(cached.manifest)
        setDatabase(cached.data)
        setIsLoading(false)
        hasData = true
      }

      // 2. Background: busca remoto e decide se re-download é necessário
      try {
        const remoteManifest = await fetchJson(`${baseUrl}/manifest.json`)
        if (canceled) return

        const refresh = shouldRefreshCache({
          remoteManifest,
          cachedManifest: cached?.manifest,
          ttlMs,
          hasData,
        })

        if (refresh) {
          const remoteData = await fetchJson(resolveDataUrl(baseUrl, remoteManifest))
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
          setError(fetchErr?.message || 'Falha ao baixar base ANVISA')
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
    (query, limit = 10) => {
      if (!normalizedDatabase || !query || query.trim().length < 3) return []
      const q = normalizeText(query)
      const nameMatches = []
      const ingredientMatches = []
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
    (name) => {
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
