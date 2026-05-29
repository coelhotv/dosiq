import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  renewProtocolWindow,
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
} from '../doseInstancePlanner.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const protocol = {
  id: 'p1',
  user_id: 'u1',
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
}

function makeRepo(hwm = null) {
  return {
    _hwm: hwm,
    upsertMany: vi.fn(async () => []),
    setGeneratedThrough: vi.fn(async () => {}),
    getGeneratedThrough: vi.fn(async function () { return this._hwm }),
  }
}

const MS_DAY = 86400000

describe('computeWindowEnd', () => {
  it('contínuo (sem end_date): base + WINDOW_DAYS', () => {
    const base = new Date('2026-05-10T00:00:00Z')
    const end = computeWindowEnd(protocol, base)
    const days = (new Date(end).getTime() - base.getTime()) / MS_DAY
    expect(Math.round(days)).toBe(WINDOW_DAYS)
  })

  it('com end_date próximo: capa no fim do protocolo (não passa de end_date)', () => {
    const base = new Date('2026-05-10T00:00:00Z')
    const end = computeWindowEnd({ ...protocol, end_date: '2026-05-15' }, base)
    // fim do dia 15 < base+30d → usa end_date
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(end))
    expect(localDate).toBe('2026-05-15')
  })
})

describe('planWindow', () => {
  it('gera, faz upsert e avança o high-water-mark', async () => {
    const repo = makeRepo()
    const n = await planWindow({
      protocol,
      doseInstanceRepo: repo,
      fromTs: '2026-05-10T00:00:00-03:00',
      toTs: '2026-05-12T23:59:59-03:00',
    })
    expect(n).toBe(3) // 3 dias × 1 slot
    expect(repo.upsertMany).toHaveBeenCalledOnce()
    expect(repo.setGeneratedThrough).toHaveBeenCalledWith('p1', '2026-05-12T23:59:59-03:00')
  })

  it('janela vazia: não chama upsert mas ainda avança hwm', async () => {
    const repo = makeRepo()
    const n = await planWindow({
      protocol: { ...protocol, frequency: 'quando_necessário' },
      doseInstanceRepo: repo,
      fromTs: '2026-05-10T00:00:00-03:00',
      toTs: '2026-05-12T23:59:59-03:00',
    })
    expect(n).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
    expect(repo.setGeneratedThrough).toHaveBeenCalledOnce()
  })
})

describe('ensureInstancesUpTo (rede lazy)', () => {
  it('no-op quando hwm já cobre o ts pedido', async () => {
    const repo = makeRepo('2026-06-01T00:00:00.000Z')
    const n = await ensureInstancesUpTo({
      protocol,
      doseInstanceRepo: repo,
      ts: '2026-05-20T00:00:00Z',
    })
    expect(n).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
    expect(repo.setGeneratedThrough).not.toHaveBeenCalled()
  })

  it('gera o gap entre hwm e ts quando descoberto', async () => {
    const repo = makeRepo('2026-05-10T00:00:00.000Z')
    const n = await ensureInstancesUpTo({
      protocol,
      doseInstanceRepo: repo,
      ts: '2026-05-13T00:00:00-03:00',
    })
    expect(n).toBeGreaterThan(0)
    expect(repo.upsertMany).toHaveBeenCalledOnce()
  })

  it('sem hwm: gera a partir de agora', async () => {
    const repo = makeRepo(null)
    const future = new Date(Date.now() + 3 * MS_DAY).toISOString()
    const n = await ensureInstancesUpTo({ protocol, doseInstanceRepo: repo, ts: future })
    expect(n).toBeGreaterThan(0)
    expect(repo.setGeneratedThrough).toHaveBeenCalledOnce()
  })
})

describe('renewProtocolWindow (cron)', () => {
  it('não renova quando hwm ainda está longe do fim', async () => {
    const now = new Date('2026-05-10T00:00:00Z')
    // hwm 25 dias à frente → além do threshold de 7d → não renova
    const repo = makeRepo(new Date(now.getTime() + 25 * MS_DAY).toISOString())
    const n = await renewProtocolWindow({ protocol, doseInstanceRepo: repo, now })
    expect(n).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })

  it('renova quando hwm está dentro do threshold do fim', async () => {
    const now = new Date('2026-05-10T00:00:00Z')
    // hwm 3 dias à frente (< RENEWAL_THRESHOLD_DAYS=7) → renova até now+30d
    const repo = makeRepo(new Date(now.getTime() + 3 * MS_DAY).toISOString())
    const n = await renewProtocolWindow({ protocol, doseInstanceRepo: repo, now })
    expect(n).toBeGreaterThan(0)
    expect(repo.upsertMany).toHaveBeenCalledOnce()
  })

  it('sem hwm: gera do agora até now+30d', async () => {
    const now = new Date('2026-05-10T00:00:00Z')
    const repo = makeRepo(null)
    const n = await renewProtocolWindow({ protocol, doseInstanceRepo: repo, now })
    expect(n).toBe(WINDOW_DAYS) // diário, 1 slot/dia, 30 dias
    expect(repo.setGeneratedThrough).toHaveBeenCalledOnce()
  })

  it('respeita RENEWAL_THRESHOLD_DAYS exportado', () => {
    expect(RENEWAL_THRESHOLD_DAYS).toBe(7)
  })
})
