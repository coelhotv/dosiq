import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  runConsentPrune,
  resolvePruneMode,
  isPruneEnabled,
  daysSince,
  PRUNE_DELETE_DAYS,
} from '../consentPrune.js'

/**
 * 046 Slice C — prune pós-revogação (T013c).
 *
 * O relógio é simulado por `now` injetado: o que muda entre os casos é a DISTÂNCIA até a revogação,
 * não um timer. Os 6 caminhos do T013c estão aqui, e o 6º (revogada >90d COM TRATAMENTO ATIVO) é o
 * que falharia em produção com todos os outros verdes — por isso ele testa o CAMINHO, provando que
 * a exclusão vai por `delete_user_account_by_id` (sem o bloqueio de tratamento ativo) e não pelo
 * wrapper do titular.
 *
 * O fake do Supabase avalia os filtros de verdade sobre tabelas em memória. Um mock que só
 * registrasse chamadas não provaria nada sobre QUEM foi selecionado para ser apagado.
 */

const DIA = 86_400_000
const AGORA = new Date('2026-11-20T10:00:00Z')
const hÁDias = (d: number) => new Date(AGORA.getTime() - d * DIA).toISOString()

interface Row { [k: string]: any }

function criarSupabase(estado: {
  userSettings: Row[]
  consentLog: Row[]
  falhas?: { trilha?: boolean; candidatos?: boolean; exclusao?: boolean }
}) {
  const rpcCalls: Array<{ fn: string; args: any }> = []
  const falhas = estado.falhas ?? {}

  class Query {
    rows: Row[]
    headCount = false
    constructor(private tabela: string) {
      this.rows = tabela === 'user_settings' ? [...estado.userSettings] : [...estado.consentLog]
    }
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      if (opts?.head) this.headCount = true
      return this
    }
    eq(col: string, v: any) { this.rows = this.rows.filter(r => r[col] === v); return this }
    in(col: string, vs: any[]) { this.rows = this.rows.filter(r => vs.includes(r[col])); return this }
    gte(col: string, v: any) { this.rows = this.rows.filter(r => r[col] != null && r[col] >= v); return this }
    lte(col: string, v: any) { this.rows = this.rows.filter(r => r[col] != null && r[col] <= v); return this }
    not(col: string, _op: string, _v: any) { this.rows = this.rows.filter(r => r[col] != null); return this }
    order(col: string, opts?: { ascending?: boolean }) {
      const dir = opts?.ascending === false ? -1 : 1
      this.rows = [...this.rows].sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0))
      return this
    }
    limit(n: number) { this.rows = this.rows.slice(0, n); return this }
    then(resolve: (v: any) => void) {
      if (this.tabela === 'user_settings' && falhas.candidatos) {
        return resolve({ data: null, error: { message: 'boom' }, count: null })
      }
      if (this.tabela === 'consent_log' && falhas.trilha) {
        return resolve({ data: null, error: { message: 'boom' }, count: null })
      }
      return resolve({ data: this.rows, error: null, count: this.rows.length })
    }
  }

  const supabase = {
    from: (tabela: string) => new Query(tabela),
    rpc: async (fn: string, args: any) => {
      rpcCalls.push({ fn, args })
      if (fn === 'delete_user_account_by_id' && falhas.exclusao) {
        return { data: null, error: { message: 'boom' } }
      }
      if (fn === 'consent_controller_event') {
        estado.consentLog.push({
          user_id: args.p_user_id, consent_type: args.p_consent_type,
          action: args.p_action, created_at: AGORA.toISOString(), seq: estado.consentLog.length + 100,
        })
      }
      return { data: null, error: null }
    },
  } as any

  return { supabase, rpcCalls }
}

const criarDispatcher = () => {
  const enviados: any[] = []
  return { dispatcher: { dispatch: async (i: any) => { enviados.push(i); return {} } }, enviados }
}

const trilhaRevogada = (userId: string, quando: string) => ([
  { user_id: userId, consent_type: 'health_data', action: 'granted', created_at: hÁDias(200), seq: 1 },
  { user_id: userId, consent_type: 'health_data', action: 'revoked', created_at: quando, seq: 2 },
])

const ARMADO = { CONSENT_PRUNE_MODE: 'armed' }

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

describe('freios (T013b)', () => {
  it('modo default é dry_run — env ausente, vazio ou com typo NUNCA arma', () => {
    expect(resolvePruneMode({})).toBe('dry_run')
    expect(resolvePruneMode({ CONSENT_PRUNE_MODE: '' })).toBe('dry_run')
    expect(resolvePruneMode({ CONSENT_PRUNE_MODE: 'ARMED' })).toBe('dry_run')
    expect(resolvePruneMode({ CONSENT_PRUNE_MODE: 'armed ' })).toBe('dry_run')
    expect(resolvePruneMode({ CONSENT_PRUNE_MODE: 'armed' })).toBe('armed')
  })

  it('kill-switch desliga; ausência do env mantém ligado', () => {
    expect(isPruneEnabled({})).toBe(true)
    expect(isPruneEnabled({ CONSENT_PRUNE_ENABLED: '0' })).toBe(false)
    expect(isPruneEnabled({ CONSENT_PRUNE_ENABLED: 'false' })).toBe(false)
  })

  it('kill-switch ligado não envia aviso nem apaga', async () => {
    const uid = 'u1'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(95) }],
      consentLog: trilhaRevogada(uid, hÁDias(95)),
    })
    const { dispatcher, enviados } = criarDispatcher()
    const r = await runConsentPrune({
      supabase, dispatcher, now: AGORA,
      env: { ...ARMADO, CONSENT_PRUNE_ENABLED: '0' },
    })
    expect(r.enabled).toBe(false)
    expect(r.pruned).toBe(0)
    expect(enviados).toHaveLength(0)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('6 caminhos do relógio (T013c)', () => {
  it('1. re-consentiu em D+45 → intocada (a trilha manda, não o flag)', async () => {
    const uid = 'u-reconsentiu'
    // O flag ficou sujo (corrida/retrocompatibilidade), mas a trilha diz `granted` depois.
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(95) }],
      consentLog: [
        ...trilhaRevogada(uid, hÁDias(95)),
        { user_id: uid, consent_type: 'health_data', action: 'granted', created_at: hÁDias(45), seq: 3 },
      ],
    })
    const { dispatcher, enviados } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.pruned).toBe(0)
    expect(enviados).toHaveLength(0)
    expect(rpcCalls.filter(c => c.fn === 'delete_user_account_by_id')).toHaveLength(0)
  })

  it('2. aguardando (D+61) → aviso, sem exclusão; e não repete no dia seguinte', async () => {
    const uid = 'u-aviso'
    const estado = {
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(61) }],
      consentLog: trilhaRevogada(uid, hÁDias(61)),
    }
    const { supabase, rpcCalls } = criarSupabase(estado)
    const { dispatcher, enviados } = criarDispatcher()

    const r1 = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r1.noticed).toBe(1)
    expect(r1.pruned).toBe(0)
    expect(enviados[0].kind).toBe('consent_prune_notice')
    expect(enviados[0].data).toEqual({ stage: 'd60', daysLeft: 29 })
    expect(rpcCalls.some(c => c.fn === 'consent_controller_event' && c.args.p_action === 'notice_sent')).toBe(true)

    // Roda de novo no dia seguinte: o aviso do D+60 já saiu ⇒ silêncio (anti-flood).
    const r2 = await runConsentPrune({ supabase, dispatcher, now: new Date(AGORA.getTime() + DIA), env: ARMADO })
    expect(r2.noticed).toBe(0)
    expect(enviados).toHaveLength(1)
  })

  it('2b. D+84 → segundo aviso (d83), uma única vez', async () => {
    const uid = 'u-aviso2'
    const estado = {
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(84) }],
      consentLog: [
        ...trilhaRevogada(uid, hÁDias(84)),
        { user_id: uid, consent_type: 'health_data', action: 'notice_sent', created_at: hÁDias(24), seq: 3 },
      ],
    }
    const { supabase } = criarSupabase(estado)
    const { dispatcher, enviados } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.noticed).toBe(1)
    expect(enviados[0].data).toEqual({ stage: 'd83', daysLeft: 6 })
  })

  it('3. revogada há >90d → apagada pelo pipeline único, com `pruned` gravado ANTES', async () => {
    const uid = 'u-prune'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(95) }],
      consentLog: [
        ...trilhaRevogada(uid, hÁDias(95)),
        { user_id: uid, consent_type: 'health_data', action: 'notice_sent', created_at: hÁDias(35), seq: 3 },
        { user_id: uid, consent_type: 'health_data', action: 'notice_sent', created_at: hÁDias(12), seq: 4 },
      ],
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })

    expect(r.pruned).toBe(1)
    const ordem = rpcCalls.map(c => c.fn)
    // A ordem é o requisito: depois da exclusão não há mais e-mail para derivar o subject_hash.
    expect(ordem).toEqual(['consent_controller_event', 'delete_user_account_by_id'])
    expect(rpcCalls[0].args.p_action).toBe('pruned')
    expect(rpcCalls[1].args).toEqual({ p_user_id: uid })
  })

  it('4. consentimento ATIVO → jamais tocada (nem varrida)', async () => {
    const uid = 'u-ativo'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: null }],
      consentLog: [{ user_id: uid, consent_type: 'health_data', action: 'granted', created_at: hÁDias(300), seq: 1 }],
    })
    const { dispatcher, enviados } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.candidates).toBe(0)
    expect(r.pruned).toBe(0)
    expect(enviados).toHaveLength(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('5. candidatos a exclusão acima do cap → run ABORTA sem apagar ninguém', async () => {
    const userSettings = Array.from({ length: 4 }, (_, i) => ({ user_id: `u${i}`, consent_revoked_at: hÁDias(95) }))
    const consentLog = userSettings.flatMap(u => trilhaRevogada(u.user_id, hÁDias(95)))
    const { supabase, rpcCalls } = criarSupabase({ userSettings, consentLog })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO, cap: 3 })
    expect(r.aborted).toBe(true)
    expect(r.reason).toBe('cap_exceeded')
    expect(r.pruned).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('6. revogada >90d COM TRATAMENTO ATIVO → prune EXECUTA (S1/PO-SEC-3)', async () => {
    // O caminho é a prova: `delete_user_account_by_id` é o wrapper SEM `active_treatments_block`.
    // Se algum dia alguém trocar por `delete_user_account()` (o do titular), este teste cai — e é
    // exatamente o caso que, em produção, deixaria a conta viva para sempre com o job verde.
    const uid = 'u-com-tratamento'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(120), active_treatments: 3 }],
      consentLog: trilhaRevogada(uid, hÁDias(120)),
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })

    expect(r.pruned).toBe(1)
    expect(rpcCalls.map(c => c.fn)).toContain('delete_user_account_by_id')
    expect(rpcCalls.map(c => c.fn)).not.toContain('delete_user_account')
  })
})

describe('dry-run e erros de leitura', () => {
  it('dry_run identifica o elegível e NÃO apaga', async () => {
    const uid = 'u-dry'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(95) }],
      consentLog: trilhaRevogada(uid, hÁDias(95)),
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: {} })
    expect(r.mode).toBe('dry_run')
    expect(r.candidates).toBe(1)
    expect(r.pruned).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('erro ao reconferir a trilha NÃO é sinal verde — pula, não apaga (AP-290)', async () => {
    const uid = 'u-erro'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: hÁDias(95) }],
      consentLog: trilhaRevogada(uid, hÁDias(95)),
      falhas: { trilha: true },
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.skipped).toBe(1)
    expect(r.pruned).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('erro na varredura aborta o run inteiro sem tocar em nada', async () => {
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: 'x', consent_revoked_at: hÁDias(95) }],
      consentLog: [],
      falhas: { candidatos: true },
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.aborted).toBe(true)
    expect(r.reason).toBe('candidate_query_failed')
    expect(rpcCalls).toHaveLength(0)
  })

  it('exclusão que falha aborta o run — o próximo candidato fica intocado', async () => {
    const userSettings = [
      { user_id: 'a', consent_revoked_at: hÁDias(120) },
      { user_id: 'b', consent_revoked_at: hÁDias(100) },
    ]
    const consentLog = userSettings.flatMap(u => trilhaRevogada(u.user_id, u.consent_revoked_at))
    const { supabase, rpcCalls } = criarSupabase({ userSettings, consentLog, falhas: { exclusao: true } })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.aborted).toBe(true)
    expect(r.reason).toBe('delete_failed')
    expect(r.pruned).toBe(0)
    expect(rpcCalls.filter(c => c.fn === 'delete_user_account_by_id')).toHaveLength(1)
  })

  it('consent_revoked_at não-timestamp nem chega a ser candidato', async () => {
    // `consent_revoked_at` é timestamptz: lixo não entra na coluna, e o filtro `lte(cutoff)` já o
    // descartaria de qualquer forma. O guard de `Number.isFinite` no job é defesa redundante de
    // propósito — a alternativa seria `daysSince` devolver NaN e a comparação `>= 90` virar false
    // silenciosamente, que é o modo de falha certo mas ilegível no log.
    const uid = 'u-lixo'
    const { supabase, rpcCalls } = criarSupabase({
      userSettings: [{ user_id: uid, consent_revoked_at: 'nao-e-data' }],
      consentLog: trilhaRevogada(uid, hÁDias(95)),
    })
    const { dispatcher } = criarDispatcher()
    const r = await runConsentPrune({ supabase, dispatcher, now: AGORA, env: ARMADO })
    expect(r.candidates).toBe(0)
    expect(r.pruned).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('daysSince', () => {
  it('conta dias corridos e devolve NaN em data inválida', () => {
    expect(daysSince(hÁDias(90), AGORA)).toBe(PRUNE_DELETE_DAYS)
    expect(daysSince(hÁDias(0), AGORA)).toBe(0)
    expect(Number.isNaN(daysSince('xx', AGORA))).toBe(true)
  })
})
