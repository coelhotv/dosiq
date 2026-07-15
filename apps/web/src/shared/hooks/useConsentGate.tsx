/**
 * useConsentGate — gate de consentimento LGPD na web (spec 046, T009).
 *
 * Bootstrap autenticado, em ordem:
 *   1. materializa a intenção do signup (`user_metadata` → RPC `consent_grant`) — idempotente;
 *   2. lê o estado corrente da trilha;
 *   3. conta uma sessão de prompt SE (e só se) o estado lido for `missing` DE FATO;
 *   4. resolve o modo do guard (`resolveConsentGate`, pura, compartilhada com o mobile).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * O ESTADO INDETERMINADO É O CORAÇÃO DESTE ARQUIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * `getStatus()` LANÇA quando não consegue LER a trilha (contrato do Slice A). Aqui isso vira
 * `state: null` — NUNCA `'missing'`. A diferença não é estilística:
 *
 *   - `missing` afirma "este titular nunca se manifestou". Uma rede que piscou não afirma nada.
 *   - Agir sobre esse `missing` falso: contaríamos uma sessão de prompt (queimando a cortesia de
 *     quem não fez nada de errado) e — na materialização — RESSUSCITARÍAMOS um consentimento que o
 *     titular havia REVOGADO. Um erro de infra viraria uma decisão de consentimento que ele nunca
 *     tomou. Foi o furo HIGH pego no review do Slice A (família AP-290).
 *
 * Sob indeterminação: não libera, não bloqueia, NÃO conta sessão, NÃO escreve nada. É tela de
 * carregamento/erro, e o próximo bootstrap tenta de novo.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import {
  createConsentService,
  createProfileRepository,
  resolveConsentGate,
  isConsentAllowedRoute,
  CONSENT_ALLOWED_WEB_VIEWS,
  type ConsentGateDecision,
  type ConsentState,
} from '@dosiq/core'

const consentService = createConsentService({ client: supabase })
const profileRepo = createProfileRepository({ client: supabase, getUserId })

type ConsentGateValue = ConsentGateDecision & {
  /** `false` enquanto o bootstrap do gate não terminou. */
  ready: boolean
  /** Estado lido da trilha; `null` = leitura falhou (indeterminado). */
  state: ConsentState | null
  /** O titular dispensou o prompt nesta sessão (só possível no modo dispensável). */
  dismissed: boolean
  dismiss: () => void
  /** Grava o consentimento via RPC (`consent_grant`) — nunca INSERT. */
  grant: () => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

const DEFAULT_VALUE: ConsentGateValue = {
  mode: 'indeterminate',
  locked: false,
  needsRegularization: false,
  ready: false,
  state: null,
  dismissed: false,
  dismiss: () => {},
  grant: async () => ({ ok: false, error: 'ConsentGateProvider ausente' }),
  refresh: async () => {},
}

const ConsentGateContext = createContext<ConsentGateValue>(DEFAULT_VALUE)

type ProviderProps = {
  children: ReactNode
  /** ⚠️ Na web, `session` é o objeto USER (App.tsx faz `setSession(session?.user)`) — o
      `user_metadata` está na raiz, não em `session.user`. */
  session?: { user_metadata?: Record<string, unknown> } | null
}

export function ConsentGateProvider({ children, session = null }: ProviderProps) {
  const [state, setState] = useState<ConsentState | null>(null)
  const [promptSessions, setPromptSessions] = useState(0)
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) {
      setState(null)
      setPromptSessions(0)
      setReady(true)
      return
    }

    try {
      // Idempotente e defensivo por dentro: não materializa sobre um `revoked`, e não escreve nada
      // se não conseguiu LER a trilha. O `user_metadata` é só a carona da intenção — quem carimba o
      // evento é o RPC `SECURITY DEFINER`, no servidor.
      await consentService.materializeSignupIntent(
        session.user_metadata as { health_consent?: boolean; policy_version?: string } | undefined,
        'web',
      )

      const current = await consentService.getStatus('health_data')

      // Sessão de prompt só se conta quando SABEMOS que o titular nunca se manifestou. Se a linha
      // acima tivesse lançado, este trecho não roda — que é exatamente o ponto.
      let sessions = 0
      if (current.status === 'missing') {
        const bumped = await profileRepo.bumpConsentPromptSession()
        sessions = bumped.sessions
      }

      setState(current)
      setPromptSessions(sessions)
    } catch {
      // Indeterminado. Sem escrita, sem contagem, sem decisão.
      setState(null)
      setPromptSessions(0)
    } finally {
      setReady(true)
    }
  }, [session])

  const grant = useCallback(async () => {
    const res = await consentService.grant('health_data', 'web')
    if (res.ok) await refresh()
    return res
  }, [refresh])

  const dismiss = useCallback(() => setDismissed(true), [])

  // R-010: os memos vêm depois dos useCallback porque dependem deles — ordem imposta pela
  // dependência, não por descuido.
  // eslint-disable-next-line no-restricted-syntax
  const decision = useMemo(
    () => resolveConsentGate({ state, promptSessions }),
    [state, promptSessions],
  )

  // eslint-disable-next-line no-restricted-syntax
  const value = useMemo<ConsentGateValue>(
    () => ({ ...decision, ready, state, dismissed, dismiss, grant, refresh }),
    [decision, ready, state, dismissed, dismiss, grant, refresh],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  // Revalidação multi-superfície (espelho do mobile e do useStockTracking): o consentimento é
  // POLÍTICA DE CONTA. Se o titular autorizou/revogou em OUTRA superfície enquanto esta aba estava
  // em segundo plano, ela precisa reler o estado ao voltar ao foco — senão segue pedindo
  // autorização já concedida (ou libera acesso já revogado). Ponto de retomada = foco/visibilidade.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState !== 'visible') return
      refresh()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [refresh])

  return <ConsentGateContext.Provider value={value}>{children}</ConsentGateContext.Provider>
}

export function useConsentGate(): ConsentGateValue {
  return useContext(ConsentGateContext)
}

/** A view está liberada durante a trava? Allowlist (R2/F8) — default é BLOQUEAR. */
export function isConsentAllowedView(view: string | null | undefined): boolean {
  return isConsentAllowedRoute(view, CONSENT_ALLOWED_WEB_VIEWS)
}
