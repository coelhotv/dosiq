import { describe, it, expect, afterEach, vi } from 'vitest'
import { runPruneEnqueue } from '../pruneEnqueue.js'
import { createFakeSupabase } from './fakeSupabase.js'
import { addDays, ONBOARDING_RULE_START } from '../pruneRules.js'

const ADMIN = '00000000-0000-0000-0000-0000000000ad'
const DIA = 86_400_000

const dispatcherOk = () => {
  const enviados: any[] = []
  return { dispatcher: { dispatch: async (i: any) => { enviados.push(i); return { success: true } } }, enviados }
}

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

describe('runPruneEnqueue — abertura por motivo (PO-5)', () => {
  // AGORA bem depois da regra do onboarding, para a conta nova ter > 30 dias.
  const AGORA = new Date('2027-01-15T12:00:00Z')
  const iso = (d: Date) => d.toISOString()

  function cenario() {
    const onboardingCriada = addDays(ONBOARDING_RULE_START, 10) // 2026-10-30 → 30 d em 2026-11-29
    return createFakeSupabase({
      users: [
        { id: 'LEG', email: 'legado@x.test', created_at: '2025-03-01T00:00:00Z' },
        { id: 'LEG2', email: 'legado2@x.test', created_at: '2025-03-01T00:00:00Z' }, // sem e-mail da onda 2
        { id: 'ONB', email: 'novo@x.test', created_at: onboardingCriada },
        { id: 'REV', email: 'revogou@x.test', created_at: '2026-01-01T00:00:00Z' },
      ],
      tables: {
        user_settings: [{ user_id: 'REV', consent_revoked_at: iso(new Date(AGORA.getTime() - 90 * DIA)) }],
        consent_log: [
          { user_id: 'REV', consent_type: 'health_data', action: 'granted', created_at: '2026-02-01T00:00:00Z', seq: 1 },
          { user_id: 'REV', consent_type: 'health_data', action: 'revoked', created_at: iso(new Date(AGORA.getTime() - 90 * DIA)), seq: 2 },
        ],
        prune_queue_audit: [
          // e-mail da onda 2 marcado há 8 dias
          { user_id: 'LEG', action: 'mark_notice', actor: `admin:${ADMIN}`, detail: { milestone: 'wave2' }, created_at: iso(new Date(AGORA.getTime() - 8 * DIA)) },
        ],
      },
    }, () => AGORA.toISOString())
  }

  it('legado após onda 2 + 7 d, onboarding ≥ 30 d e revogado entram com o motivo certo; scheduled_deletion só p/ quem nunca consentiu', async () => {
    const { supabase, state } = cenario()
    const { dispatcher } = dispatcherOk()
    const r = await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })

    expect(r.enqueued).toBe(3)
    const porUser = Object.fromEntries(state.tables.prune_queue.map((q) => [q.user_id, q]))
    expect(porUser.LEG.reason).toBe('legacy_no_consent')
    expect(porUser.ONB.reason).toBe('onboarding_no_consent')
    expect(porUser.REV.reason).toBe('revoked_90d')
    expect(porUser.LEG2).toBeUndefined() // sem onda 2 ⇒ fora da fila (INV-6)

    // relógio: legado = marcação + 7 d; elegível = +90 d
    expect(porUser.LEG.scheduled_at).toBe(addDays(iso(new Date(AGORA.getTime() - 8 * DIA)), 7))
    expect(porUser.LEG.eligible_at).toBe(addDays(porUser.LEG.scheduled_at, 90))

    const sched = state.tables.consent_log.filter((c) => c.action === 'scheduled_deletion').map((c) => c.user_id).sort()
    expect(sched).toEqual(['LEG', 'ONB'])
    // INV-3: o controlador nunca grava revoked
    expect(state.tables.consent_log.filter((c) => c.action === 'revoked').map((c) => c.user_id)).toEqual(['REV'])
  })

  it('2ª execução não duplica linha nem scheduled_deletion', async () => {
    const { supabase, state } = cenario()
    const { dispatcher } = dispatcherOk()
    await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    const r2 = await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(r2.enqueued).toBe(0)
    expect(state.tables.prune_queue).toHaveLength(3)
    expect(state.tables.consent_log.filter((c) => c.action === 'scheduled_deletion')).toHaveLength(2)
  })

  it('G-5: conta criada antes da regra do onboarding sem onda 2 NÃO entra, mesmo com > 30 d', async () => {
    const { supabase, state } = cenario()
    const { dispatcher } = dispatcherOk()
    await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(state.tables.prune_queue.some((q) => q.user_id === 'LEG2')).toBe(false)
  })

  it('scheduled_deletion falha ⇒ linha NÃO abre (sem prova, sem relógio)', async () => {
    const { supabase, state } = cenario()
    const orig = supabase.rpc
    supabase.rpc = async (fn: string, args: any) =>
      fn === 'consent_controller_event' ? { data: null, error: { message: 'boom' } } : orig(fn, args)
    const { dispatcher } = dispatcherOk()
    await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(state.tables.prune_queue.map((q) => q.user_id)).toEqual(['REV'])
  })
})

describe('runPruneEnqueue — reavaliação', () => {
  const AGORA = new Date('2027-01-15T12:00:00Z')
  const base = (extra: any = {}) => ({
    id: 'q1', user_id: 'U', reason: 'onboarding_no_consent', scheduled_at: '2026-12-01T00:00:00.000Z',
    eligible_at: '2027-03-01T00:00:00.000Z', decision: 'pending', executed_at: null, reevaluate_at: null, ...extra,
  })

  it('autorizou ⇒ void(granted); conta sumiu ⇒ void(self_deleted)', async () => {
    const a = createFakeSupabase({
      users: [{ id: 'U', email: 'u@x.test', created_at: '2026-11-01T00:00:00Z' }],
      tables: { prune_queue: [base()], consent_log: [{ user_id: 'U', consent_type: 'health_data', action: 'granted', created_at: '2027-01-10T00:00:00Z', seq: 1 }] },
    })
    await runPruneEnqueue({ supabase: a.supabase, dispatcher: dispatcherOk().dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(a.state.tables.prune_queue[0]).toMatchObject({ decision: 'void', void_reason: 'granted' })

    const b = createFakeSupabase({ users: [], tables: { prune_queue: [base()] } })
    await runPruneEnqueue({ supabase: b.supabase, dispatcher: dispatcherOk().dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(b.state.tables.prune_queue[0]).toMatchObject({ decision: 'void', void_reason: 'self_deleted' })
  })

  it('adiada com reevaluate_at vencido volta a pending', async () => {
    const f = createFakeSupabase({
      users: [{ id: 'U', email: 'u@x.test', created_at: '2026-11-01T00:00:00Z' }],
      tables: { prune_queue: [base({ decision: 'deferred', decided_by: ADMIN, decided_at: 'x', note: 'n', reevaluate_at: '2027-01-14T00:00:00.000Z' })] },
    })
    const r = await runPruneEnqueue({ supabase: f.supabase, dispatcher: dispatcherOk().dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(r.reactivated).toBe(1)
    expect(f.state.tables.prune_queue[0].decision).toBe('pending')
  })
})

describe('runPruneEnqueue — avisos D+60/D+83 (F-6)', () => {
  const SCHED = '2026-11-01T00:00:00.000Z'
  const linha = (user_id: string) => ({
    id: `q-${user_id}`, user_id, reason: 'legacy_no_consent', scheduled_at: SCHED, eligible_at: addDays(SCHED, 90),
    decision: 'pending', executed_at: null, reevaluate_at: null,
  })
  const em = (dias: number) => new Date(Date.parse(SCHED) + dias * DIA + 3_600_000)

  function cenario() {
    return createFakeSupabase({
      users: [{ id: 'P', email: 'p@x.test', created_at: '2025-01-01T00:00:00Z' }, { id: 'E', email: 'e@x.test', created_at: '2025-01-01T00:00:00Z' }],
      tables: {
        prune_queue: [linha('P'), linha('E')],
        notification_devices: [{ user_id: 'P', is_active: true }],
      },
    })
  }

  it('com push ⇒ dispara e grava notice_sent; sem push ⇒ conta como e-mail devido e NÃO grava notice_sent', async () => {
    const { supabase, state } = cenario()
    const { dispatcher, enviados } = dispatcherOk()
    const r = await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: em(60), env: {} })
    expect(r.pushNoticed).toBe(1)
    expect(r.emailsDue).toBe(1)
    expect(enviados.filter((e) => e.kind === 'consent_prune_notice').map((e) => e.userId)).toEqual(['P'])
    expect(state.tables.consent_log.filter((c) => c.action === 'notice_sent').map((c) => c.user_id)).toEqual(['P'])
  })

  it('e-mail marcado (notice_sent) ⇒ deixa de ser devido até o D+83', async () => {
    const { supabase, state } = cenario()
    state.tables.consent_log.push({ user_id: 'E', consent_type: 'health_data', action: 'notice_sent', created_at: em(60).toISOString(), seq: 9 })
    const r61 = await runPruneEnqueue({ supabase, dispatcher: dispatcherOk().dispatcher, adminUserId: ADMIN, now: em(61), env: {} })
    expect(r61.emailsDue).toBe(0)
    const r83 = await runPruneEnqueue({ supabase, dispatcher: dispatcherOk().dispatcher, adminUserId: ADMIN, now: em(83), env: {} })
    expect(r83.emailsDue).toBe(1)
  })
})

describe('runPruneEnqueue — alerta ao admin (PO-4)', () => {
  const ELEG = '2027-02-01T12:00:00.000Z'
  const LIMITE = addDays(ELEG, 15)
  const em = (iso: string, dias: number) => new Date(Date.parse(iso) + dias * DIA)
  const cenario = () => createFakeSupabase({
    users: [{ id: 'U', email: 'u@x.test', created_at: '2025-01-01T00:00:00Z' }],
    tables: {
      prune_queue: [{
        id: 'q', user_id: 'U', reason: 'legacy_no_consent', scheduled_at: addDays(ELEG, -90), eligible_at: ELEG,
        decision: 'pending', executed_at: null, reevaluate_at: null,
      }],
      // os 2 avisos já marcados ⇒ nenhum e-mail devido atrapalha a contagem
      consent_log: [1, 2].map((s) => ({ user_id: 'U', consent_type: 'health_data', action: 'notice_sent', created_at: addDays(ELEG, -20), seq: s })),
    },
  })

  it('D-1 sem alerta; D0 e limite-11 normal; limite-10 vermelho', async () => {
    const casos: Array<[Date, boolean, boolean]> = [
      [em(ELEG, -1), false, false],
      [em(ELEG, 0), true, false],
      [em(LIMITE, -11), true, false],
      [em(LIMITE, -10), true, true],
    ]
    for (const [quando, alerta, vermelho] of casos) {
      const { supabase } = cenario()
      const { dispatcher, enviados } = dispatcherOk()
      const r = await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: quando, env: {} })
      const alertas = enviados.filter((e) => e.kind === 'prune_admin_alert')
      expect(alertas.length > 0).toBe(alerta)
      if (alerta) {
        expect(alertas[0].userId).toBe(ADMIN)
        expect(alertas[0].data.red > 0).toBe(vermelho)
      }
      expect(r.red > 0).toBe(vermelho)
    }
  })

  it('FR-014: no prazo sem os 2 avisos conta como e-mail a enviar (reaviso); com reaviso marcado, não', async () => {
    const semAvisos = () => {
      const f = cenario()
      f.state.tables.consent_log.length = 0
      return f
    }
    let f = semAvisos()
    let { dispatcher, enviados } = dispatcherOk()
    let r = await runPruneEnqueue({ supabase: f.supabase, dispatcher, adminUserId: ADMIN, now: em(ELEG, 1), env: {} })
    expect(r.emailsDue).toBe(1)
    expect(enviados.find((e) => e.kind === 'prune_admin_alert').data.emailsDue).toBe(1)

    f = semAvisos()
    f.state.tables.prune_queue_audit.push({ queue_id: 'q', user_id: 'U', action: 'mark_notice', actor: `admin:${ADMIN}`, detail: { milestone: 'reaviso' }, created_at: ELEG })
    ;({ dispatcher, enviados } = dispatcherOk())
    r = await runPruneEnqueue({ supabase: f.supabase, dispatcher, adminUserId: ADMIN, now: em(ELEG, 1), env: {} })
    expect(r.emailsDue).toBe(0)
  })

  it('falha no envio do alerta ⇒ Sentry, nunca silêncio (AS-2.1)', async () => {
    const { supabase } = cenario()
    const capture = vi.fn()
    const dispatcher = { dispatch: async () => ({ success: false }) }
    await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: em(ELEG, 1), env: {}, capture })
    expect(capture).toHaveBeenCalledTimes(1)
    const thrower = { dispatch: async () => { throw new Error('rede') } }
    await runPruneEnqueue({ supabase, dispatcher: thrower, adminUserId: ADMIN, now: em(ELEG, 1), env: {}, capture })
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it('PO-SEC-5: nenhum argumento de log, Sentry ou push carrega e-mail', async () => {
    const { supabase } = cenario()
    const capture = vi.fn()
    const { dispatcher, enviados } = dispatcherOk()
    const logs: any[] = []
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: any[]) => { logs.push(a) }))
    await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: em(LIMITE, -5), env: {}, capture })
    spies.forEach((s) => s.mockRestore())
    expect(logs.length).toBeGreaterThan(0) // o spy viu o logger — senão a prova seria vazia
    expect(enviados.some((e) => e.kind === 'prune_admin_alert')).toBe(true)
    const tudo = JSON.stringify([logs, capture.mock.calls, enviados])
    expect(tudo).not.toContain('@')
    expect(tudo).not.toMatch(/medicine|protocol|dose/i)
  })
})

describe('runPruneEnqueue — cadastro não confirmado (FR-016)', () => {
  const AGORA = new Date('2027-01-15T12:00:00Z')
  const cenario = () => createFakeSupabase({
    users: [
      { id: 'NC_VELHO', email: 'x@example.com', created_at: '2025-03-01T00:00:00Z', email_confirmed: false },
      { id: 'NC_NOVO', email: 'y@example.com', created_at: '2027-01-01T00:00:00Z', email_confirmed: false },
      { id: 'LEG', email: 'legado@x.test', created_at: '2025-03-01T00:00:00Z' }, // confirmado, sem onda 2
    ],
    tables: {},
  }, () => AGORA.toISOString())

  it('> 30 d sem confirmar ⇒ fila direta, decidível já, sem aviso; < 30 d e legado confirmado ⇒ fora', async () => {
    const { supabase, state } = cenario()
    const { dispatcher, enviados } = dispatcherOk()
    const r = await runPruneEnqueue({ supabase, dispatcher, adminUserId: ADMIN, now: AGORA, env: {} })
    expect(state.tables.prune_queue.map((q) => [q.user_id, q.reason])).toEqual([['NC_VELHO', 'unconfirmed_signup']])
    const q = state.tables.prune_queue[0]
    expect(q.scheduled_at).toBe('2025-03-01T00:00:00Z')
    expect(q.eligible_at).toBe(AGORA.toISOString())
    expect(r.emailsDue).toBe(0)
    expect(r.pushNoticed).toBe(0)
    expect(enviados.filter((e) => e.kind === 'consent_prune_notice')).toHaveLength(0)
  })
})
