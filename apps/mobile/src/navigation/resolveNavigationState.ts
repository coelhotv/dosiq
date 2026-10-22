// resolveNavigationState — decisão pura do guard raiz (era `_resolveNavigationState` no Navigation).
//
// Spec 096 B3 (E1/E1b, D-3 do RC2): conta com onboarding NÃO concluído vai SEMPRE ao onboarding — o
// consentimento A é colhido no fim dele (S1, `OnboardingConsentStep`). Antes, `missing` mostrava o
// `ConsentPrompt` por cima do wizard e, da 4ª sessão em diante, travava o app ANTES do onboarding. O
// reconsentimento (stale) também espera: o S1 grava A na versão vigente.
// Exceção: `blocked_revoked` trava mesmo no onboarding — a revogação é ato do titular, e a trava é
// onde ficam export e exclusão.
// `missing` + onboarding concluído (legado E6) segue o fluxo de antes (prompt / trava da 107).

export interface NavigationConsentInput {
  ready: boolean
  locked: boolean
  mode: string
  dismissed: boolean
  needsRegularization: boolean
}

export interface ResolveNavigationStateInput {
  session: unknown
  isPasswordRecovery: boolean
  onboardingNeeded: boolean | null
  consent: NavigationConsentInput
  /** Reconsentimento escondido (Não concordo, nas telas de privacidade). */
  regularizationHidden: boolean
  ownerReady: boolean
}

export function resolveNavigationState({
  session,
  isPasswordRecovery,
  onboardingNeeded,
  consent,
  regularizationHidden,
  ownerReady,
}: ResolveNavigationStateInput) {
  const authed = Boolean(session) && !isPasswordRecovery
  const consentPending = authed && !consent.ready
  const isLoading =
    session === undefined || !ownerReady || (authed && onboardingNeeded === null) || consentPending
  const inOnboarding = authed && onboardingNeeded === true && consent.mode !== 'blocked_revoked'
  const consentLocked = authed && consent.locked && !inOnboarding
  const showDismissiblePrompt =
    authed && !inOnboarding && consent.mode === 'prompt_dismissible' && !consent.dismissed
  const showRegularization =
    authed && !inOnboarding && !consentLocked && consent.needsRegularization && !regularizationHidden

  return { isLoading, consentLocked, inOnboarding, showDismissiblePrompt, showRegularization }
}
