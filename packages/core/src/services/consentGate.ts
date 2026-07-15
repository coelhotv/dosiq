// consentGate.ts — Máquina de estado do gate de consentimento (spec 046, T009).
//
// Função PURA: recebe o estado lido da trilha + o contador de sessões, devolve o que a UI deve
// fazer. Web e mobile compartilham esta decisão — dois route guards com regras divergentes seriam,
// na prática, duas políticas de consentimento diferentes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// O QUARTO ESTADO É O QUE IMPORTA AQUI
// ─────────────────────────────────────────────────────────────────────────────
// `consentService.getStatus()` LANÇA quando não consegue LER a trilha (contrato do Slice A). Quem
// chama tem que traduzir essa exceção em `status: null` — e NUNCA em `'missing'`. `missing` é uma
// AFIRMAÇÃO ("este titular nunca se manifestou") e uma rede que piscou não afirma nada: tratá-la
// como `missing` faria o app contar uma sessão de prompt, pedir consentimento e — na materialização
// — RESSUSCITAR um consentimento que o titular havia REVOGADO (furo HIGH do review do Slice A,
// família AP-290).
//
// Por isso `indeterminate` não libera NEM bloqueia: é tela de carregamento/erro. Não conta sessão,
// não escreve nada, não decide nada. O próximo bootstrap tenta de novo.

import type { ConsentState, ConsentStatus } from '../schemas/consentSchema'

/** Sessões em que o prompt de consentimento ainda é dispensável. Na 4ª, ele trava. */
export const CONSENT_PROMPT_FREE_SESSIONS = 3

/** Gap mínimo entre bootstraps para contar uma NOVA sessão (30 min). */
export const CONSENT_SESSION_GAP_MS = 30 * 60 * 1000

export type ConsentGateMode =
  /** Consentiu e está em dia — app livre. */
  | 'allow'
  /** Não conseguimos ler a trilha. Não libera, não bloqueia: carregando/erro. */
  | 'indeterminate'
  /** Revogou — app travado na tela de resolução (export | excluir | re-consentir). */
  | 'blocked_revoked'
  /** Nunca se manifestou, dentro da cortesia — prompt dispensável. */
  | 'prompt_dismissible'
  /** Nunca se manifestou e a cortesia acabou — prompt bloqueante. */
  | 'prompt_blocking'

export interface ConsentGateDecision {
  mode: ConsentGateMode
  /** `true` quando o app deve barrar a navegação normal (allowlist ainda vale). */
  locked: boolean
  /** Consentiu numa versão antiga da política — nudge de regularização (não trava). */
  needsRegularization: boolean
}

export interface ResolveConsentGateInput {
  /**
   * Estado lido da trilha, ou `null` quando a LEITURA FALHOU.
   * `null` ≠ `missing`. Ver o cabeçalho — a diferença entre os dois é a regressão do Slice A.
   */
  state: ConsentState | null
  /** Quantas sessões o titular já viu o prompt sem responder. */
  promptSessions: number
}

/**
 * ROTAS LIBERADAS DENTRO DA TRAVA — allowlist, jamais denylist (F8/R2).
 *
 * Uma denylist esquece uma rota e o app vira um deadlock: o titular revogado fica preso numa tela
 * sem conseguir exportar os dados nem excluir a conta — exatamente os direitos que a revogação
 * deveria tornar mais acessíveis, não menos. Aqui, o default é BLOQUEAR: rota nova nasce trancada,
 * e liberar é um ato deliberado (uma linha nesta lista).
 */
export const CONSENT_ALLOWED_WEB_VIEWS = Object.freeze([
  'consent-resolution',
  // `profile` é onde vive o ExportDialog (o export LGPD do 008 na web). Sem ele na allowlist, o
  // titular revogado perde o direito de LEVAR os dados embora — que a revogação deveria facilitar.
  'profile',
  // Logout e conta. (⚠️ A web NÃO tem exclusão de conta hoje — ela só existe no mobile. Não é um
  // deadlock introduzido pela trava: esse caminho nunca existiu aqui. A tela de resolução web
  // aponta o titular para o app. Se a exclusão nascer na web, ela entra NESTA lista.)
  'account-settings',
  'settings',
])

export const CONSENT_ALLOWED_MOBILE_ROUTES = Object.freeze([
  'ConsentResolution',
  // Hub de privacidade do 008: export + política + exclusão. É a rota que sustenta o R2.
  'PrivacyData',
  'DeleteAccount',
  'Perfil',
  'ProfileMain',
])

/** A rota está liberada durante a trava? Default = NÃO (allowlist). */
export function isConsentAllowedRoute(route: string | null | undefined, allowlist: readonly string[]): boolean {
  if (!route) return false
  return allowlist.includes(route)
}

/**
 * Decide o que o guard faz. `status` derivado da trilha + contador de sessões → modo.
 *
 * `stale` (consentiu, mas numa versão antiga da política) NÃO trava: é nudge de regularização
 * (T011). Travar o app de quem consentiu, porque nós publicamos uma política nova, puniria o
 * titular por um ato nosso.
 */
export function resolveConsentGate({ state, promptSessions }: ResolveConsentGateInput): ConsentGateDecision {
  if (!state) {
    return { mode: 'indeterminate', locked: false, needsRegularization: false }
  }

  const status: ConsentStatus = state.status

  if (status === 'revoked') {
    return { mode: 'blocked_revoked', locked: true, needsRegularization: false }
  }

  if (status === 'granted') {
    return { mode: 'allow', locked: false, needsRegularization: state.stale === true }
  }

  // missing — nunca se manifestou.
  const sessions = Number.isFinite(promptSessions) ? Math.max(0, Math.trunc(promptSessions)) : 0
  const blocking = sessions > CONSENT_PROMPT_FREE_SESSIONS
  return {
    mode: blocking ? 'prompt_blocking' : 'prompt_dismissible',
    locked: blocking,
    needsRegularization: false,
  }
}

/**
 * Um novo bootstrap conta como NOVA sessão? (gap > 30 min desde o último visto).
 *
 * Sem o gap, um refresh de página ou um retorno do background queimaria a cortesia do titular em
 * segundos — ele chegaria ao prompt bloqueante sem nunca ter tido três oportunidades reais.
 * Sem carimbo anterior (primeiro bootstrap) ⇒ é sessão.
 */
export function isNewConsentSession(lastSeenAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!lastSeenAt) return true
  const last = Date.parse(lastSeenAt)
  if (Number.isNaN(last)) return true
  return nowMs - last > CONSENT_SESSION_GAP_MS
}

export default resolveConsentGate
