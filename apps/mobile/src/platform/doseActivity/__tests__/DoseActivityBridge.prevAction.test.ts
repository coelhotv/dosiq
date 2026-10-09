// Spec 101 (C-3 / PO-101-7): a dose que estava na superfície sai do seletor por ADIAMENTO ⇒ a
// superfície é reprogramada, não encerrada (endDoseActivity mataria o trigger do reaparecimento).
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))
jest.mock('@platform/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@platform/consent/useConsentSuppressed', () => ({ useConsentSuppressed: () => false }))
jest.mock('@dashboard/services/dashboardService', () => ({}))

import { prevSurfaceAction } from '../DoseActivityBridge'
import { mergeSnoozeAnchors } from '@platform/alarms/snoozeAnchorStore'

const NOW = new Date('2026-03-05T12:00:00.000Z')
const M = 60_000
const iso = (min: number) => new Date(NOW.getTime() + min * M).toISOString()
const item = (over = {}) => ({ instanceId: 'i1', scheduledFor: iso(-35), status: 'pending', critical: true, ...over })

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('prevSurfaceAction (spec 101 C-3)', () => {
  it('dose adiada (âncora futura) ⇒ defer', () => {
    expect(prevSurfaceAction(item({ snoozedUntil: iso(5) }), NOW)).toBe('defer')
  })

  it('🔴 PO-101-7: setSnoozedUntil falhou (banco null) mas há âncora local ⇒ defer', () => {
    const [merged] = mergeSnoozeAnchors([item({ snoozedUntil: null })], { i1: NOW.getTime() + 5 * M })
    expect(prevSurfaceAction(merged, NOW)).toBe('defer')
  })

  it('sem soneca / resolvida / âncora vencida ⇒ end', () => {
    expect(prevSurfaceAction(item(), NOW)).toBe('end')
    expect(prevSurfaceAction(undefined, NOW)).toBe('end')
    expect(prevSurfaceAction(item({ snoozedUntil: iso(-20) }), NOW)).toBe('end')
    expect(prevSurfaceAction(item({ snoozedUntil: 'lixo' }), NOW)).toBe('end')
  })
})
