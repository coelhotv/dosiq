// resolveUserTz.test.js — resolução de tz do dono p/ write-path + cron (F4.3f.1)
// Framework: Vitest (@dosiq/web roda os testes do core)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveUserTz, resolveUserTzMap } from '../resolveUserTz.js'

// Mock client Supabase mínimo (chain from().select().eq().maybeSingle() e .in()).
function makeClient({ single, list, throws } = {}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            if (throws) throw new Error('boom')
            return single
          }),
        })),
        in: vi.fn(async () => {
          if (throws) throw new Error('boom')
          return list
        }),
      })),
    })),
  }
}

afterEach(() => vi.clearAllMocks())

describe('resolveUserTz', () => {
  it('retorna o tz do user_settings', async () => {
    const client = makeClient({ single: { data: { timezone: 'Europe/London' }, error: null } })
    expect(await resolveUserTz(client, 'u1')).toBe('Europe/London')
  })

  it('fallback SP quando linha ausente / tz nulo / erro', async () => {
    expect(await resolveUserTz(makeClient({ single: { data: null, error: null } }), 'u1')).toBe('America/Sao_Paulo')
    expect(await resolveUserTz(makeClient({ single: { data: { timezone: null }, error: null } }), 'u1')).toBe('America/Sao_Paulo')
    expect(await resolveUserTz(makeClient({ single: { data: null, error: { code: 'X' } } }), 'u1')).toBe('America/Sao_Paulo')
  })

  it('fallback SP quando userId ausente (sem query)', async () => {
    const client = makeClient({ single: { data: { timezone: 'Europe/London' }, error: null } })
    expect(await resolveUserTz(client, null)).toBe('America/Sao_Paulo')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('nunca lança — exceção do client vira SP', async () => {
    expect(await resolveUserTz(makeClient({ throws: true }), 'u1')).toBe('America/Sao_Paulo')
  })
})

describe('resolveUserTzMap', () => {
  it('mapeia userId→tz e omite sem tz', async () => {
    const client = makeClient({
      list: { data: [{ user_id: 'a', timezone: 'Europe/London' }, { user_id: 'b', timezone: null }], error: null },
    })
    const map = await resolveUserTzMap(client, ['a', 'b', 'a'])
    expect(map.get('a')).toBe('Europe/London')
    expect(map.has('b')).toBe(false)
  })

  it('lista vazia → map vazio sem query', async () => {
    const client = makeClient({ list: { data: [], error: null } })
    const map = await resolveUserTzMap(client, [])
    expect(map.size).toBe(0)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('nunca lança — exceção vira map vazio (caller cai no SP)', async () => {
    const map = await resolveUserTzMap(makeClient({ throws: true }), ['a'])
    expect(map.size).toBe(0)
  })
})
