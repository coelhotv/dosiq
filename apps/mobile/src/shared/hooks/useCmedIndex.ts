import { useEffect, useState } from 'react'
import {
  getNow,
  fetchJson,
  shouldRefreshCache,
  resolveDataUrl,
  decodeCmedIndex,
  buildEanLookup,
  type CmedIndex,
  type EanLookup,
} from '@dosiq/core'
import { createFileSystemStorageAdapter } from '@shared/services/_fileSystemStorageAdapter'
import { ANVISA_BASE_URL } from '@shared/hooks/useMedicineDatabase'

// Carga sob demanda do índice CMED (066 Slice B · FR-022/FR-023 · ADR-107).
//
// Só montar nas telas do cadastro (passo 2 da busca 2C, scanner): nunca no boot. O índice
// (~4 MB, 26 mil linhas) vive apenas no estado deste hook — ao desmontar, as referências caem
// com o componente; não há cache de módulo.
//
// Fluxo (2 fases, como o useMedicineDatabase):
//   1. cache em disco → decodifica → `ready` imediato se íntegro
//   2. manifest remoto → shouldRefreshCache → baixa, grava (best-effort) e troca o índice
// Estados mapeiam 1:1 para as telas da spec: preparing = f1-prep · offline = x-off ·
// failed = x-idx · version = x-ver.

export type CmedIndexStatus = 'idle' | 'preparing' | 'ready' | 'offline' | 'failed' | 'version'

interface CmedIndexState {
  status: CmedIndexStatus
  index: CmedIndex | null
  lookup: EanLookup | null
}

interface CachedManifest {
  version?: string
  cachedAt?: string
  files?: Record<string, { path?: string }>
  [key: string]: unknown
}

interface UseCmedIndexOptions {
  enabled?: boolean
  baseUrl?: string
  ttlMs?: number
}

const FILE_KEY = 'cmedIndex'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

const storageAdapter = createFileSystemStorageAdapter()

const IDLE: CmedIndexState = { status: 'idle', index: null, lookup: null }
const PREPARING: CmedIndexState = { status: 'preparing', index: null, lookup: null }

// Decodifica uma vez e já monta o lookup EAN → linhas; falha vira o estado de erro da tela.
function toState(raw: unknown): CmedIndexState {
  const decoded = decodeCmedIndex(raw)
  if (decoded.ok === false) {
    return { status: decoded.reason === 'version' ? 'version' : 'failed', index: null, lookup: null }
  }
  return { status: 'ready', index: decoded.index, lookup: buildEanLookup(decoded.index) }
}

// fetchJson lança `HTTP <status> em <url>` quando o servidor responde; o resto é rede/timeout.
function isHttpError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('HTTP ')
}

export function useCmedIndex({
  enabled = true,
  baseUrl = ANVISA_BASE_URL,
  ttlMs = TTL_MS,
}: UseCmedIndexOptions = {}) {
  // States
  const loadKey = `${enabled}|${baseUrl}|${ttlMs}`
  const [state, setState] = useState<CmedIndexState>(enabled ? PREPARING : IDLE)
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey)

  // Opções mudaram: recomeça já no render (desabilitar solta o índice da memória).
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey)
    setState(enabled ? PREPARING : IDLE)
  }

  // Effects
  useEffect(() => {
    if (!enabled) return undefined
    let canceled = false

    async function load() {
      // 1. Cache em disco
      const cached = (await storageAdapter.read(FILE_KEY)) as
        | { manifest: CachedManifest; data: unknown }
        | null
      if (canceled) return
      const cachedState = cached ? toState(cached.data) : null
      const hasData = cachedState?.status === 'ready'
      if (hasData) setState(cachedState)

      // 2. Revalida no remoto
      try {
        const remoteManifest = (await fetchJson(`${baseUrl}/manifest.json`)) as CachedManifest
        if (canceled) return
        const refresh = shouldRefreshCache({
          remoteManifest,
          cachedManifest: cached?.manifest,
          ttlMs,
          hasData,
        })
        // Sem cache íntegro (hasData false) shouldRefreshCache é sempre true.
        if (!refresh) return
        const remoteData = await fetchJson(resolveDataUrl(baseUrl, remoteManifest, FILE_KEY))
        if (canceled) return
        const nextState = toState(remoteData)
        if (nextState.status === 'ready') {
          try {
            await storageAdapter.write(FILE_KEY, {
              manifest: { ...remoteManifest, cachedAt: getNow().toISOString() },
              data: remoteData,
            })
          } catch (writeErr) {
            // Sem disco a sessão segue com o índice em memória; a próxima abertura baixa de novo.
            console.warn('[useCmedIndex] gravação do cache falhou:', (writeErr as Error)?.message)
          }
        }
        if (canceled) return
        // Índice novo inválido não derruba um cache íntegro já na tela.
        if (nextState.status === 'ready' || !hasData) setState(nextState)
      } catch (fetchErr) {
        if (canceled || hasData) return
        if (cachedState) {
          setState(cachedState)
          return
        }
        setState({ status: isHttpError(fetchErr) ? 'failed' : 'offline', index: null, lookup: null })
      }
    }

    load()
    return () => {
      canceled = true
    }
  }, [enabled, baseUrl, ttlMs])

  return state
}

export default useCmedIndex
