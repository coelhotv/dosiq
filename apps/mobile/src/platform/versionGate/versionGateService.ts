// versionGateService.ts — leitura do kill switch de versão mínima (spec 051-A / CON-033 §3)
//
// Leitura como `anon`, ANTES de haver sessão — o bloqueio precisa funcionar para quem abre o app
// pela primeira vez depois de o servidor mudar. `supabase-js` NÃO lança em erro de query: devolve
// `{ data: null, error }`. Este módulo inspeciona `error` explicitamente e converte QUALQUER falha
// (rede, timeout, `error` do PostgREST, linha ausente) para `null` — o resolver puro decide o resto.
//
// 🔴 SEM CACHE. Cachear um gate ativo bricka o usuário offline para sempre (CON-033 §1 invariante 5).

import { supabase } from '../supabase/nativeSupabaseClient'
import { VERSION_GATE_CLIENT_COLUMNS, type VersionGatePlatform, type VersionGateRow } from '@dosiq/core'

const READ_TIMEOUT_MS = 3000

const TIMEOUT_SENTINEL = Symbol('version-gate-read-timeout')

function timeoutAfter(ms: number): Promise<typeof TIMEOUT_SENTINEL> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(TIMEOUT_SENTINEL), ms)
  })
}

/**
 * Busca a linha do gate para a plataforma atual. Retorna `null` para QUALQUER indeterminação
 * (offline, timeout, error do PostgREST, linha ausente) — nunca lança.
 */
export async function fetchVersionGateRow(
  platform: VersionGatePlatform,
): Promise<VersionGateRow | null> {
  try {
    const query = supabase
      .from('app_version_gate')
      .select(VERSION_GATE_CLIENT_COLUMNS)
      .eq('platform', platform)
      .maybeSingle()

    // Se o timeout vencer a corrida, `query` segue pendente — sem este catch, uma rejeição tardia
    // vira unhandled promise rejection (nada mais está escutando essa promise específica).
    // `PostgrestBuilder` é thenable mas não expõe `.catch` — `Promise.resolve` normaliza.
    Promise.resolve(query).catch(() => {})

    const result = await Promise.race([query, timeoutAfter(READ_TIMEOUT_MS)])
    if (result === TIMEOUT_SENTINEL) return null // timeout

    const { data, error } = result
    if (error) return null // 42703/42501/RLS/etc — supabase-js não lança, inspecionar explicitamente
    if (!data) return null // linha ausente para a plataforma

    return {
      is_active: Boolean(data.is_active),
      min_supported_version: data.min_supported_version ?? null,
      message: data.message ?? null,
      store_url: data.store_url ?? null,
    }
  } catch {
    return null // rede/offline
  }
}
