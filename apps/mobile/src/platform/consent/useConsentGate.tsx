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
function useConsentGateState(session: Session | null | undefined): ConsentGateValue {
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
      // Idempotente e defensivo: não materializa sobre um `revoked` e não escreve nada se não
      // conseguiu LER a trilha. `user_metadata` é carona da intenção — quem carimba é o RPC.
      await consentService.materializeSignupIntent(
        session.user?.user_metadata as { health_consent?: boolean; policy_version?: string } | undefined,
        'mobile',
      )

      const current = await consentService.getStatus('health_data')

      // Sessão de prompt só conta quando SABEMOS que o titular nunca se manifestou. Se a leitura
      // acima tivesse lançado, este trecho não rodaria — que é o ponto.
      let sessions = 0
      if (current.status === 'missing') {
        const bumped = await profileRepo.bumpConsentPromptSession()
        sessions = bumped.sessions
      }

      setState(current)
      setPromptSessions(sessions)
    } catch {
      setState(null)
      setPromptSessions(0)
    } finally {
      setReady(true)
      // Avisa os bridges de superfície (fora do Provider) que o consentimento foi reavaliado —
      // grant/revoke in-app não passam por foreground, então sem este sinal as superfícies locais só
      // reagiriam no próximo ciclo de foreground (alarme já agendado dispararia nesse meio-tempo).
      triggerConsentChange()
    }
  }, [session])

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
  children,
}: {
  session: Session | null | undefined
  children: ReactNode
}) {
  const value = useConsentGateState(session)
  return <ConsentGateContext.Provider value={value}>{children}</ConsentGateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConsentGate(): ConsentGateValue {
  return useContext(ConsentGateContext)
}

export default useConsentGate
