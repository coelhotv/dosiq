import { describe, it, expect, afterEach, vi } from 'vitest'
import { hasAuthSignal, AUTH_STORAGE_KEY_RE, RECOVERY_FLOW_KEY } from '../authSignal'

function makeStorage(entries: Record<string, string> = {}) {
  const keys = Object.keys(entries)
  return {
    length: keys.length,
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => (k in entries ? entries[k] : null),
  }
}

function loc(search = '', hash = '') {
  return { search, hash }
}

describe('hasAuthSignal (spec 112 PO-112-2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('storage vazio e URL limpa → false (visitante anônimo)', () => {
    expect(hasAuthSignal(makeStorage(), loc())).toBe(false)
  })

  it('sessão salva (sb-<ref>-auth-token) → true', () => {
    expect(hasAuthSignal(makeStorage({ 'sb-abcdef-auth-token': '{}' }), loc())).toBe(true)
  })

  it('só o code-verifier do PKCE não conta como sessão', () => {
    expect(hasAuthSignal(makeStorage({ 'sb-abcdef-auth-token-code-verifier': 'x' }), loc())).toBe(false)
  })

  it('chaves alheias não contam', () => {
    expect(hasAuthSignal(makeStorage({ '@dosiq/chunk-reload': '1', 'sb-x': '1' }), loc())).toBe(false)
  })

  it('retorno de magic link (#access_token) com storage vazio → true', () => {
    expect(hasAuthSignal(makeStorage(), loc('', '#access_token=abc&type=magiclink'))).toBe(true)
  })

  it('erro de auth no hash (#error_description) → true', () => {
    expect(hasAuthSignal(makeStorage(), loc('', '#error=access_denied&error_description=expired'))).toBe(true)
  })

  it('PKCE (?code=) → true', () => {
    expect(hasAuthSignal(makeStorage(), loc('?code=123'))).toBe(true)
  })

  it('link de recuperação (type=recovery) → true', () => {
    expect(hasAuthSignal(makeStorage(), loc('', '#type=recovery'))).toBe(true)
  })

  it('flag de recovery no storage → true', () => {
    expect(hasAuthSignal(makeStorage({ [RECOVERY_FLOW_KEY]: 'true' }), loc())).toBe(true)
  })

  it('hash de âncora comum (#solucoes) e query de marketing → false', () => {
    expect(hasAuthSignal(makeStorage(), loc('?utm_source=x', '#solucoes'))).toBe(false)
  })

  it('storage que lança (modo privado estrito) ainda avalia a URL', () => {
    const broken = {
      get length(): number { throw new Error('denied') },
      key: () => { throw new Error('denied') },
      getItem: () => { throw new Error('denied') },
    }
    expect(hasAuthSignal(broken, loc())).toBe(false)
    expect(hasAuthSignal(broken, loc('', '#access_token=a'))).toBe(true)
  })

  it('AUTH_STORAGE_KEY_RE segue o formato default do supabase-js', () => {
    expect(AUTH_STORAGE_KEY_RE.test('sb-ikcvwxyohmntncanclze-auth-token')).toBe(true)
  })
})
