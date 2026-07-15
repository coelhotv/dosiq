// createProfileRepository.consent.test.ts — spec 046 T009.
//
// O contador de sessões do prompt. O que ele precisa garantir: um refresh de página NÃO queima a
// cortesia do titular (senão ele chega ao prompt bloqueante sem nunca ter tido três oportunidades
// reais de responder).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createProfileRepository } from '../createProfileRepository'

const USER_ID = 'user-1'
const getUserId = vi.fn(async () => USER_ID)

/** Client mínimo: `maybeSingle` resolve a leitura; `upsert` registra a escrita. */
function clientWith(row: Record<string, unknown> | null, upsertError: { message: string } | null = null) {
  const upsert = vi.fn(() => Promise.resolve({ error: upsertError }))
  const chain: any = {
    _upsert: upsert,
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
    upsert,
  }
  return chain
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('getConsentPrompt', () => {
  it('sem linha em user_settings → zero sessões (titular novo, cortesia intacta)', async () => {
    const repo = createProfileRepository({ client: clientWith(null), getUserId })

    const prompt = await repo.getConsentPrompt()

    expect(prompt.sessions).toBe(0)
    expect(prompt.lastSeenAt).toBeNull()
  })

  it('lê o contador e o carimbo existentes', async () => {
    const client = clientWith({
      consent_prompt_sessions: 2,
      consent_prompt_last_seen_at: '2026-07-14T10:00:00Z',
    })
    const repo = createProfileRepository({ client, getUserId })

    const prompt = await repo.getConsentPrompt()

    expect(prompt.sessions).toBe(2)
    expect(prompt.lastSeenAt).toBe('2026-07-14T10:00:00Z')
  })
})

describe('bumpConsentPromptSession', () => {
  it('primeiro bootstrap (sem carimbo) → conta a 1ª sessão', async () => {
    const client = clientWith(null)
    const repo = createProfileRepository({ client, getUserId })

    const res = await repo.bumpConsentPromptSession()

    expect(res).toEqual({ sessions: 1, counted: true })
    expect(client._upsert).toHaveBeenCalledTimes(1)
  })

  it('🔴 refresh dentro dos 30 min NÃO conta e NÃO escreve — a cortesia não pode queimar sozinha', async () => {
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const client = clientWith({
      consent_prompt_sessions: 2,
      consent_prompt_last_seen_at: cincoMinutosAtras,
    })
    const repo = createProfileRepository({ client, getUserId })

    const res = await repo.bumpConsentPromptSession()

    expect(res).toEqual({ sessions: 2, counted: false })
    expect(client._upsert).not.toHaveBeenCalled()
  })

  it('gap acima de 30 min → conta a sessão seguinte e carimba', async () => {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const client = clientWith({
      consent_prompt_sessions: 2,
      consent_prompt_last_seen_at: umaHoraAtras,
    })
    const repo = createProfileRepository({ client, getUserId })

    const res = await repo.bumpConsentPromptSession()

    expect(res).toEqual({ sessions: 3, counted: true })
    const written = client._upsert.mock.calls[0][0]
    expect(written.consent_prompt_sessions).toBe(3)
    expect(written.consent_prompt_last_seen_at).toBeTruthy()
    expect(written.user_id).toBe(USER_ID)
  })

  it('erro de escrita propaga (não finge que contou)', async () => {
    const client = clientWith(null, { message: 'permission denied' })
    const repo = createProfileRepository({ client, getUserId })

    await expect(repo.bumpConsentPromptSession()).rejects.toMatchObject({ message: 'permission denied' })
  })
})
