// resolveNavigationState.test.ts — gate de rota × onboarding (spec 096 B3, T040e).
// 4 estados do consentimento × onboarding concluído/não. Framework: Jest — rodar em apps/mobile/

import { resolveNavigationState } from '../resolveNavigationState'

const MODES = {
  allow: { mode: 'allow', locked: false, needsRegularization: false },
  stale: { mode: 'allow', locked: false, needsRegularization: true },
  dismissible: { mode: 'prompt_dismissible', locked: false, needsRegularization: false },
  blocking: { mode: 'prompt_blocking', locked: true, needsRegularization: false },
  revoked: { mode: 'blocked_revoked', locked: true, needsRegularization: false },
  indeterminate: { mode: 'indeterminate', locked: false, needsRegularization: false },
}

function run(mode: keyof typeof MODES, onboardingNeeded: boolean | null, extra = {}) {
  return resolveNavigationState({
    session: { user: { id: 'u' } },
    isPasswordRecovery: false,
    onboardingNeeded,
    consent: { ready: true, dismissed: false, ...MODES[mode] },
    regularizationHidden: false,
    ownerReady: true,
    ...extra,
  })
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('onboarding NÃO concluído (E1/E1b)', () => {
  it.each(['dismissible', 'blocking', 'indeterminate', 'allow'] as const)('%s ⇒ onboarding, sem prompt nem trava', (mode) => {
    const r = run(mode, true)
    expect(r.inOnboarding).toBe(true)
    expect(r.consentLocked).toBe(false)
    expect(r.showDismissiblePrompt).toBe(false)
  })

  it('stale ⇒ onboarding sem reconsentimento por cima', () => {
    const r = run('stale', true)
    expect(r.inOnboarding).toBe(true)
    expect(r.showRegularization).toBe(false)
  })

  it('revogado ⇒ trava vence (export/exclusão)', () => {
    const r = run('revoked', true)
    expect(r.inOnboarding).toBe(false)
    expect(r.consentLocked).toBe(true)
  })
})

describe('onboarding concluído (legado E6 e contas em dia) — comportamento de antes', () => {
  it('dismissible ⇒ overlay', () => expect(run('dismissible', false).showDismissiblePrompt).toBe(true))
  it('blocking ⇒ trava', () => expect(run('blocking', false).consentLocked).toBe(true))
  it('revogado ⇒ trava', () => expect(run('revoked', false).consentLocked).toBe(true))
  it('stale ⇒ reconsentimento', () => expect(run('stale', false).showRegularization).toBe(true))
  it('stale escondido (Não concordo) ⇒ sem sheet', () =>
    expect(run('stale', false, { regularizationHidden: true }).showRegularization).toBe(false))
  it('allow ⇒ app livre', () => {
    const r = run('allow', false)
    expect([r.consentLocked, r.showDismissiblePrompt, r.showRegularization, r.inOnboarding]).toEqual([false, false, false, false])
  })
})

describe('carregamento', () => {
  it('onboarding ainda não lido ⇒ loading', () => expect(run('allow', null).isLoading).toBe(true))
  it('gate não pronto ⇒ loading', () =>
    expect(run('allow', false, { consent: { ...MODES.allow, ready: false, dismissed: false } }).isLoading).toBe(true))
  it('sem sessão ⇒ nada de consentimento', () => {
    const r = run('blocking', true, { session: null })
    expect([r.consentLocked, r.inOnboarding]).toEqual([false, false])
  })
})
