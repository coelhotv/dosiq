// useSessionVerification.ts — "a conta desta sessão ainda existe?" (spec 091, US-2 / FR-004/FR-005)
//
// `getSession()` lê o token do aparelho e não consulta ninguém: conta excluída em outro aparelho
// seguia aberta, mostrando a agenda sob o banner "sem conexão" e tentando escrever em nome dela.
// Aqui o boot e cada volta ao foreground perguntam ao servidor (`getUser()`), com TRÊS respostas:
//
//   confirmed — servidor devolveu o usuário: escritas automáticas liberadas
//   invalid   — servidor disse que a sessão/conta não existe: encerra (endSession('invalid'))
//   unknown   — não deu para saber (sem rede, 5xx): app segue offline, SEM escrita automática,
//               e NUNCA derruba a sessão — offline legítimo não pode deslogar ninguém
//
// Forma dos erros conferida no auth-js 2.91.0 (analysis G-6): `session_not_found` vira
// AuthSessionMissingError; demais 4xx viram AuthApiError(status, code); 502-504 e falha de fetch
// viram AuthRetryableFetchError.

import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { endSession } from './endSession'

export type SessionVerification = 'none' | 'checking' | 'confirmed' | 'invalid' | 'unknown'

const INVALID_AUTH_CODES = new Set(['user_not_found', 'session_not_found', 'bad_jwt', 'refresh_token_not_found'])

/** Classifica o retorno de `supabase.auth.getUser()`. Na dúvida, `unknown` — nunca `invalid`. */
export function classifyAuthUserResult(result: { data?: { user?: unknown } | null; error?: any }): Exclude<
  SessionVerification,
  'none' | 'checking'
> {
  const user = result?.data?.user
  const error = result?.error
  if (user && !error) return 'confirmed'
  if (!error) return 'invalid'
  if (error.name === 'AuthRetryableFetchError') return 'unknown'
  if (error.name === 'AuthSessionMissingError') return 'invalid'
  if (typeof error.code === 'string' && INVALID_AUTH_CODES.has(error.code)) return 'invalid'
  if (error.name === 'AuthApiError' && (error.status === 401 || error.status === 403)) return 'invalid'
  return 'unknown'
}

// Rede ruim pode deixar o `getUser()` pendurado sem erro. Enquanto a verificação está em `checking`
// o boot segura no spinner (o gate de consentimento espera por ela) — sem teto, "sem internet"
// viraria app travado em vez de app offline com a cópia local.
export const VERIFY_TIMEOUT_MS = 8000

/** Pergunta ao servidor e encerra a sessão se ela não existe mais. Nunca lança. */
export async function verifyCurrentSession(): Promise<Exclude<SessionVerification, 'none' | 'checking'>> {
  let verdict: Exclude<SessionVerification, 'none' | 'checking'>
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<'unknown'>((resolve) => {
      timer = setTimeout(() => resolve('unknown'), VERIFY_TIMEOUT_MS)
    })
    verdict = await Promise.race([
      supabase.auth.getUser().then((result) => classifyAuthUserResult(result)),
      timeout,
    ])
  } catch {
    verdict = 'unknown'
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (verdict === 'invalid') await endSession('invalid')
  return verdict
}

export function useSessionVerification(userId: string | null | undefined): SessionVerification {
  const [state, setState] = useState<{ userId: string | null; verdict: SessionVerification }>({
    userId: null,
    verdict: 'none',
  })

  useEffect(() => {
    if (!userId) return
    let active = true
    const run = () => {
      verifyCurrentSession().then((verdict) => {
        if (active) setState({ userId, verdict })
      })
    }
    run()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run()
    })
    return () => {
      active = false
      sub.remove()
    }
  }, [userId])

  if (!userId) return 'none'
  // Veredito de outro titular (troca de conta) não vale para este: volta a `checking`.
  return state.userId === userId ? state.verdict : 'checking'
}
