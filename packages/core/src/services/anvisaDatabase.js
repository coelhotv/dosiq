// @dosiq/core — núcleo on-demand da base ANVISA (CON-027), platform-agnostic.
//
// Centraliza manifest/TTL/versão/fetch-timeout/normalize/match, parametrizado por
// um storage adapter injetável (Cache Storage API na web, AsyncStorage no mobile).
// Mata a triplicação que existia entre mobile (useMedicineDatabase) e os 2 services web.
//
// Fluxo de load():
//   1. lê cache via adapter.read(fileKey) → { manifest, data } | null
//   2. busca manifest remoto (com timeout)
//   3. shouldRefreshCache (versão difere OU TTL expirado OU sem cache) → re-download
//   4. persiste novo manifest+data via adapter.write; senão serve cache
//   5. falha de rede sem cache → [] (degradação graciosa, sem throw)
//
// StorageAdapter (interface injetada):
//   read(fileKey)  → Promise<{ manifest, data } | null>
//   write(fileKey, { manifest, data }) → Promise<void>

import { getNow, parseISO } from '../utils/dateUtils.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
const DEFAULT_TIMEOUT_MS = 30_000

// Normaliza texto para busca (remove diacríticos + lowercase). Idêntico web↔mobile.
export function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Match por prefixo com word-boundary: "trime" casa "Maleato de Trimebutina"
// (após espaço) e "Trimetoprima" (início), mas NÃO "Sumatripta**" (mid-word).
// Boundaries reconhecidos: início, espaço, hífen, ponto, parêntese, slash, vírgula.
export function matchesPrefix(normalizedText, normalizedQuery) {
  if (!normalizedText || !normalizedQuery) return false
  if (normalizedText.startsWith(normalizedQuery)) return true
  const boundaryChars = ' -.,(/\\'
  for (let i = 1; i < normalizedText.length; i += 1) {
    if (boundaryChars.includes(normalizedText[i - 1])) {
      if (normalizedText.startsWith(normalizedQuery, i)) return true
    }
  }
  return false
}

// Fetch JSON com timeout (R-168, AbortController). Lança em erro de rede/HTTP — o
// caller (load) é quem decide a degradação graciosa.
export async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
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

// Decide se cache atual precisa ser substituído. Boolean.
export function shouldRefreshCache({ remoteManifest, cachedManifest, ttlMs, hasData }) {
  if (!cachedManifest) return true
  if (!hasData) return true
  if (cachedManifest.version !== remoteManifest.version) return true
  const cachedAtMs = cachedManifest.cachedAt
    ? parseISO(cachedManifest.cachedAt).getTime()
    : 0
  // R-020: usa getNow() em vez de Date.now() para consistência com regras gerais
  return getNow().getTime() - cachedAtMs > ttlMs
}

// Resolve URL absoluto do arquivo a partir do manifest remoto + fileKey.
// Usa só o basename de files.<fileKey>.path (o baseUrl já aponta p/ anvisa/v1).
export function resolveDataUrl(baseUrl, remoteManifest, fileKey) {
  const fileName =
    remoteManifest?.files?.[fileKey]?.path?.split('/').pop() || `${fileKey}.json`
  return `${baseUrl}/${fileName}`
}

/**
 * Cria um cliente on-demand da base ANVISA parametrizado por storage adapter (CON-027).
 *
 * @param {object} config
 * @param {string} config.baseUrl - base pública do bucket (…/dosiq-assets/anvisa/v1)
 * @param {string} config.fileKey - 'medicineDatabase' | 'laboratoryDatabase'
 * @param {{read:Function, write:Function}} config.storageAdapter - cache injetável
 * @param {number} [config.ttlMs] - TTL do cache (default 7d)
 * @param {number} [config.timeoutMs] - timeout do fetch (default 30s)
 * @returns {{ load: () => Promise<Array> }}
 */
export function createAnvisaDatabase({
  baseUrl,
  fileKey,
  storageAdapter,
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  // Memoização por instância: 1ª chamada carrega; subsequentes reusam (igual ao
  // antigo _database). Evita re-fetch a cada keystroke do autocomplete.
  let dataPromise = null

  async function resolveData() {
    // 1. Cache local (rápido). Falha de leitura → trata como ausência.
    const cached = await storageAdapter.read(fileKey).catch(() => null)
    const hasData = Boolean(cached?.data)

    // 2. Background: busca manifest remoto e decide se re-download é necessário.
    try {
      const remoteManifest = await fetchJson(`${baseUrl}/manifest.json`, timeoutMs)
      const refresh = shouldRefreshCache({
        remoteManifest,
        cachedManifest: cached?.manifest,
        ttlMs,
        hasData,
      })

      if (refresh) {
        const url = resolveDataUrl(baseUrl, remoteManifest, fileKey)
        const remoteData = await fetchJson(url, timeoutMs)
        const manifestToCache = { ...remoteManifest, cachedAt: getNow().toISOString() }
        // Persiste best-effort: falha de write (quota) não quebra a busca.
        await storageAdapter
          .write(fileKey, { manifest: manifestToCache, data: remoteData })
          .catch(() => {})
        return Array.isArray(remoteData) ? remoteData : []
      }

      // Cache válido (versão igual + dentro do TTL).
      return Array.isArray(cached?.data) ? cached.data : []
    } catch {
      // 3. Degradação graciosa: com cache serve stale; sem cache → [].
      return hasData && Array.isArray(cached?.data) ? cached.data : []
    }
  }

  async function load() {
    if (!dataPromise) {
      dataPromise = resolveData()
      // Se resolver vazio por falha de rede sem cache, permite nova tentativa depois.
      dataPromise = dataPromise
        .then((data) => {
          if (!data || data.length === 0) dataPromise = null
          return data
        })
        .catch((err) => {
          // resolveData() engole erros (retorna []), mas se ainda assim rejeitar
          // (adapter/config inesperado), reseta p/ não travar o serviço e relança.
          dataPromise = null
          throw err
        })
    }
    return dataPromise
  }

  return { load }
}
