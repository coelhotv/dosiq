/**
 * useConsentGate — gate de consentimento LGPD no mobile (spec 046, T009).
 *
 * Espelho do hook web: MESMA decisão (`resolveConsentGate`, pura, no `@dosiq/core`), porque dois
 * guards com regras divergentes seriam, na prática, duas políticas de consentimento diferentes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * O ESTADO INDETERMINADO
 * ─────────────────────────────────────────────────────────────────────────────
 * `getStatus()` LANÇA quando não consegue LER a trilha (contrato do Slice A). Aqui isso vira
 * `state: null` — NUNCA `'missing'`. `missing` AFIRMA que o titular nunca se manifestou, e uma rede
 * que piscou não afirma nada: agir sobre esse `missing` falso contaria uma sessão de prompt e, na
 * materialização, RESSUSCITARIA um consentimento REVOGADO (furo HIGH do review do Slice A, família
 * AP-290). Sob indeterminação: não libera, não bloqueia, não conta sessão, não escreve nada.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'
import {
  createConsentService,
  createProfileRepository,
  resolveConsentGate,
  type ConsentGateDecision,
  type ConsentState,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { triggerConsentChange } from './consentSuppressionBus'

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  const id = data?.user?.id
  if (!id) throw new Error('useConsentGate: sem usuário autenticado')
  return id
}

const consentService = createConsentService({ client: supabase as never })
const profileRepo = createProfileRepository({ client: supabase as never, getUserId })

export interface ConsentGateValue extends ConsentGateDecision {
  ready: boolean
  state: ConsentState | null
  dismissed: boolean
  dismiss: () => void
  grant: () => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

interface Session {
  user?: { user_metadata?: Record<string, unknown> } | null
}

/**
 * ⚠️ É PROVIDER, não hook solto — de propósito. O consentimento é ESTADO ÚNICO da conta: o guard
 * raiz (Navigation) e o card do hub (PrivacyConsentSection) precisam ver o MESMO estado. Se cada um
 * tivesse sua instância, revogar no card não travaria o app (o guard não saberia) — foi exatamente
 * o bug pego no smoke. O Provider dá uma fonte só, e qualquer superfície chama `refresh` após
 * grant/revoke para reavaliar a trava na hora.
 */
function useConsentGateState(
  session: Session | null | undefined,
  canAutoWrite: boolean,
  verificationPending: boolean,
): ConsentGateValue {
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

    // Spec 091 (RC5 + RC6): `missing` lido ANTES de a conta ser confirmada não é decisão — a
    // materialização do cadastro (que só roda com `confirmed`) ainda pode virá-lo `granted`, e as
    // sessões de cortesia ainda não foram contadas. Decidir ali fazia o pedido piscar para quem já
    // consentiu e trocava a trava por pedido dispensável. Então, SÓ nesse caso, o gate espera a
    // verificação. Qualquer outro estado (ou leitura falhando, como offline) decide na hora — o
    // boot não pode ficar preso numa ida à rede (AP-303: indeterminado não é bloqueio).
    let awaitVerification = false
    try {
      // Idempotente e defensivo: não materializa sobre um `revoked` e não escreve nada se não
      // conseguiu LER a trilha. `user_metadata` é carona da intenção — quem carimba é o RPC.
      // Spec 091 (INV-3): só depois de o servidor confirmar que a conta existe. O `user_metadata`
      // vem do TOKEN em cache — conta excluída em outro aparelho re-concedia consentimento (2×
      // `consent_grant` no smoke, barradas só pela FK).
      if (canAutoWrite) {
        await consentService.materializeSignupIntent(
          session.user?.user_metadata as { health_consent?: boolean; policy_version?: string } | undefined,
          'mobile',
        )
      }

      const current = await consentService.getStatus('health_data')
      if (current.status === 'missing' && verificationPending) {
        awaitVerification = true
        return
      }

      // Sessão de prompt só conta quando SABEMOS que o titular nunca se manifestou. Se a leitura
      // acima tivesse lançado, este trecho não rodaria — que é o ponto.
      let sessions = 0
      if (current.status === 'missing' && canAutoWrite) {
        const bumped = await profileRepo.bumpConsentPromptSession()
        sessions = bumped.sessions
      }

      setState(current)
      setPromptSessions(sessions)
    } catch {
      setState(null)
      setPromptSessions(0)
    } finally {
      setReady(!awaitVerification)
      // Avisa os bridges de superfície (fora do Provider) que o consentimento foi reavaliado —
      // grant/revoke in-app não passam por foreground, então sem este sinal as superfícies locais só
      // reagiriam no próximo ciclo de foreground (alarme já agendado dispararia nesse meio-tempo).
      triggerConsentChange()
    }
  }, [session, canAutoWrite, verificationPending])

  const grant = useCallback(async () => {
    const res = await consentService.grant('health_data', 'mobile')
    if (res.ok) await refresh()
    return res
  }, [refresh])

  const dismiss = useCallback(() => setDismissed(true), [])

  // R-010: os memos vêm depois dos useCallback porque dependem deles — ordem imposta pela
  // dependência, não por descuido.
  // eslint-disable-next-line no-restricted-syntax
  const decision = useMemo(() => resolveConsentGate({ state, promptSessions }), [state, promptSessions])

  // R-010: o memo do valor depende de `refresh`/`grant` (useCallback) — a ordem aqui é imposta pela
  // dependência, não por descuido.
  // eslint-disable-next-line no-restricted-syntax
  const value = useMemo(
    () => ({ ...decision, ready, state, dismissed, dismiss, grant, refresh }),
    [decision, ready, state, dismissed, dismiss, grant, refresh],
  )

  // Sincroniza com um sistema externo (a trilha no backend): o setState acontece no callback
  // assíncrono de `refresh`, não no corpo do effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  // Revalidação multi-superfície: o consentimento é POLÍTICA DE CONTA, não estado local. Se o
  // titular autorizou/revogou em OUTRA superfície (outro device, a web) enquanto esta estava em
  // background, a tela minimizada que volta ao foreground precisa reler o estado — senão continua
  // pedindo autorização já concedida (ou libera acesso já revogado). Ponto de retomada = o app
  // voltar a 'active'. Sem polling. `refresh` só muda quando a sessão muda (raro), então o listener
  // recria pouquíssimas vezes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  return value
}

// ── Provider / Context ────────────────────────────────────────────────────────
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

export function ConsentGateProvider({
  session,
  canAutoWrite = false,
  verificationPending = false,
  children,
}: {
  session: Session | null | undefined
  /** Spec 091: servidor confirmou a conta — libera materialização e contagem de prompt. */
  canAutoWrite?: boolean
  /** Spec 091: servidor ainda não respondeu (`checking`) — o gate espera em vez de decidir. */
  verificationPending?: boolean
  children: ReactNode
}) {
  const value = useConsentGateState(session, canAutoWrite, verificationPending)
  return <ConsentGateContext.Provider value={value}>{children}</ConsentGateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConsentGate(): ConsentGateValue {
  return useContext(ConsentGateContext)
}
