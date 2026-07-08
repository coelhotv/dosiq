import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFeedbackRepository } from '../createFeedbackRepository'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result: any) {
  const builder = {
    _calls: [],
    insert: vi.fn(function (...args) { this._calls.push(['insert', args]); return this }),
    select: vi.fn(function (...args) { this._calls.push(['select', args]); return this }),
    single: vi.fn(function ()        { this._calls.push(['single', []]); return Promise.resolve(result) }),
  }
  return builder
}

function makeClient(result: any) {
  const builder = makeBuilder(result)
  const client = {
    _builder: builder,
    _from: null,
    from: vi.fn((table: any) => { client._from = table; return builder }),
  }
  return client as any
}

const FAKE_USER = 'user-uuid-999'
const getUserId = async () => FAKE_USER

const VALID_FEEDBACK = {
  subject: 'Bug na tela inicial',
  comment: 'Ao girar o celular de lado a tela corta pela metade.',
  rating: 4,
  platform: 'android',
  device: 'Motorola G60',
  app_version: '3.3.0'
}

describe('createFeedbackRepository', () => {
  let client: any

  beforeEach(() => {
    client = makeClient({ data: { id: 'feedback-uuid-1', ...VALID_FEEDBACK, user_id: FAKE_USER }, error: null })
  })

  it('throws if client missing', () => {
    expect(() => createFeedbackRepository({ getUserId } as any)).toThrow(/client/)
  })

  it('throws if getUserId is not a function', () => {
    expect(() => createFeedbackRepository({ client, getUserId: null } as any)).toThrow(/getUserId/)
  })

  describe('submitFeedback', () => {
    it('validates and inserts payload with user_id', async () => {
      const repo = createFeedbackRepository({ client, getUserId })
      const result = await repo.submitFeedback(VALID_FEEDBACK)

      expect(client.from).toHaveBeenCalledWith('feedbacks')
      expect(result.id).toBe('feedback-uuid-1')

      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      expect(insertCall).toBeDefined()
      expect(insertCall[1][0]).toEqual([
        expect.objectContaining({
          subject: 'Bug na tela inicial',
          comment: 'Ao girar o celular de lado a tela corta pela metade.',
          rating: 4,
          platform: 'android',
          device: 'Motorola G60',
          app_version: '3.3.0',
          user_id: FAKE_USER,
        })
      ])
    })

    it('rejects invalid payload with Portuguese validation error', async () => {
      const repo = createFeedbackRepository({ client, getUserId })
      
      await expect(repo.submitFeedback({
        subject: '', // invalid
        comment: 'Comentário legal',
        rating: 3,
        platform: 'ios'
      })).rejects.toThrow(/Erro de validação: subject: O assunto não pode estar vazio/)
    })

    it('throws database error if supabase insertion fails', async () => {
      client = makeClient({ data: null, error: new Error('Database insertion failed') })
      const repo = createFeedbackRepository({ client, getUserId })

      await expect(repo.submitFeedback(VALID_FEEDBACK)).rejects.toThrow('Database insertion failed')
    })
  })
})
