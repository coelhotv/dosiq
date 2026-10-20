// deletionNoticeService.ts — prazo de exclusão de quem nunca consentiu (spec 107 FR-010 / T050).
//
// Duas leituras, ambas fail-open (erro, timeout ou dado inválido ⇒ `null`) e SEM cache — a data
// muda quando o titular autoriza, e um cache mostraria um prazo que já não existe:
//   - `get_my_deletion_notice()` (RPC DEFINER): só a PRÓPRIA data, só para legado/onboarding;
//   - `consent_copy` (texto editável no admin): validado pelo schema do core antes de chegar à tela.
// Sem data ⇒ o prompt segue exatamente como antes. Texto inválido ⇒ o prompt usa o fallback
// embarcado (o aviso legal nunca some por rede ou edição ruim — PO-SEC-3).

import { supabase } from '../supabase/nativeSupabaseClient'
import { consentCopyBodySchema } from '@dosiq/core'

const READ_TIMEOUT_MS = 3000
const COPY_KEY = 'never_consented_deadline'
const TIMEOUT = Symbol('deletion-notice-timeout')

function race<T>(p: PromiseLike<T>): Promise<T | typeof TIMEOUT> {
  // `PostgrestBuilder` é thenable sem `.catch` — `Promise.resolve` normaliza e evita rejeição órfã.
  const safe = Promise.resolve(p)
  safe.catch(() => {})
  return Promise.race([safe, new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), READ_TIMEOUT_MS))])
}

export interface DeletionNotice {
  /** Instante (ISO) em que a conta fica elegível à exclusão. */
  eligibleAt: string
  /** Texto do servidor já validado; `null` ⇒ usar o fallback embarcado. */
  body: string | null
}

export async function fetchDeletionNotice(): Promise<DeletionNotice | null> {
  try {
    const notice: any = await race(supabase.rpc('get_my_deletion_notice'))
    if (notice === TIMEOUT || notice?.error || typeof notice?.data !== 'string' || notice.data.length === 0) return null

    let body: string | null = null
    const copy: any = await race(supabase.from('consent_copy').select('body').eq('key', COPY_KEY).maybeSingle())
    if (copy !== TIMEOUT && !copy?.error) {
      const parsed = consentCopyBodySchema.safeParse(copy?.data?.body)
      body = parsed.success === false ? null : parsed.data
    }
    return { eligibleAt: notice.data, body }
  } catch {
    return null
  }
}
