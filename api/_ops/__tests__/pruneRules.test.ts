import { describe, it, expect, afterEach, vi } from 'vitest'
import { pruneSection, noticesComplete, nextMilestone, addDays, atOrAfter } from '../pruneRules.js'

/** FR-014 — cada linha mora numa seção só, pela próxima ação do admin. */

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

const INICIO = '2026-07-01T12:00:00.000Z'
const ELEG = addDays(INICIO, 90)
const dia = (n: number) => new Date(Date.parse(addDays(INICIO, n)))
const row = (extra: Partial<{ reason: string; decision: string; eligible_at: string }> = {}) =>
  ({ reason: 'revoked_90d', scheduled_at: INICIO, eligible_at: ELEG, decision: 'pending', executed_at: null, ...extra })
const ctx = (sent: number, extra: Partial<{ sentSinceD83: number; hasReaviso: boolean; legacyGate: boolean }> = {}) =>
  ({ sentSinceStart: sent, sentSinceD83: 0, hasReaviso: false, legacyGate: true, ...extra })

describe('pruneSection', () => {
  it('mapa dia × avisos → seção', () => {
    // [dia, avisos desde o início, avisos desde o D+83, seção, aviso devido]
    const casos: Array<[number, number, number, string, string | null]> = [
      [30, 0, 0, 'counting', null],
      [60, 0, 0, 'email', 'd60'],
      [60, 1, 0, 'counting', null],
      [83, 1, 0, 'email', 'd83'],
      [83, 0, 0, 'email', 'd83'],     // perdeu o D+60: só o D+83 é pedido…
      [84, 1, 1, 'decide', null],     // …e 1 aviso desde o D+83 basta (sem 2º e-mail D+83)
      [85, 2, 1, 'decide', null],     // janela de 7 dias antes do prazo
      [90, 2, 1, 'decide', null],
      [91, 1, 0, 'blocked', 'reaviso'], // perdeu o D+83
      [91, 0, 0, 'blocked', 'reaviso'], // cron caiu a janela inteira
    ]
    for (const [d, sent, d83, section, due] of casos) {
      const s = pruneSection(row(), ctx(sent, { sentSinceD83: d83 }), dia(d))
      expect([d, sent, d83, s.section, s.notice_due]).toEqual([d, sent, d83, section, due])
    }
  })

  it('reaviso marcado destrava; aprovada vai para approved; legado sem gate fica bloqueado', () => {
    expect(pruneSection(row(), ctx(0, { hasReaviso: true }), dia(91)).section).toBe('decide')
    expect(pruneSection(row({ decision: 'approved' }), ctx(0), dia(91)).section).toBe('approved')
    expect(pruneSection(row({ reason: 'legacy_no_consent' }), ctx(2, { legacyGate: false }), dia(91)))
      .toEqual({ section: 'blocked', notice_due: null, block: 'legacy_gate' })
  })

  it('FR-016: cadastro não confirmado não passa por avisos — decide pela data', () => {
    const nc = row({ reason: 'unconfirmed_signup', eligible_at: addDays(INICIO, 90) })
    expect(pruneSection(nc, ctx(0), dia(70))).toEqual({ section: 'counting', notice_due: null, block: null })
    expect(pruneSection(nc, ctx(0), dia(91))).toEqual({ section: 'decide', notice_due: null, block: null })
  })

  it('noticesComplete e nextMilestone', () => {
    expect(noticesComplete(1, false)).toBe(false)
    expect(noticesComplete(2, false)).toBe(true)
    expect(noticesComplete(0, true)).toBe(true)
    expect(noticesComplete(1, false, 1)).toBe(true) // só o D+83
    expect(nextMilestone(row(), dia(10))).toEqual({ label: 'D+60', at: addDays(INICIO, 60) })
    expect(nextMilestone(row(), dia(70))).toEqual({ label: 'D+83', at: addDays(INICIO, 83) })
    expect(nextMilestone(row(), dia(84))).toEqual({ label: 'prazo', at: ELEG })
  })

  it('atOrAfter compara instante, não texto (RC6 #894: +00:00 vs Z na fronteira)', () => {
    // lexicograficamente '…00+00:00' < '…00.000Z' ('+' < '.'), mas é o MESMO instante
    expect(atOrAfter('2026-10-20T03:00:00+00:00', '2026-10-20T03:00:00.000Z')).toBe(true)
    expect(atOrAfter('2026-10-20T02:59:59.999+00:00', '2026-10-20T03:00:00.000Z')).toBe(false)
  })
})
