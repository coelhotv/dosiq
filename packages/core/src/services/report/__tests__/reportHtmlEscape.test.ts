// Escape único do template (spec 097 A2 — PO-SEC-3).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeAttr, escapeHtml } from '../reportHtmlEscape'

describe('escapeHtml', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('null/undefined viram texto vazio', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('números viram texto', () => {
    expect(escapeHtml(12.5)).toBe('12.5')
  })

  it.each([
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
    ['</style><script>alert(1)</script>', '&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['"><svg onload=alert(1)>', '&quot;&gt;&lt;svg onload=alert(1)&gt;'],
    ["O'Neil & filhos", 'O&#39;Neil &amp; filhos'],
  ])('neutraliza %s', (input, expected) => {
    expect(escapeHtml(input)).toBe(expected)
  })

  it('escapeAttr é o mesmo escape (atributo sempre entre aspas duplas)', () => {
    expect(escapeAttr('" onmouseover="x')).toBe('&quot; onmouseover=&quot;x')
  })
})
