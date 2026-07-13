// Testes do enqueue por RANGE da notification_outbox (spec 043 Slice A + T023b/daily_digest).
//
// Foco: ELEGIBILIDADE. O que entra na fila, quando, e para quem — a decisão que o legado
// tomava por igualdade de minuto (`hhmm !== '09:00' → pula`, família AP-259) e que aqui vira
// janela. A idempotência em si é da UNIQUE (user_id, kind, period_key), testada no repositório.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { enqueueEligibleReports, type EnqueueUserRow } from '../enqueueReports.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function makeRepo() {
  const enqueued: any[] = []
  return {
    repo: { enqueue: vi.fn(async (entries: any[]) => { enqueued.push(...entries) }) } as any,
    enqueued,
  }
}

// Stub do PostgREST: só o caminho .from().select().order().range() usado pelo fetch paginado.
function makeSupabase(users: EnqueueUserRow[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (from: number) => ({ data: from === 0 ? users : [], error: null }),
        }),
      }),
    }),
  } as any
}

// 2026-07-13 é uma SEGUNDA-feira (não domingo, não dia 1) → só o daily_adherence é elegível
// entre os relatórios. 12:00Z = 09:00 em America/Sao_Paulo (GMT-3).
const MONDAY_0900_SP = new Date('2026-07-13T12:00:00Z')

const user = (over: Partial<EnqueueUserRow> = {}): EnqueueUserRow => ({
  user_id: 'u1', timezone: 'America/Sao_Paulo', display_name: 'Ana', ...over,
})

describe('enqueueEligibleReports — kinds migrados', () => {
  it('kind fora de OUTBOX_KINDS não enfileira nada (deploy neutro)', async () => {
    const { repo } = makeRepo()
    const res = await enqueueEligibleReports({
      repo, supabase: makeSupabase([user()]), kinds: new Set(), now: MONDAY_0900_SP,
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
    expect(res.usersScanned).toBe(0)
  })

  it('daily_adherence às 09:00 locais entra na fila com period_key do dia local', async () => {
    const { repo, enqueued } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([user()]), kinds: new Set(['daily_adherence']), now: MONDAY_0900_SP,
    })
    expect(enqueued).toEqual([{ userId: 'u1', kind: 'daily_adherence', periodKey: '2026-07-13' }])
  })

  it('stock_alert NUNCA entra pelo enqueue (fan-out por medicamento não cabe na UNIQUE — spec própria)', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([user()]), kinds: new Set(['stock_alert']), now: MONDAY_0900_SP,
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })
})

describe('enqueueEligibleReports — daily_digest (T023b)', () => {
  const digestUser = (over: Partial<EnqueueUserRow> = {}) =>
    user({ notification_mode: 'digest_morning', digest_time: '07:00', ...over })

  // 10:00Z = 07:00 SP
  const at = (iso: string) => new Date(iso)

  it('enfileira no horário escolhido pelo usuário (07:00 local), não às 09:00', async () => {
    const { repo, enqueued } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser()]), kinds: new Set(['daily_digest']),
      now: at('2026-07-13T10:00:00Z'),
    })
    expect(enqueued).toEqual([{ userId: 'u1', kind: 'daily_digest', periodKey: '2026-07-13' }])
  })

  it('a janela é [digest_time, +10min) — um tick que PULA o minuto exato ainda pega o digest (AP-259)', async () => {
    const { repo, enqueued } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser()]), kinds: new Set(['daily_digest']),
      now: at('2026-07-13T10:07:00Z'), // 07:07 SP — o legado (hhmm === '07:00') teria perdido o dia
    })
    expect(enqueued).toHaveLength(1)
  })

  it('fora da janela não enfileira (07:10 local já passou dos 10min)', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser()]), kinds: new Set(['daily_digest']),
      now: at('2026-07-13T10:10:00Z'),
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  it('quem NÃO está em digest_morning nunca entra (recebe lembrete por dose)', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ notification_mode: 'per_dose' })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T10:00:00Z'),
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  it('digest_time ausente → default 07:00 (paridade com o legado)', async () => {
    const { repo, enqueued } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ digest_time: null })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T10:00:00Z'),
    })
    expect(enqueued).toHaveLength(1)
  })

  it('digest_time corrompido → não enfileira (nunca chuta um horário)', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ digest_time: 'quinze horas' })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T10:00:00Z'),
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  it('a janela é do tz DO USUÁRIO: 07:00 em Lisboa não dispara quando são 07:00 em SP', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ timezone: 'Europe/Lisbon' })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T10:00:00Z'), // 07:00 SP = 11:00 Lisboa
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  // A janela ATRAVESSA a fronteira de hora de propósito (review #742): a data local só vira à
  // meia-noite, então 09:55 + 7min = 10:02 ainda é o mesmo period_key. Prender a janela na
  // mesma hora daria 5min a quem escolhe 09:55 e 1min a quem escolhe 09:59 — a perda por tick
  // pulado que a janela existe p/ evitar.
  it('digest com hora quebrada (09:55) AINDA entra às 10:02 (7min depois — janela cruza a hora)', async () => {
    const { repo, enqueued } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ digest_time: '09:55' })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T13:02:00Z'), // 10:02 SP
    })
    expect(enqueued).toHaveLength(1)
  })

  it('digest 09:55 não entra às 10:06 (11min depois — fora da janela)', async () => {
    const { repo } = makeRepo()
    await enqueueEligibleReports({
      repo, supabase: makeSupabase([digestUser({ digest_time: '09:55' })]),
      kinds: new Set(['daily_digest']), now: at('2026-07-13T13:06:00Z'), // 10:06 SP
    })
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  it('tz corrompida de UM usuário não derruba o enqueue dos outros', async () => {
    const { repo, enqueued } = makeRepo()
    const users = [digestUser({ user_id: 'bad', timezone: 'Nao/Existe' }), digestUser({ user_id: 'ok' })]
    await enqueueEligibleReports({
      repo, supabase: makeSupabase(users), kinds: new Set(['daily_digest']),
      now: at('2026-07-13T10:00:00Z'),
    })
    expect(enqueued.map(e => e.userId)).toEqual(['ok'])
  })
})
