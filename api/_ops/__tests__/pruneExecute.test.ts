import { describe, it, expect, afterEach, vi } from 'vitest'
import { runPruneExecute } from '../pruneExecute.js'
import { createFakeSupabase } from './fakeSupabase.js'

/**
 * 107 PO-1 — o executor apaga SOMENTE linha approved cuja condição ainda vale.
 * Exercita a mesma `checkEligibility` e o mesmo `executeDeletion` da produção (boundary da PO):
 * só o banco é fake, e o fake avalia os filtros de verdade.
 */

const AGORA = new Date('2027-02-01T13:00:00Z')
const ARMADO = { CONSENT_PRUNE_MODE: 'armed' }
const ADMIN = '00000000-0000-0000-0000-0000000000ad'
const ontem = '2027-01-31T13:00:00.000Z'

const user = (id: string) => ({ id, email: `${id}@x.test`, created_at: '2026-01-01T00:00:00Z' })
const linha = (id: string, user_id: string, extra: Record<string, any> = {}) => ({
  id, user_id, reason: 'revoked_90d', scheduled_at: '2026-11-01T00:00:00Z', eligible_at: ontem,
  decision: 'approved', decided_at: ontem, decided_by: ADMIN, executed_at: null, ...extra,
})
const revogou = (user_id: string) => ([
  { user_id, consent_type: 'health_data', action: 'granted', created_at: '2026-06-01T00:00:00Z', seq: 1 },
  { user_id, consent_type: 'health_data', action: 'revoked', created_at: '2026-11-01T00:00:00Z', seq: 2 },
])

function cenario() {
  return createFakeSupabase({
    users: ['u1', 'u2', 'u4', 'u5'].map(user), // u3 se autoexcluiu
    tables: {
      prune_queue: [
        linha('q1', 'u1'),
        linha('q2', 'u2'),
        linha('q3', 'u3'),
        linha('q4', 'u4', { decision: 'pending', decided_at: null, decided_by: null }),
        linha('q5', 'u5', { decision: 'deferred', note: 'falar com o titular', reevaluate_at: '2027-02-10T00:00:00Z' }),
      ],
      consent_log: [
        ...revogou('u1'),
        ...revogou('u2'),
        { user_id: 'u2', consent_type: 'health_data', action: 'granted', created_at: '2027-01-31T20:00:00Z', seq: 3 },
        ...revogou('u4'),
        ...revogou('u5'),
      ],
    },
  }, () => AGORA.toISOString())
}

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

describe('runPruneExecute (PO-1)', () => {
  it('apaga só o approved válido; re-consentiu e autoexcluiu viram void; pending/deferred intactos', async () => {
    const { supabase, rpcCalls, state } = cenario()
    const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })

    expect(r).toMatchObject({ approved: 3, executed: 1, voided: 2, aborted: false })
    expect(rpcCalls.filter((c) => c.fn === 'delete_user_account_by_id').map((c) => c.args.p_user_id)).toEqual(['u1'])
    // `pruned` gravado antes da exclusão (ordem da 046, ADR-093)
    expect(rpcCalls.map((c) => c.fn)).toEqual(['consent_controller_event', 'delete_user_account_by_id'])

    const q = Object.fromEntries(state.tables.prune_queue.map((x) => [x.id, x]))
    expect(q.q1.executed_at).toBe(AGORA.toISOString())
    expect(q.q2).toMatchObject({ decision: 'void', void_reason: 'granted', executed_at: null })
    expect(q.q3).toMatchObject({ decision: 'void', void_reason: 'self_deleted' })
    expect(q.q4).toMatchObject({ decision: 'pending', executed_at: null })
    expect(q.q5).toMatchObject({ decision: 'deferred', executed_at: null })
    expect(state.tables.prune_queue_audit.map((a) => [a.queue_id, a.action])).toEqual(
      expect.arrayContaining([['q1', 'execute'], ['q2', 'void'], ['q3', 'void']]),
    )
  })

  it('2ª execução seguida não apaga nada (idempotente, F-5)', async () => {
    const { supabase, rpcCalls } = cenario()
    await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
    const antes = rpcCalls.length
    const r2 = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
    expect(r2.executed).toBe(0)
    expect(rpcCalls.length).toBe(antes)
  })

  it('guard: acima do teto aborta TUDO e as linhas seguem approved', async () => {
    const { supabase, rpcCalls, state } = cenario()
    const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA, cap: 2 })
    expect(r).toMatchObject({ aborted: true, reason: 'cap_exceeded', executed: 0 })
    expect(rpcCalls).toHaveLength(0)
    expect(state.tables.prune_queue.filter((x) => x.decision === 'approved')).toHaveLength(3)
  })

  it('dry_run (default) não apaga e não mexe na reivindicação', async () => {
    const { supabase, rpcCalls, state } = cenario()
    const r = await runPruneExecute({ supabase, env: {}, now: AGORA })
    expect(r.mode).toBe('dry_run')
    expect(r.dryRunEligible).toBe(1)
    expect(rpcCalls.filter((c) => c.fn === 'delete_user_account_by_id')).toHaveLength(0)
    expect(state.tables.prune_queue.find((x) => x.id === 'q1')?.executed_at).toBeNull()
  })

  it('erro de leitura da conta ⇒ void(unknown), nunca apaga (AP-290)', async () => {
    const { supabase, rpcCalls, state } = cenario()
    state.failures = { 'rpc:prune_account_emails': true }
    const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
    expect(r.executed).toBe(0)
    expect(rpcCalls.filter((c) => c.fn === 'delete_user_account_by_id')).toHaveLength(0)
    expect(state.tables.prune_queue.filter((x) => x.void_reason === 'unknown')).toHaveLength(3)
  })

  it('exclusão falha ⇒ reivindicação desfeita, run abortado (5xx no ops)', async () => {
    const { supabase, state } = cenario()
    const orig = supabase.rpc
    supabase.rpc = async (fn: string, args: any) =>
      fn === 'delete_user_account_by_id' ? { data: null, error: { message: 'boom' } } : orig(fn, args)
    const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
    expect(r).toMatchObject({ aborted: true, reason: 'delete_failed' })
    expect(state.tables.prune_queue.find((x) => x.id === 'q1')).toMatchObject({ decision: 'approved', executed_at: null })
  })
})

describe('runPruneExecute — legado exige kill switch ≥ 0.34 (PO-8, INV-6)', () => {
  const legado = (gates: any[]) => createFakeSupabase({
    users: [user('L1')],
    tables: {
      prune_queue: [linha('qL', 'L1', { reason: 'legacy_no_consent' })],
      consent_log: [],
      app_version_gate: gates,
    },
  }, () => AGORA.toISOString())

  it('gate inativo ou abaixo de 0.34 ⇒ não apaga, linha segue approved', async () => {
    for (const gates of [
      [{ platform: 'ios', min_supported_version: '0.34.0', is_active: false }, { platform: 'android', min_supported_version: '0.34.0', is_active: true }],
      [{ platform: 'ios', min_supported_version: '0.33.9', is_active: true }, { platform: 'android', min_supported_version: '0.34.0', is_active: true }],
      [{ platform: 'android', min_supported_version: '0.34.0', is_active: true }],
    ]) {
      const { supabase, rpcCalls, state } = legado(gates)
      const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
      expect(r.blockedByGate).toBe(1)
      expect(rpcCalls).toHaveLength(0)
      expect(state.tables.prune_queue[0]).toMatchObject({ decision: 'approved', executed_at: null })
    }
  })

  it('gate ativo ≥ 0.34 nas duas plataformas ⇒ apaga (nunca consentiu = elegível, E-1)', async () => {
    const { supabase, rpcCalls } = legado([
      { platform: 'ios', min_supported_version: '0.34.0', is_active: true },
      { platform: 'android', min_supported_version: '0.34.1', is_active: true },
    ])
    const r = await runPruneExecute({ supabase, env: ARMADO, now: AGORA })
    expect(r.executed).toBe(1)
    expect(rpcCalls.map((c) => c.fn)).toEqual(['consent_controller_event', 'delete_user_account_by_id'])
  })
})
