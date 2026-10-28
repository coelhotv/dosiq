/**
 * authSignal.ts — decide, sem rede e sem carregar o Supabase, se a carga atual pode ter sessão.
 *
 * Spec 112 (PO-112-2): visitante anônimo não baixa `vendor-supabase`. Qualquer sinal de auth
 * (sessão salva, retorno de magic link/recovery/PKCE pela URL, fluxo de recovery em andamento)
 * libera o import dinâmico de `@shared/utils/supabase`.
 *
 * ⚠️ Depende do storageKey default do supabase-js (`sb-<ref>-auth-token`) e do retorno pela URL
 * (`detectSessionInUrl: true` em `shared/utils/supabase.ts`). Se alguém definir `storageKey`
 * custom ali, ajuste `AUTH_STORAGE_KEY_RE` junto.
 */

export const AUTH_STORAGE_KEY_RE = /^sb-.+-auth-token$/
export const RECOVERY_FLOW_KEY = '@dosiq/recovery-flow'

// Parâmetros que o Supabase devolve na URL ao voltar de e-mail/OAuth
const URL_AUTH_PARAM_RE =
  /(?:^|[#?&])(?:access_token|refresh_token|error_description|error_code|code|type=(?:recovery|magiclink|signup|invite|email_change))(?:=|&|$)/

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem'>
type LocationLike = Pick<Location, 'search' | 'hash'>

function storageHasSignal(storage: StorageLike | undefined): boolean {
  if (!storage) return false
  try {
    if (storage.getItem(RECOVERY_FLOW_KEY) === 'true') return true
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && AUTH_STORAGE_KEY_RE.test(key)) return true
    }
  } catch {
    // Storage bloqueado (navegação privada estrita): sem sessão persistida possível
  }
  return false
}

function urlHasSignal(location: LocationLike | undefined): boolean {
  if (!location) return false
  return URL_AUTH_PARAM_RE.test(location.search || '') || URL_AUTH_PARAM_RE.test(location.hash || '')
}

export function hasAuthSignal(storage?: StorageLike, location?: LocationLike): boolean {
  return storageHasSignal(storage) || urlHasSignal(location)
}
