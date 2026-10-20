import { describe, it, expect, afterEach, vi } from 'vitest'
import { isCronAuthorized } from '../auth.js'

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

describe('isCronAuthorized (PO-SEC-2)', () => {
  it('só o header exato com o segredo configurado passa', () => {
    expect(isCronAuthorized('Bearer s3gr3d0', 's3gr3d0')).toBe(true)
  })

  it('ausente, errado, quase-certo, sem Bearer ou não-string ⇒ recusa', () => {
    for (const h of [undefined, '', 'Bearer errado', 'Bearer s3gr3d', 'Bearer s3gr3d0 ', 's3gr3d0', ['Bearer s3gr3d0'], 42]) {
      expect(isCronAuthorized(h, 's3gr3d0')).toBe(false)
    }
  })

  it('fail-closed sem CRON_SECRET — "Bearer undefined" não abre a porta', () => {
    expect(isCronAuthorized('Bearer undefined', undefined)).toBe(false)
    expect(isCronAuthorized('Bearer ', '')).toBe(false)
  })
})
