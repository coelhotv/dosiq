// consentGate.test.ts — spec 046 T009. O que este arquivo protege:
// (1) o estado INDETERMINADO nunca vira `missing` (regressão do furo HIGH do Slice A);
// (2) a allowlist é allowlist mesmo — rota desconhecida fica FORA (anti-deadlock R2/F8).

import { describe, it, expect } from 'vitest'
import {
  resolveConsentGate,
  isConsentAllowedRoute,
  isNewConsentSession,
  CONSENT_PROMPT_FREE_SESSIONS,
  CONSENT_ALLOWED_WEB_VIEWS,
  CONSENT_ALLOWED_MOBILE_ROUTES,
} from '../consentGate'
import type { ConsentState } from '../../schemas/consentSchema'

function state(partial: Partial<ConsentState>): ConsentState {
  return { status: 'missing', policyVersion: null, updatedAt: null, stale: false, ...partial }
}

describe('resolveConsentGate — estado indeterminado (contrato do Slice A)', () => {
  it('state null (leitura falhou) → indeterminate: NÃO libera e NÃO bloqueia', () => {
    const decision = resolveConsentGate({ state: null, promptSessions: 0 })

    expect(decision.mode).toBe('indeterminate')
    expect(decision.locked).toBe(false)
    expect(decision.needsRegularization).toBe(false)
  })

  it('indeterminate NUNCA é tratado como missing — nem com o contador estourado', () => {
    // Se `null` caísse no ramo do `missing`, isto viraria prompt_blocking e o app contaria
    // sessão + materializaria consentimento em cima de um possível `revoked`. É o furo HIGH.
    const decision = resolveConsentGate({ state: null, promptSessions: 99 })

    expect(decision.mode).toBe('indeterminate')
    expect(decision.mode).not.toBe('prompt_blocking')
    expect(decision.locked).toBe(false)
  })
})

describe('resolveConsentGate — estados do titular', () => {
  it('granted na versão vigente → allow, sem regularização', () => {
    const decision = resolveConsentGate({ state: state({ status: 'granted', stale: false }), promptSessions: 0 })

    expect(decision.mode).toBe('allow')
    expect(decision.locked).toBe(false)
    expect(decision.needsRegularization).toBe(false)
  })

  it('granted numa versão antiga → allow + nudge (política nova é ato NOSSO, não trava o titular)', () => {
    const decision = resolveConsentGate({ state: state({ status: 'granted', stale: true }), promptSessions: 0 })

    expect(decision.mode).toBe('allow')
    expect(decision.locked).toBe(false)
    expect(decision.needsRegularization).toBe(true)
  })

  it('revoked → trava na tela de resolução, independente do contador', () => {
    const decision = resolveConsentGate({ state: state({ status: 'revoked' }), promptSessions: 0 })

    expect(decision.mode).toBe('blocked_revoked')
    expect(decision.locked).toBe(true)
  })

  it('missing dentro da cortesia → prompt dispensável (não trava)', () => {
    for (let sessions = 0; sessions <= CONSENT_PROMPT_FREE_SESSIONS; sessions++) {
      const decision = resolveConsentGate({ state: state({ status: 'missing' }), promptSessions: sessions })
      expect(decision.mode).toBe('prompt_dismissible')
      expect(decision.locked).toBe(false)
    }
  })

  it('missing acima da cortesia → prompt bloqueante', () => {
    const decision = resolveConsentGate({
      state: state({ status: 'missing' }),
      promptSessions: CONSENT_PROMPT_FREE_SESSIONS + 1,
    })

    expect(decision.mode).toBe('prompt_blocking')
    expect(decision.locked).toBe(true)
  })

  it('contador corrompido (NaN/negativo) não trava ninguém por acidente', () => {
    expect(resolveConsentGate({ state: state({}), promptSessions: NaN }).mode).toBe('prompt_dismissible')
    expect(resolveConsentGate({ state: state({}), promptSessions: -5 }).mode).toBe('prompt_dismissible')
  })
})

describe('isConsentAllowedRoute — ALLOWLIST, nunca denylist (R2/F8)', () => {
  it('rota desconhecida fica FORA por default — é o que impede o deadlock virar regra', () => {
    expect(isConsentAllowedRoute('rota-que-alguem-criou-ontem', CONSENT_ALLOWED_WEB_VIEWS)).toBe(false)
    expect(isConsentAllowedRoute('dashboard', CONSENT_ALLOWED_WEB_VIEWS)).toBe(false)
    expect(isConsentAllowedRoute(null, CONSENT_ALLOWED_WEB_VIEWS)).toBe(false)
    expect(isConsentAllowedRoute(undefined, CONSENT_ALLOWED_WEB_VIEWS)).toBe(false)
  })

  it('web: a saída da revogação e o caminho do export ficam alcançáveis DENTRO da trava', () => {
    expect(isConsentAllowedRoute('consent-resolution', CONSENT_ALLOWED_WEB_VIEWS)).toBe(true)
    // `profile` é onde vive o ExportDialog (export LGPD do 008 na web).
    expect(isConsentAllowedRoute('profile', CONSENT_ALLOWED_WEB_VIEWS)).toBe(true)
    expect(isConsentAllowedRoute('account-settings', CONSENT_ALLOWED_WEB_VIEWS)).toBe(true)
  })

  it('mobile: resolução, hub de privacidade (export) e exclusão de conta seguem alcançáveis', () => {
    expect(isConsentAllowedRoute('ConsentResolution', CONSENT_ALLOWED_MOBILE_ROUTES)).toBe(true)
    expect(isConsentAllowedRoute('PrivacyData', CONSENT_ALLOWED_MOBILE_ROUTES)).toBe(true)
    expect(isConsentAllowedRoute('DeleteAccount', CONSENT_ALLOWED_MOBILE_ROUTES)).toBe(true)
  })

  it('rotas de produto NÃO entram na allowlist (a trava tem que travar de verdade)', () => {
    expect(isConsentAllowedRoute('Hoje', CONSENT_ALLOWED_MOBILE_ROUTES)).toBe(false)
    expect(isConsentAllowedRoute('Tratamentos', CONSENT_ALLOWED_MOBILE_ROUTES)).toBe(false)
    expect(isConsentAllowedRoute('treatment', CONSENT_ALLOWED_WEB_VIEWS)).toBe(false)
  })
})

describe('isNewConsentSession — gap de 30 min', () => {
  const now = Date.parse('2026-07-14T12:00:00Z')

  it('sem carimbo anterior → é sessão nova (primeiro bootstrap)', () => {
    expect(isNewConsentSession(null, now)).toBe(true)
    expect(isNewConsentSession(undefined, now)).toBe(true)
  })

  it('refresh de página não queima a cortesia do titular', () => {
    const cincoMinutosAtras = new Date(now - 5 * 60 * 1000).toISOString()
    expect(isNewConsentSession(cincoMinutosAtras, now)).toBe(false)
  })

  it('gap acima de 30 min → sessão nova', () => {
    const trintaEUmMinutos = new Date(now - 31 * 60 * 1000).toISOString()
    expect(isNewConsentSession(trintaEUmMinutos, now)).toBe(true)
  })

  it('carimbo corrompido não prende o contador (trata como sessão nova)', () => {
    expect(isNewConsentSession('nao-e-uma-data', now)).toBe(true)
  })
})
