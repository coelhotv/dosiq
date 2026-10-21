// resolveAnalyticsConsent.test.ts — ponte gate → PostHog (spec 096 B3, T040f / CON-034).
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('@platform/analytics/productAnalytics', () => ({ setAnalyticsConsent: jest.fn() }))

import { resolveAnalyticsConsent } from '../useConsentGate'

const granted = { status: 'granted', stale: false } as never
const missing = { status: 'missing' } as never
const revoked = { status: 'revoked' } as never

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('resolveAnalyticsConsent', () => {
  it.each([
    ['sem sessão', false, granted, true, 'pending'],
    ['leitura falhou', true, null, true, 'pending'],
    ['A ainda não dado (onboarding)', true, missing, true, 'pending'],
    ['A retirado', true, revoked, true, 'denied'],
    ['A sem B', true, granted, false, 'denied'],
    ['A e B', true, granted, true, 'allowed'],
  ])('%s ⇒ %s', (_n, session, state, transfer, expected) => {
    expect(resolveAnalyticsConsent(session as boolean, state as never, transfer as boolean)).toBe(expected)
  })
})
