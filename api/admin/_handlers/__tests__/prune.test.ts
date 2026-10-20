import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  handleListPrune,
  handleApprovePrune,
  handleDeferPrune,
  handleRevealPrune,
  handleMarkNoticePrune,
  handleUpdatePruneTexts,
} from '../prune.js'
import { createFakeSupabase } from '../../../_ops/__tests__/fakeSupabase.js'
import { addDays } from '../../../_ops/pruneRules.js'

/**
 * 107 — handler da fila no admin (PO-2, PO-6, PO-8, PO-SEC-1, PO-SEC-3, PO-SEC-6, PO-SEC-9).
 * A trava mora no SERVIDOR: cada recusa abaixo é o que um `curl` direto encontraria.
 */

const ADMIN = 'b0c9746c-c4d9-4954-a198-59856009be26'
const U = 'a9f3e1c2-1111-4222-8333-944455556666'
const LEG = 'c0ffee00-2222-4333-8444-955566667777'
const LEG2 = 'deadbeef-3333-4444-8555-a66677778888'
const P = 'e1e1e1e1-4444-4555-8666-b77788889999' // perdeu os avisos (cron caiu na janela)
const NC = 'abcabcab-5555-4666-8777-c88899990000' // cadastro nunca confirmado (FR-016)

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

function res() {
  const r: any = { statusCode: 0, body: null }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  return r
}

const agora = () => new Date()
const em = (dias: number) => new Date(agora().getTime() + dias * 86_400_000).toISOString()

const aviso = (user_id: string, dias: number, seq: number) =>
  ({ user_id, consent_type: 'health_data', action: 'notice_sent', created_at: em(dias), seq })

function cenario(extra: { gates?: any[]; wave2For?: string[]; semAvisos?: boolean } = {}) {
  // FR-014: por padrão U e LEG receberam o D+60 e o D+83 — aprovar exige os 2 avisos.
  const avisos = extra.semAvisos ? [] : [aviso(U, -28, 2), aviso(U, -5, 3), aviso(LEG, -28, 4), aviso(LEG, -5, 5)]
  const rows = [
    { id: 'q-ok', user_id: U, reason: 'revoked_90d', scheduled_at: em(-88), eligible_at: em(2), decision: 'pending', executed_at: null },
    { id: 'q-longe', user_id: 'f0000000-0000-4000-8000-000000000001', reason: 'revoked_90d', scheduled_at: em(-30), eligible_at: em(60), decision: 'pending', executed_at: null },
    { id: 'q-void', user_id: 'f0000000-0000-4000-8000-000000000002', reason: 'revoked_90d', scheduled_at: em(-95), eligible_at: em(-5), decision: 'void', void_reason: 'granted', executed_at: null },
    { id: 'q-exec', user_id: 'f0000000-0000-4000-8000-000000000003', reason: 'revoked_90d', scheduled_at: em(-95), eligible_at: em(-5), decision: 'approved', decided_by: ADMIN, decided_at: em(-1), executed_at: em(-1) },
    { id: 'q-leg', user_id: LEG, reason: 'legacy_no_consent', scheduled_at: em(-89), eligible_at: em(1), decision: 'pending', executed_at: null },
    { id: 'q-perdeu', user_id: P, reason: 'revoked_90d', scheduled_at: em(-91), eligible_at: em(-1), decision: 'pending', executed_at: null },
  ]
  return createFakeSupabase({
    users: [
      { id: U, email: 'ana.souza@gmail.com', created_at: '2025-01-01T00:00:00Z' },
      { id: LEG, email: 'legado@gmail.com', created_at: '2025-01-01T00:00:00Z' },
      { id: LEG2, email: 'legado2@gmail.com', created_at: '2025-01-01T00:00:00Z' },
      { id: P, email: 'perdeu@gmail.com', created_at: '2025-01-01T00:00:00Z' },
      { id: NC, email: 'digitou-errado@example.com', created_at: '2025-01-01T00:00:00Z', email_confirmed: false },
    ],
    tables: {
      prune_queue: rows,
      app_version_gate: extra.gates ?? [],
      prune_queue_audit: (extra.wave2For ?? []).map((user_id) => ({ user_id, action: 'mark_notice', actor: `admin:${ADMIN}`, detail: { milestone: 'wave2' }, created_at: em(-100) })),
      consent_log: [{ user_id: LEG, consent_type: 'health_data', action: 'scheduled_deletion', created_at: em(-89), seq: 1 }, ...avisos],
      consent_copy: [{ key: 'never_consented_deadline', body: 'Sua conta será excluída em {data} sem autorização.', version: 1, updated_by: null, updated_at: em(-10) }],
    },
  })
}

const GATE_034 = [
  { platform: 'ios', min_supported_version: '0.34.0', is_active: true },
  { platform: 'android', min_supported_version: '0.34.0', is_active: true },
]

describe('PO-SEC-1 — approve só por queue_id + prefixo conferido no servidor', () => {
  it('5 recusas e 1 sucesso; nenhuma chamada de exclusão em nenhum caso', async () => {
    const { supabase, rpcCalls, state } = cenario()
    const casos: Array<[any, number]> = [
      [{ user_id: U, prefix: U.slice(0, 8) }, 400],              // user_id sem queue_id
      [{ queue_id: 'q-void', prefix: 'f0000000' }, 409],          // void
      [{ queue_id: 'q-exec', prefix: 'f0000000' }, 409],          // executada
      [{ queue_id: 'q-ok', prefix: 'a9f3e1c3' }, 422],            // prefixo errado
      [{ queue_id: 'q-ok', prefix: 'a9f3e' }, 422],               // prefixo curto (< 6)
      [{ queue_id: 'q-longe', prefix: 'f0000000' }, 409],         // eligible_at > hoje+7
    ]
    for (const [body, esperado] of casos) {
      const r = res()
      await handleApprovePrune({ body }, r, supabase, ADMIN)
      expect([body, r.statusCode]).toEqual([body, esperado])
    }
    const ok = res()
    await handleApprovePrune({ body: { queue_id: 'q-ok', prefix: 'A9F3E1C2' } }, ok, supabase, ADMIN)
    expect(ok.statusCode).toBe(200)

    expect(rpcCalls).toHaveLength(0) // aprovar nunca apaga
    const linha = state.tables.prune_queue.find((q) => q.id === 'q-ok')
    expect(linha).toMatchObject({ decision: 'approved', decided_by: ADMIN })
    expect(linha.decided_at).toBeTruthy()
    const auditoria = state.tables.prune_queue_audit.filter((a) => a.action === 'approve')
    expect(auditoria).toEqual([expect.objectContaining({ queue_id: 'q-ok', user_id: U, actor: `admin:${ADMIN}` })])
    expect(auditoria[0].detail).toMatchObject({ reason: 'revoked_90d', prefix_checked: 8 })
  })

  it('2ª aprovação da mesma linha ⇒ 409', async () => {
    const { supabase } = cenario()
    await handleApprovePrune({ body: { queue_id: 'q-ok', prefix: 'a9f3e1' } }, res(), supabase, ADMIN)
    const r = res()
    await handleApprovePrune({ body: { queue_id: 'q-ok', prefix: 'a9f3e1' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(409)
  })
})

describe('PO-8 — legado só com gate ≥ 0.34 E e-mail da onda 2 no rastro', () => {
  const body = { queue_id: 'q-leg', prefix: 'c0ffee' }
  it('gate inativo ⇒ 409; gate ok sem onda 2 ⇒ 409; gate ok + onda 2 ⇒ 200', async () => {
    let r = res()
    await handleApprovePrune({ body }, r, cenario({ wave2For: [LEG] }).supabase, ADMIN)
    expect(r.statusCode).toBe(409)
    expect(r.body.error).toContain('0.34')

    r = res()
    await handleApprovePrune({ body }, r, cenario({ gates: GATE_034 }).supabase, ADMIN)
    expect(r.statusCode).toBe(409)
    expect(r.body.error).toContain('onda 2')

    r = res()
    await handleApprovePrune({ body }, r, cenario({ gates: GATE_034, wave2For: [LEG] }).supabase, ADMIN)
    expect(r.statusCode).toBe(200)
  })
})

describe('PO-2 — defer exige nota e data futura', () => {
  it('sem nota / nota em branco / data passada ⇒ 400; válido ⇒ 200 com decided_by', async () => {
    const { supabase, state } = cenario()
    for (const body of [
      { queue_id: 'q-ok', reevaluate_at: em(10) },
      { queue_id: 'q-ok', note: '   ', reevaluate_at: em(10) },
      { queue_id: 'q-ok', note: 'ok', reevaluate_at: em(-1) },
      { queue_id: 'q-ok', note: 'x'.repeat(501), reevaluate_at: em(10) },
    ]) {
      const r = res()
      await handleDeferPrune({ body }, r, supabase, ADMIN)
      expect(r.statusCode).toBe(400)
    }
    const r = res()
    await handleDeferPrune({ body: { queue_id: 'q-ok', note: 'titular respondeu', reevaluate_at: em(10) } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
    expect(state.tables.prune_queue.find((q) => q.id === 'q-ok')).toMatchObject({ decision: 'deferred', decided_by: ADMIN, note: 'titular respondeu' })
  })
})

describe('PO-6 / PO-SEC-6 — list mascarado, sem saúde; e-mail inteiro só por reveal', () => {
  it('payload do list não traz e-mail inteiro nem campo de saúde', async () => {
    const { supabase } = cenario()
    const r = res()
    await handleListPrune({ query: {} }, r, supabase)
    expect(r.statusCode).toBe(200)
    const txt = JSON.stringify(r.body)
    for (const email of ['ana.souza@gmail.com', 'legado@gmail.com', 'legado2@gmail.com']) expect(txt).not.toContain(email)
    expect(txt).toContain('ana***@gmail.com')
    expect(txt).not.toMatch(/medicine|protocol|dose|dosage|titration/i)
    expect(r.body.data.map((i: any) => i.queue_id).sort()).toEqual(['q-leg', 'q-longe', 'q-ok', 'q-perdeu'])
    const ok = r.body.data.find((i: any) => i.queue_id === 'q-ok')
    expect(Object.keys(ok).sort()).toEqual([
      'approvable', 'block', 'decided_at', 'decision', 'eligible_at', 'email_deadline', 'email_masked', 'email_notice_due',
      'executed_at', 'has_reaviso', 'next_milestone', 'note', 'notices_sent', 'overdue', 'queue_id', 'reason', 'red',
      'reevaluate_at', 'scheduled_at', 'section', 'short_id', 'void_reason',
    ])
    expect(ok.approvable).toBe(true)
    // onda 2: só a conta legado ainda sem marca e fora da fila
    expect(r.body.wave2.map((w: any) => w.short_id)).toEqual([LEG2.slice(0, 8)])
  })

  it('reveal: 1 linha, e-mail inteiro + auditoria; linha morta ⇒ 409', async () => {
    const { supabase, state } = cenario()
    const r = res()
    await handleRevealPrune({ body: { queue_id: 'q-ok', milestone: 'd83' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
    expect(r.body.data.email).toBe('ana.souza@gmail.com')
    expect(state.tables.prune_queue_audit.filter((a) => a.action === 'reveal_email')).toEqual([
      expect.objectContaining({ queue_id: 'q-ok', user_id: U, actor: `admin:${ADMIN}`, detail: { milestone: 'd83' } }),
    ])
    const morto = res()
    await handleRevealPrune({ body: { queue_id: 'q-void', milestone: 'd83' } }, morto, supabase, ADMIN)
    expect(morto.statusCode).toBe(409)
  })
})

describe('PO-SEC-9 — marco wave2 só no conjunto calculado pelo servidor, 1× por conta', () => {
  it('fora do conjunto ⇒ 409 sem tocar a trilha; válido ⇒ 200 + notice_sent + auditoria; 2ª ⇒ 409', async () => {
    const { supabase, rpcCalls, state } = cenario({ wave2For: [LEG] })
    for (const user_id of [U /* tem linha viva */, LEG /* já marcado e na fila */, 'f0000000-0000-4000-8000-00000000dead' /* inexistente */]) {
      const r = res()
      await handleMarkNoticePrune({ body: { user_id, milestone: 'wave2' } }, r, supabase, ADMIN)
      expect(r.statusCode).toBe(409)
    }
    expect(rpcCalls).toHaveLength(0)

    const ok = res()
    await handleMarkNoticePrune({ body: { user_id: LEG2, milestone: 'wave2' } }, ok, supabase, ADMIN)
    expect(ok.statusCode).toBe(200)
    expect(rpcCalls).toEqual([{ fn: 'consent_controller_event', args: { p_user_id: LEG2, p_action: 'notice_sent', p_consent_type: 'health_data' } }])
    expect(state.tables.prune_queue_audit.at(-1)).toMatchObject({ user_id: LEG2, action: 'mark_notice', queue_id: null, detail: { milestone: 'wave2' } })

    const de_novo = res()
    await handleMarkNoticePrune({ body: { user_id: LEG2, milestone: 'wave2' } }, de_novo, supabase, ADMIN)
    expect(de_novo.statusCode).toBe(409)
  })

  it('marco D+83 de linha da fila: só quando devido, 1× por marco', async () => {
    const { supabase, rpcCalls } = cenario({ semAvisos: true })
    const r1 = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-ok', milestone: 'd60' } }, r1, supabase, ADMIN) // dia 88 ⇒ devido é d83
    expect(r1.statusCode).toBe(409)
    // d83 exige 2 avisos desde o início; com 0, é devido
    const r2 = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-ok', milestone: 'd83' } }, r2, supabase, ADMIN)
    expect(r2.statusCode).toBe(200)
    expect(rpcCalls).toHaveLength(1)
    // perdeu o D+60: o D+83 sozinho basta — um 2º e-mail D+83 é recusado e a linha fica decidível
    const r3 = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-ok', milestone: 'd83' } }, r3, supabase, ADMIN)
    expect(r3.statusCode).toBe(409)
    expect(rpcCalls).toHaveLength(1)
    const ap = res()
    await handleApprovePrune({ body: { queue_id: 'q-ok', prefix: 'a9f3e1' } }, ap, supabase, ADMIN)
    expect(ap.statusCode).toBe(200)
  })
})

describe('FR-014 — sem os 2 avisos não aprova; reaviso único recomeça o prazo em 7 dias', () => {
  it('list põe cada linha numa seção só, pela próxima ação', async () => {
    const { supabase } = cenario({ gates: GATE_034, wave2For: [LEG] })
    const r = res()
    await handleListPrune({ query: {} }, r, supabase)
    const por = Object.fromEntries(r.body.data.map((i: any) => [i.queue_id, [i.section, i.block, i.email_notice_due]]))
    expect(por).toEqual({
      'q-ok': ['decide', null, null],
      'q-leg': ['decide', null, null],
      'q-longe': ['counting', null, null],
      'q-perdeu': ['blocked', 'missing_notices', 'reaviso'],
    })
    expect(r.body.summary.by_section).toMatchObject({ decide: 2, counting: 1, blocked: 1, email: 0 })
    const perdeu = r.body.data.find((i: any) => i.queue_id === 'q-perdeu')
    expect(Date.parse(perdeu.email_deadline)).toBeGreaterThan(Date.parse(em(6.9)))
  })

  it('aviso D+83 ainda devido ⇒ seção email e approve 409', async () => {
    const { supabase } = cenario({ semAvisos: true })
    const r = res()
    await handleApprovePrune({ body: { queue_id: 'q-ok', prefix: 'a9f3e1' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(409)
    expect(r.body.error).toContain('reaviso')
  })

  it('bloqueada: approve 409 → reaviso marca, prazo = hoje + 7 → approve 200; 2º reaviso 409', async () => {
    const { supabase, rpcCalls, state } = cenario()
    const body = { queue_id: 'q-perdeu', prefix: 'e1e1e1' }
    let r = res()
    await handleApprovePrune({ body }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(409)

    // reaviso só para linha bloqueada por falta de aviso
    r = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-ok', milestone: 'reaviso' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(409)
    expect(rpcCalls).toHaveLength(0)

    r = res()
    await handleRevealPrune({ body: { queue_id: 'q-perdeu', milestone: 'reaviso' } }, r, supabase, ADMIN)
    expect(r.body.data.email).toBe('perdeu@gmail.com')

    r = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-perdeu', milestone: 'reaviso' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
    expect(rpcCalls).toEqual([{ fn: 'consent_controller_event', args: { p_user_id: P, p_action: 'notice_sent', p_consent_type: 'health_data' } }])
    const linha = state.tables.prune_queue.find((q) => q.id === 'q-perdeu')
    const dias = (Date.parse(linha.eligible_at) - Date.now()) / 86_400_000
    expect(dias).toBeGreaterThan(6.9)
    expect(dias).toBeLessThanOrEqual(7)
    expect(state.tables.prune_queue_audit.at(-1)).toMatchObject({
      queue_id: 'q-perdeu', action: 'mark_notice', detail: { milestone: 'reaviso', eligible_at: linha.eligible_at },
    })

    r = res()
    await handleMarkNoticePrune({ body: { queue_id: 'q-perdeu', milestone: 'reaviso' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(409)

    r = res()
    await handleApprovePrune({ body }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
  })
})

describe('FR-016 — cadastro não confirmado', () => {
  it('fora da onda 2; na fila, aprova sem aviso nenhum', async () => {
    const { supabase, state } = cenario()
    let r = res()
    await handleListPrune({ query: {} }, r, supabase)
    expect(r.body.wave2.map((w: any) => w.short_id)).not.toContain(NC.slice(0, 8))

    state.tables.prune_queue.push({ id: 'q-nc', user_id: NC, reason: 'unconfirmed_signup', scheduled_at: '2025-01-01T00:00:00Z', eligible_at: em(0), decision: 'pending', executed_at: null })
    r = res()
    await handleListPrune({ query: {} }, r, supabase)
    expect(r.body.data.find((i: any) => i.queue_id === 'q-nc')).toMatchObject({ section: 'decide', email_notice_due: null, approvable: true })
    r = res()
    await handleApprovePrune({ body: { queue_id: 'q-nc', prefix: 'abcabc' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
  })
})

describe('PO-SEC-3 — texto da trava', () => {
  it('5 casos inválidos ⇒ 400 sem tocar o banco; válido ⇒ versão +1 e histórico com a anterior', async () => {
    const { supabase, state } = cenario()
    for (const body of ['<b>oi</b> até {data} xxxxxxxxx', 'sem marcador nenhum aqui dentro', 'curto {data}', 'x'.repeat(600) + '{data}', '']) {
      const r = res()
      await handleUpdatePruneTexts({ body: { body } }, r, supabase, ADMIN)
      expect(r.statusCode).toBe(400)
    }
    expect(state.tables.consent_copy_history).toHaveLength(0)

    const r = res()
    await handleUpdatePruneTexts({ body: { body: 'Autorize até {data} ou a conta será excluída.' } }, r, supabase, ADMIN)
    expect(r.statusCode).toBe(200)
    expect(state.tables.consent_copy[0]).toMatchObject({ version: 2, updated_by: ADMIN })
    expect(state.tables.consent_copy_history).toEqual([expect.objectContaining({ version: 1, body: 'Sua conta será excluída em {data} sem autorização.' })])
  })
})

it('sanidade do relógio de teste', () => {
  expect(addDays('2026-01-01T00:00:00.000Z', 1)).toBe('2026-01-02T00:00:00.000Z')
})
