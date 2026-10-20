import { describe, it, expect, afterEach, vi } from 'vitest'
import { pruneSection, noticesComplete, nextMilestone, addDays } from '../pruneRules.js'

/** FR-014 — cada linha mora numa seção só, pela próxima ação do admin. */

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

const INICIO = '2026-07-01T12:00:00.000Z'
const ELEG = addDays(INICIO, 90)
const dia = (n: number) => new Date(Date.parse(addDays(INICIO, n)))
const row = (extra: Partial<{ reason: string; decision: string; eligible_at: string }> = {}) =>
  ({ reason: 'revoked_90d', scheduled_at: INICIO, eligible_at: ELEG, decision: 'pending', executed_at: null, ...extra })
const ctx = (sent: number, extra: Partial<{ hasReaviso: boolean; legacyGate: boolean }> = {}) =>
  ({ sentSinceStart: sent, hasReaviso: false, legacyGate: true, ...extra })

describe('pruneSection', () => {
  it('mapa dia × avisos → seção', () => {
    const casos: Array<[number, number, string, string | null]> = [
      [30, 0, 'counting', null],
      [60, 0, 'email', 'd60'],
      [60, 1, 'counting', null],
      [83, 1, 'email', 'd83'],
      [85, 2, 'decide', null],      // janela de 7 dias antes do prazo
      [90, 2, 'decide', null],
      [91, 1, 'blocked', 'reaviso'], // perdeu o D+83
      [91, 0, 'blocked', 'reaviso'], // cron caiu a janela inteira
    ]
    for (const [d, sent, section, due] of casos) {
      const s = pruneSection(row(), ctx(sent), dia(d))
      expect([d, sent, s.section, s.notice_due]).toEqual([d, sent, section, due])
    }
  })

  it('reaviso marcado destrava; aprovada vai para approved; legado sem gate fica bloqueado', () => {
    expect(pruneSection(row(), ctx(0, { hasReaviso: true }), dia(91)).section).toBe('decide')
    expect(pruneSection(row({ decision: 'approved' }), ctx(0), dia(91)).section).toBe('approved')
    expect(pruneSection(row({ reason: 'legacy_no_consent' }), ctx(2, { legacyGate: false }), dia(91)))
      .toEqual({ section: 'blocked', notice_due: null, block: 'legacy_gate' })
  })

  it('noticesComplete e nextMilestone', () => {
    expect(noticesComplete(1, false)).toBe(false)
    expect(noticesComplete(2, false)).toBe(true)
    expect(noticesComplete(0, true)).toBe(true)
    expect(nextMilestone(row(), dia(10))).toEqual({ label: 'D+60', at: addDays(INICIO, 60) })
    expect(nextMilestone(row(), dia(70))).toEqual({ label: 'D+83', at: addDays(INICIO, 83) })
    expect(nextMilestone(row(), dia(84))).toEqual({ label: 'prazo', at: ELEG })
  })
})
