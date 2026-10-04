// Coletor do relatório clínico (spec 097 A1 — PO-SEC-2 guard, PO-6, FR-022, AP-186).
// Contrato: user_id explícito em toda tabela, paginação até página incompleta, qualquer fonte que
// falha derruba a geração, nenhuma coluna de preço, janela pelos períodos fixos.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportWindow, createReportCollector, parseEmergencyCard } from '../reportCollector'

const USER = 'user-a'

interface Call {
  source: string
  select: string | null
  eqs: [string, unknown][]
  range: [number, number] | null
  rpcArgs?: Record<string, unknown>
}

/** Builder fluente e thenable, como o do supabase-js; `pages[source]` = páginas devolvidas em ordem. */
function makeClient(pages: Record<string, unknown[][]>, failOn: string | null = null) {
  const calls: Call[] = []
  const served: Record<string, number> = {}

  function builder(source: string, call: Call) {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = (cols: string) => ((call.select = cols), b)
    b.eq = (col: string, v: unknown) => (call.eqs.push([col, v]), b)
    for (const m of ['gte', 'lte', 'order']) b[m] = chain
    b.range = (from: number, to: number) => {
      call.range = [from, to]
      return b
    }
    b.maybeSingle = () => {
      if (failOn === source) return Promise.resolve({ data: null, error: { message: `falha ${source}` } })
      return Promise.resolve({ data: pages[source]?.[0]?.[0] ?? null, error: null })
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      if (failOn === source) return resolve({ data: null, error: { message: `falha ${source}` } })
      const i = served[source] ?? 0
      served[source] = i + 1
      return resolve({ data: pages[source]?.[i] ?? [], error: null })
    }
    return b
  }

  const client = {
    from: (table: string) => {
      const call: Call = { source: table, select: null, eqs: [], range: null }
      calls.push(call)
      return builder(table, call)
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      const call: Call = { source: fn, select: null, eqs: [], range: null, rpcArgs: args }
      calls.push(call)
      return builder(fn, call)
    },
  }
  return { client: client as never, calls }
}

const SETTINGS = {
  display_name: ' Ana ',
  birth_date: '1960-05-02',
  emergency_card: { allergies: ['Dipirona', '', 3], blood_type: 'O+' },
  timezone: 'America/Sao_Paulo',
  stock_tracking_enabled: null,
}

function fullPages(): Record<string, unknown[][]> {
  return {
    user_settings: [[SETTINGS]],
    protocols: [[{ id: 'p1' }]],
    medicines: [[{ id: 'm1' }]],
    report_dose_days: [[{ protocol_id: 'p1', day: '2026-09-10' }]],
    titration_steps: [[]],
    medicine_stock_summary: [[{ medicine_id: 'm1', total_quantity: '12.5' }]],
    biomarkers_log: [[]],
    medicine_logs: [[]],
  }
}

describe('buildReportWindow', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('janela inclusiva de N dias terminando em `to`', () => {
    expect(buildReportWindow(30, '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-30', days: 30 })
    expect(buildReportWindow(7, '2026-03-02')).toEqual({ from: '2026-02-24', to: '2026-03-02', days: 7 })
  })

  it('recusa período fora dos fixos e data inválida', () => {
    expect(() => buildReportWindow(365 as never, '2026-09-30')).toThrow(/Período/)
    expect(() => buildReportWindow(30, '30/09/2026')).toThrow(/Data final/)
  })
})

describe('parseEmergencyCard', () => {
  it('normaliza alergias e tipo sanguíneo sem confiar na forma do jsonb', () => {
    expect(parseEmergencyCard({ allergies: [' Dipirona ', '', 3], blood_type: ' A- ' })).toEqual({
      allergies: ['Dipirona'],
      bloodType: 'A-',
    })
    expect(parseEmergencyCard(null)).toEqual({ allergies: [], bloodType: null })
    expect(parseEmergencyCard({ allergies: 'texto', blood_type: '' })).toEqual({ allergies: [], bloodType: null })
  })
})

describe('createReportCollector', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('exige client e getUserId', () => {
    expect(() => createReportCollector({ client: null as never, getUserId: async () => USER })).toThrow(/client/)
    expect(() => createReportCollector({ client: {} as never, getUserId: null as never })).toThrow(/getUserId/)
  })

  it('filtra user_id explícito em TODA tabela lida (PO-SEC-2 guard)', async () => {
    const { client, calls } = makeClient(fullPages())
    await createReportCollector({ client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    const tables = calls.filter((c) => !c.rpcArgs)
    expect(tables.map((c) => c.source).sort()).toEqual(
      ['biomarkers_log', 'medicine_logs', 'medicine_stock_summary', 'medicines', 'protocols', 'titration_steps', 'user_settings'].sort()
    )
    for (const c of tables) expect(c.eqs).toContainEqual(['user_id', USER])
  })

  it('chama a RPC só com a janela — sem fuso nem usuário (C-1, PO-SEC-2)', async () => {
    const { client, calls } = makeClient(fullPages())
    await createReportCollector({ client, getUserId: async () => USER }).collect({ days: 7, to: '2026-09-30' })
    const rpc = calls.find((c) => c.source === 'report_dose_days')
    expect(rpc?.rpcArgs).toEqual({ p_from: '2026-09-24', p_to: '2026-09-30' })
  })

  it('nenhum select traz preço (DS-4)', async () => {
    const { client, calls } = makeClient(fullPages())
    await createReportCollector({ client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    for (const c of calls) expect(c.select ?? '').not.toMatch(/price|unit_price|price_paid/)
  })

  it('pagina até a página vir incompleta (AP-186)', async () => {
    const page = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, type: 'peso' }))
    const pages = { ...fullPages(), biomarkers_log: [page(1000, 'a'), page(1000, 'b'), page(3, 'c')] }
    const { client, calls } = makeClient(pages)
    const out = await createReportCollector({ client, getUserId: async () => USER }).collect({ days: 90, to: '2026-09-30' })
    expect(out.biomarkers).toHaveLength(2003)
    expect(calls.filter((c) => c.source === 'biomarkers_log').map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('monta perfil, fuso e rastreio (NULL ⇒ ligado, FR-007) e normaliza estoque numérico', async () => {
    const { client } = makeClient(fullPages())
    const out = await createReportCollector({ client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    expect(out.profile).toEqual({ displayName: 'Ana', birthDate: '1960-05-02', allergies: ['Dipirona'], bloodType: 'O+' })
    expect(out.timezone).toBe('America/Sao_Paulo')
    expect(out.stockTrackingEnabled).toBe(true)
    expect(out.stockTotals).toEqual([{ medicine_id: 'm1', total_quantity: 12.5 }])
    expect(out.window).toEqual({ from: '2026-09-01', to: '2026-09-30', days: 30 })
  })

  it('rastreio `false` explícito desliga; sem user_settings cai no fuso padrão', async () => {
    const off = makeClient({ ...fullPages(), user_settings: [[{ ...SETTINGS, stock_tracking_enabled: false }]] })
    const a = await createReportCollector({ client: off.client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    expect(a.stockTrackingEnabled).toBe(false)

    const none = makeClient({ ...fullPages(), user_settings: [[]] })
    const b = await createReportCollector({ client: none.client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    expect(b.timezone).toBe('America/Sao_Paulo')
    expect(b.profile).toEqual({ displayName: null, birthDate: null, allergies: [], bloodType: null })
  })

  it.each([
    'user_settings',
    'protocols',
    'medicines',
    'report_dose_days',
    'titration_steps',
    'medicine_stock_summary',
    'biomarkers_log',
    'medicine_logs',
  ])('fonte %s falhou ⇒ a coleta falha, sem relatório parcial (FR-022)', async (source) => {
    const { client } = makeClient(fullPages(), source)
    await expect(
      createReportCollector({ client, getUserId: async () => USER }).collect({ days: 30, to: '2026-09-30' })
    ).rejects.toMatchObject({ message: `falha ${source}` })
  })

  it('sem usuário autenticado ⇒ falha', async () => {
    const { client } = makeClient(fullPages())
    await expect(
      createReportCollector({ client, getUserId: async () => '' }).collect({ days: 30, to: '2026-09-30' })
    ).rejects.toThrow(/não autenticado/)
  })
})
