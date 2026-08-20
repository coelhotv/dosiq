// Testes para drainOutbox — drenador genérico da notification_outbox (spec 043 Slice A)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { drainOutbox } from '../drainOutbox.js'
import type { OutboxRow } from '../outboxRepository.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function makeRow(id: string, kind: OutboxRow['kind'] = 'daily_adherence', overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id,
    user_id: `user-${id}`,
    kind,
    period_key: '2026-07-10',
    subject_id: null,
    status: 'pending',
    attempts: 1,
    channel_results: null,
    created_at: '2026-07-10T00:00:00.000Z',
    claimed_at: null,
    sent_at: null,
    ...overrides,
  }
}

function makeRepo(rows: OutboxRow[]) {
  return {
    claim: vi.fn().mockResolvedValue(rows),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    revertClaim: vi.fn().mockResolvedValue(undefined),
  }
}

const passthroughBuilder = vi.fn(async ({ userId, periodKey }: any) => ({ userId, periodKey }))

describe('drainOutbox', () => {
  // Não-regressão dos 4 kinds migrados (spec 050 T010/SC-002): eles são enfileirados sem assunto,
  // então o builder recebe subjectId null e ignora o campo — nenhuma mudança de comportamento.
  it('kinds sem assunto: builder recebe subjectId null e o envio segue igual', async () => {
    const rows = [makeRow('1'), makeRow('2', 'daily_digest')]
    const repo = makeRepo(rows)
    const dispatcher = { dispatch: vi.fn().mockResolvedValue({ channels: [] }) }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())
    const builder = vi.fn().mockResolvedValue({ ok: true })

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings,
      contentBuilders: { daily_adherence: builder, daily_digest: builder },
    })

    expect(summary.sent).toBe(2)
    expect(builder).toHaveBeenCalledTimes(2)
    for (const call of builder.mock.calls) {
      expect(call[0].subjectId).toBeNull()
    }
  })

  // Fan-out: duas linhas do mesmo usuário/kind/período, distintas só pelo assunto, viram dois
  // envios e cada builder recebe o SEU subjectId (é o que o PR 1b vai consumir).
  it('linhas com assunto: cada builder recebe o seu subject_id', async () => {
    const rows = [
      makeRow('1', 'stock_alert', { user_id: 'u1', subject_id: 'med-1' }),
      makeRow('2', 'stock_alert', { user_id: 'u1', subject_id: 'med-2' }),
    ]
    const repo = makeRepo(rows)
    const dispatcher = { dispatch: vi.fn().mockResolvedValue({ channels: [] }) }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())
    const builder = vi.fn().mockResolvedValue({ ok: true })

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings,
      contentBuilders: { stock_alert: builder },
    })

    expect(summary.sent).toBe(2)
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2)
    const subjects = builder.mock.calls.map((c: any[]) => c[0].subjectId)
    expect(subjects.sort()).toEqual(['med-1', 'med-2'])
  })

  it('claim vazio → summary.claimed=0, nada disparado', async () => {
    const repo = makeRepo([])
    const dispatcher = { dispatch: vi.fn() }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings,
      contentBuilders: { daily_adherence: passthroughBuilder },
    })

    expect(summary.claimed).toBe(0)
    expect(summary.sent).toBe(0)
    expect(summary.failed).toBe(0)
    expect(dispatcher.dispatch).not.toHaveBeenCalled()
  })

  it('retomada K/N: dispatcher falha nas primeiras K → markFailed K vezes, markSent no restante, sem duplicação', async () => {
    const rows = [makeRow('1'), makeRow('2'), makeRow('3'), makeRow('4'), makeRow('5')]
    const K = 2
    const repo = makeRepo(rows)
    const dispatcher = {
      dispatch: vi.fn(async ({ userId }: any) => {
        const idx = Number(userId.replace('user-', ''))
        if (idx <= K) throw new Error(`crash simulado linha ${idx}`)
        return { channels: [] }
      }),
    }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings, poolSize: 5,
      contentBuilders: { daily_adherence: passthroughBuilder },
    })

    expect(summary.sent).toBe(rows.length - K)
    expect(summary.failed).toBe(K)
    expect(repo.markFailed).toHaveBeenCalledTimes(K)
    expect(repo.markSent).toHaveBeenCalledTimes(rows.length - K)
    // cada id processado exatamente 1x (markSent + markFailed somam N, sem overlap de id)
    const failedIds = repo.markFailed.mock.calls.map((c: any[]) => c[0])
    const sentIds = repo.markSent.mock.calls.map((c: any[]) => c[0])
    expect(new Set([...failedIds, ...sentIds]).size).toBe(rows.length)
  })

  it('pool ≤ limite: concorrência corrente nunca excede poolSize', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => makeRow(String(i + 1)))
    const repo = makeRepo(rows)
    const poolSize = 2
    let inFlight = 0
    let maxInFlight = 0
    const dispatcher = {
      dispatch: vi.fn(async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight -= 1
        return { channels: [] }
      }),
    }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())

    await drainOutbox({
      repo, dispatcher, fetchSettings, poolSize,
      contentBuilders: { daily_adherence: passthroughBuilder },
    })

    expect(maxInFlight).toBeLessThanOrEqual(poolSize)
  })

  it('deadline corta lote: summary.deadlineHit=true e linhas restantes não disparam', async () => {
    const rows = [makeRow('1'), makeRow('2'), makeRow('3'), makeRow('4')]
    const repo = makeRepo(rows)
    const dispatcher = { dispatch: vi.fn().mockResolvedValue({ channels: [] }) }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())

    let calls = 0
    // now() avança 0 no start; após a 1ª linha processada, salta além do deadline.
    const now = vi.fn(() => {
      calls += 1
      return calls <= 2 ? 0 : 100_000
    })

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings, now, deadlineMs: 40_000, poolSize: 1,
      contentBuilders: { daily_adherence: passthroughBuilder },
    })

    expect(summary.deadlineHit).toBe(true)
    expect(dispatcher.dispatch.mock.calls.length).toBeLessThan(rows.length)
    // Linhas puladas por deadline revertem o attempts++ do claim (Gemini #734).
    expect(repo.revertClaim.mock.calls.length).toBeGreaterThan(0)
  })

  it('builder retornando null → markSent(id, []) e skippedNoContent++, sem dispatch', async () => {
    const rows = [makeRow('1')]
    const repo = makeRepo(rows)
    const dispatcher = { dispatch: vi.fn() }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())
    const nullBuilder = vi.fn().mockResolvedValue(null)

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings,
      contentBuilders: { daily_adherence: nullBuilder },
    })

    expect(summary.skippedNoContent).toBe(1)
    expect(summary.sent).toBe(0)
    expect(dispatcher.dispatch).not.toHaveBeenCalled()
    expect(repo.markSent).toHaveBeenCalledWith('1', [])
  })

  it('guard PO-3: daily+weekly cada (user,kind) resulta em exatamente 1 dispatch; channel_results sem tokens brutos', async () => {
    const rows = [
      makeRow('1', 'daily_adherence'),
      makeRow('2', 'weekly_adherence'),
    ]
    const repo = makeRepo(rows)
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue({
        channels: [
          { channel: 'mobile_push', attempted: 2, delivered: 1, failed: 1, deactivatedTokens: ['tok'] },
        ],
      }),
    }
    const fetchSettings = vi.fn().mockResolvedValue(new Map())
    const dailyBuilder = vi.fn().mockResolvedValue({ foo: 'bar' })
    const weeklyBuilder = vi.fn().mockResolvedValue({ baz: 'qux' })

    const summary = await drainOutbox({
      repo, dispatcher, fetchSettings,
      contentBuilders: { daily_adherence: dailyBuilder, weekly_adherence: weeklyBuilder },
    })

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2)
    expect(dailyBuilder).toHaveBeenCalledTimes(1)
    expect(weeklyBuilder).toHaveBeenCalledTimes(1)
    expect(summary.sent).toBe(2)

    expect(repo.markSent).toHaveBeenCalledTimes(2)
    for (const call of repo.markSent.mock.calls) {
      const channelResults = call[1]
      expect(channelResults).toEqual([
        { channel: 'mobile_push', attempted: 2, delivered: 1, failed: 1, deactivated_count: 1 },
      ])
      const serialized = JSON.stringify(channelResults)
      expect(serialized).not.toContain('tok')
      expect(serialized).not.toContain('deactivatedTokens')
    }
  })
})
