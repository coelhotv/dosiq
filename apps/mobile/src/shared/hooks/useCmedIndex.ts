import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
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
// (~4 MB, 26 mil linhas) fica em memória no módulo depois da 1ª carga da sessão (C-C6: ler e
// parsear o disco a cada abertura do sheet custava 1,4–8 s nos Android do smoke). Solta ao ir
// para background: aparelho com pouca RAM (LG K8) mata primeiro o app que segura memória parado.
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
  onLoaded?: (info: CmedIndexLoadInfo) => void
  baseUrl?: string
  ttlMs?: number
}

const FILE_KEY = 'cmedIndex'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

const storageAdapter = createFileSystemStorageAdapter()

const IDLE: CmedIndexState = { status: 'idle', index: null, lookup: null }
const PREPARING: CmedIndexState = { status: 'preparing', index: null, lookup: null }

// Cache de sessão (C-C6): só índice íntegro entra; o manifest acompanha para a revalidação.
let memory: { state: CmedIndexState; manifest: CachedManifest | undefined } | null = null

export function handleCmedAppState(next: string) {
  if (next === 'background') memory = null
}
AppState.addEventListener('change', handleCmedAppState)

/** Só para testes: esvazia o cache de sessão. */
export function resetCmedIndexMemory() {
  memory = null
}

function initialState(enabled: boolean): CmedIndexState {
  if (!enabled) return IDLE
  return memory ? memory.state : PREPARING
}

// Tempo da carga para o PO-8 (066) em release e no campo — o console não chega ao logcat em release.
// O evento é emitido por quem monta o hook (`onLoaded`): o hook é strict island e o wrapper de
// analytics não é.
export interface CmedIndexLoadInfo {
  source: 'disk' | 'network'
  durationMs: number
  status: CmedIndexStatus
  rowCount: number
}

// Cede um quadro antes do trabalho pesado (ler/parsear ~4 MB na thread JS): o aviso de preparo
// pinta primeiro (C-C5 — no LG K8 a tela parecia travada sem aviso).
function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

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
  onLoaded,
}: UseCmedIndexOptions = {}) {
  // Callback em ref: trocar a função a cada render não pode recarregar o índice.
  const onLoadedRef = useRef(onLoaded)
  // States
  const loadKey = `${enabled}|${baseUrl}|${ttlMs}`
  const [state, setState] = useState<CmedIndexState>(() => initialState(enabled))
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey)

  // Opções mudaram: recomeça já no render (desabilitar solta o índice da memória).
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey)
    setState(initialState(enabled))
  }

  // Effects
  useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  useEffect(() => {
    if (!enabled) return undefined
    let canceled = false

    function reportLoaded(source: 'disk' | 'network', startedAt: number, loaded: CmedIndexState) {
      onLoadedRef.current?.({
        source,
        durationMs: Math.round(performance.now() - startedAt),
        status: loaded.status,
        rowCount: loaded.index?.n ?? 0,
      })
    }

    async function load() {
      const t0 = performance.now()
      let cached: { manifest: CachedManifest | undefined; data?: unknown } | null
      let cachedState: CmedIndexState | null
      if (memory) {
        // 0. Cache de sessão: já está na tela desde o 1º render, sem ler o disco.
        cached = { manifest: memory.manifest }
        cachedState = memory.state
      } else {
        await yieldFrame()
        if (canceled) return
        // 1. Cache em disco
        cached = (await storageAdapter.read(FILE_KEY)) as { manifest: CachedManifest; data: unknown } | null
        if (canceled) return
        cachedState = cached ? toState(cached.data) : null
        if (cachedState?.status === 'ready') {
          memory = { state: cachedState, manifest: cached?.manifest }
          setState(cachedState)
          reportLoaded('disk', t0, cachedState)
        }
      }
      const hasData = cachedState?.status === 'ready'

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
          memory = { state: nextState, manifest: { ...remoteManifest, cachedAt: getNow().toISOString() } }
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
        if (!hasData) reportLoaded('network', t0, nextState)
      } catch (fetchErr) {
        if (canceled || hasData) return
        if (cachedState) {
          setState(cachedState)
          return
        }
        const failed: CmedIndexState = { status: isHttpError(fetchErr) ? 'failed' : 'offline', index: null, lookup: null }
        setState(failed)
        reportLoaded('network', t0, failed)
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
