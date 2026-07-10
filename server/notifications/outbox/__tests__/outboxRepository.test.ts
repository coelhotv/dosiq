// Testes para outboxRepository — enqueue/claim/markSent/markFailed (spec 043 Slice A)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createOutboxRepository, MAX_OUTBOX_ATTEMPTS } from '../outboxRepository.js'
import type { OutboxSupabaseClient } from '../outboxRepository.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function makeClient(overrides: Partial<{ upsertError: any; rpcError: any; updateError: any; rpcData: any }> = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: overrides.upsertError ?? null })
  const eq = vi.fn().mockResolvedValue({ error: overrides.updateError ?? null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ upsert, update }))
  const rpc = vi.fn().mockResolvedValue({ data: overrides.rpcData ?? [], error: overrides.rpcError ?? null })
  const client = { from, rpc } as unknown as OutboxSupabaseClient
  return { client, from, upsert, update, eq, rpc }
}

describe('createOutboxRepository', () => {
  describe('enqueue', () => {
    it('monta rows e chama upsert com onConflict user_id,kind,period_key e ignoreDuplicates', async () => {
      const { client, from, upsert } = makeClient()
      const repo = createOutboxRepository({ client })

      const count = await repo.enqueue([
        { userId: 'u1', kind: 'daily_adherence', periodKey: '2026-07-10' },
      ])

      expect(from).toHaveBeenCalledWith('notification_outbox')
      expect(upsert).toHaveBeenCalledWith(
        [{ user_id: 'u1', kind: 'daily_adherence', period_key: '2026-07-10' }],
        { onConflict: 'user_id,kind,period_key', ignoreDuplicates: true }
      )
      expect(count).toBe(1)
    })

    it('enqueue([]) retorna 0 sem chamar o client', async () => {
      const { client, from } = makeClient()
      const repo = createOutboxRepository({ client })

      const count = await repo.enqueue([])

      expect(count).toBe(0)
      expect(from).not.toHaveBeenCalled()
    })

    it('propaga erro do client como throw', async () => {
      const { client } = makeClient({ upsertError: { message: 'conflict boom' } })
      const repo = createOutboxRepository({ client })

      await expect(
        repo.enqueue([{ userId: 'u1', kind: 'stock_alert', periodKey: '2026-07-10' }])
      ).rejects.toThrow('outbox.enqueue: conflict boom')
    })
  })

  describe('claim', () => {
    it('chama rpc claim_notification_outbox com batch_limit e retorna data', async () => {
      const rows = [{ id: 'row-1' }]
      const { client, rpc } = makeClient({ rpcData: rows })
      const repo = createOutboxRepository({ client })

      const result = await repo.claim(10)

      expect(rpc).toHaveBeenCalledWith('claim_notification_outbox', { batch_limit: 10 })
      expect(result).toEqual(rows)
    })

    it('usa batch_limit default quando não informado', async () => {
      const { client, rpc } = makeClient()
      const repo = createOutboxRepository({ client })

      await repo.claim()

      expect(rpc).toHaveBeenCalledWith('claim_notification_outbox', { batch_limit: 25 })
    })

    it('propaga erro do client como throw', async () => {
      const { client } = makeClient({ rpcError: { message: 'rpc boom' } })
      const repo = createOutboxRepository({ client })

      await expect(repo.claim()).rejects.toThrow('outbox.claim: rpc boom')
    })
  })

  describe('markSent', () => {
    it('atualiza status sent, sent_at via now injetado e channel_results; filtra por id', async () => {
      const now = vi.fn(() => '2026-07-10T12:00:00.000Z')
      const { client, update, eq } = makeClient()
      const repo = createOutboxRepository({ client, now })

      const channelResults = [{ channel: 'telegram', attempted: 1, delivered: 1, failed: 0 }]
      await repo.markSent('row-1', channelResults)

      expect(update).toHaveBeenCalledWith({
        status: 'sent',
        sent_at: '2026-07-10T12:00:00.000Z',
        channel_results: channelResults,
      })
      expect(eq).toHaveBeenCalledWith('id', 'row-1')
    })

    it('propaga erro do client como throw', async () => {
      const { client } = makeClient({ updateError: { message: 'update boom' } })
      const repo = createOutboxRepository({ client })

      await expect(repo.markSent('row-1', [])).rejects.toThrow('outbox.markSent: update boom')
    })
  })

  describe('markFailed', () => {
    it('attempts >= MAX_OUTBOX_ATTEMPTS marca status failed', async () => {
      const { client, update, eq } = makeClient()
      const repo = createOutboxRepository({ client })

      await repo.markFailed('row-1', MAX_OUTBOX_ATTEMPTS)

      expect(update).toHaveBeenCalledWith({ status: 'failed', claimed_at: null })
      expect(eq).toHaveBeenCalledWith('id', 'row-1')
    })

    it('attempts < MAX_OUTBOX_ATTEMPTS volta para pending (retry)', async () => {
      const { client, update } = makeClient()
      const repo = createOutboxRepository({ client })

      await repo.markFailed('row-1', MAX_OUTBOX_ATTEMPTS - 1)

      expect(update).toHaveBeenCalledWith({ status: 'pending', claimed_at: null })
    })

    it('inclui channel_results no patch quando informado', async () => {
      const { client, update } = makeClient()
      const repo = createOutboxRepository({ client })
      const channelResults = [{ channel: 'mobile_push', attempted: 1, delivered: 0, failed: 1 }]

      await repo.markFailed('row-1', 1, channelResults)

      expect(update).toHaveBeenCalledWith({ status: 'pending', claimed_at: null, channel_results: channelResults })
    })

    it('propaga erro do client como throw', async () => {
      const { client } = makeClient({ updateError: { message: 'fail boom' } })
      const repo = createOutboxRepository({ client })

      await expect(repo.markFailed('row-1', 1)).rejects.toThrow('outbox.markFailed: fail boom')
    })
  })

  describe('revertClaim', () => {
    it('decrementa attempts (clamp em 0) e filtra por id', async () => {
      const { client, update, eq } = makeClient()
      const repo = createOutboxRepository({ client })

      await repo.revertClaim('row-1', 2)
      expect(update).toHaveBeenCalledWith({ status: 'pending', claimed_at: null, attempts: 1 })
      expect(eq).toHaveBeenCalledWith('id', 'row-1')

      await repo.revertClaim('row-2', 0)
      expect(update).toHaveBeenCalledWith({ status: 'pending', claimed_at: null, attempts: 0 })
    })

    it('propaga erro do client como throw', async () => {
      const { client } = makeClient({ updateError: { message: 'revert boom' } })
      const repo = createOutboxRepository({ client })

      await expect(repo.revertClaim('row-1', 1)).rejects.toThrow('outbox.revertClaim: revert boom')
    })
  })
})
