import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  resyncProtocolWindow,
  renewProtocolWindow,
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
} from '../doseInstancePlanner'
import type { createDoseInstanceRepository } from '../../repositories/createDoseInstanceRepository'

type Repo = ReturnType<typeof createDoseInstanceRepository>

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

function makeRepo(hwm: string | null = null) {
  const repo = {
    _hwm: hwm,
    upsertMany: vi.fn(async (rows: unknown[]) => rows),
    setGeneratedThrough: vi.fn(async () => {}),
    getGeneratedThrough: vi.fn(async function (this: { _hwm: string | null }) { return this._hwm }),
  }
  return repo as typeof repo & Repo
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

  it('end_date: fim do dia derivado no tz do dono (F4.3f.1)', () => {
    const base = new Date('2026-05-10T00:00:00Z')
    // Mesmo end_date, fusos diferentes → instantes UTC de "fim do dia" distintos.
    const endSP = computeWindowEnd({ ...protocol, end_date: '2026-05-15' }, base, 'America/Sao_Paulo')
    const endLondon = computeWindowEnd({ ...protocol, end_date: '2026-05-15' }, base, 'Europe/London')
    expect(endSP).not.toBe(endLondon)
    // Cada um é o fim do dia 15 no SEU fuso.
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(endSP))).toBe('2026-05-15')
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(endLondon))).toBe('2026-05-15')
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

// 029 F5.5 — a troca de etapa é a única escrita em `protocols` fora do repositório, logo a única
// que escapava do `syncInstancesOnWrite`. Este helper restaura a paridade.
describe('resyncProtocolWindow (paridade com o write-path)', () => {
  const makeResyncRepo = () => {
    const repo = makeRepo()
    return Object.assign(repo, { wipeFuturePending: vi.fn(async () => {}) })
  }

  it('apaga as futuras pending ANTES de regenerar (upsert é ON CONFLICT DO NOTHING)', async () => {
    const repo = makeResyncRepo()
    const ordem: string[] = []
    repo.wipeFuturePending.mockImplementation(async () => { ordem.push('wipe') })
    repo.upsertMany.mockImplementation(async (rows: unknown[]) => { ordem.push('upsert'); return rows })

    await resyncProtocolWindow({ protocol, doseInstanceRepo: repo })

    expect(repo.wipeFuturePending).toHaveBeenCalledWith('p1')
    expect(ordem).toEqual(['wipe', 'upsert'])
  })

  it('materializa a janela inteira (WINDOW_DAYS), não as 72h do alarm scheduler', async () => {
    const repo = makeResyncRepo()
    const n = await resyncProtocolWindow({ protocol, doseInstanceRepo: repo })
    // diário × 30 dias — o buraco do smoke era um protocolo com ZERO instâncias.
    expect(n).toBeGreaterThanOrEqual(WINDOW_DAYS - 1)
  })

  it('dose_change fora da data prevista: a janela nova nasce com a dose da etapa VIGENTE', async () => {
    const repo = makeResyncRepo()
    // Escada cuja etapa vigente (10) começou HOJE por confirmação manual — o cronograma
    // anterior teria previsto outra data, então as instâncias velhas tinham a dose antiga.
    const comEscada = {
      ...protocol,
      dosage_per_intake: 10,
      titration_steps: [
        { position: 0, status: 'completed', dose: 5, duration_days: 14, started_at: '2026-05-01T03:00:00Z' },
        { position: 1, status: 'current', dose: 10, duration_days: null, started_at: '2026-05-10T03:00:00Z' },
      ],
    }
    await resyncProtocolWindow({ protocol: comEscada, doseInstanceRepo: repo })
    const rows = repo.upsertMany.mock.calls[0][0] as { expected_dose: number }[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.expected_dose === 10)).toBe(true)
  })

  it('sem escada no protocolo: cai em dosage_per_intake (protocolo comum, sem titulação)', async () => {
    const repo = makeResyncRepo()
    await resyncProtocolWindow({ protocol: { ...protocol, dosage_per_intake: 2 }, doseInstanceRepo: repo })
    const rows = repo.upsertMany.mock.calls[0][0] as { expected_dose: number }[]
    expect(rows.every((r) => r.expected_dose === 2)).toBe(true)
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
    // hwm logo à frente de agora; ts mais adiante → gap futuro real
    const repo = makeRepo(new Date(Date.now() + 1 * MS_DAY).toISOString())
    const n = await ensureInstancesUpTo({
      protocol,
      doseInstanceRepo: repo,
      ts: new Date(Date.now() + 4 * MS_DAY).toISOString(),
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

  it('hwm no passado: clamp em now (não gera pending retroativo)', async () => {
    const past = new Date(Date.now() - 10 * MS_DAY).toISOString()
    const repo = makeRepo(past)
    const future = new Date(Date.now() + 2 * MS_DAY).toISOString()
    await ensureInstancesUpTo({ protocol, doseInstanceRepo: repo, ts: future })
    // a janela gerada começa em >= now (nenhuma instância anterior a agora)
    const upserted = (repo.upsertMany.mock.calls[0]?.[0] ?? []) as { scheduled_for: string }[]
    const nowMs = Date.now()
    expect(upserted.every((i) => new Date(i.scheduled_for).getTime() >= nowMs - 60000)).toBe(true)
  })

  it('ts inválido (null) não lança — toIsoLike null-safe', async () => {
    const repo = makeRepo('2026-06-01T00:00:00.000Z')
    await expect(ensureInstancesUpTo({ protocol, doseInstanceRepo: repo, ts: null })).resolves.toBeTypeOf('number')
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

  describe('generatedThrough injetado (sem SELECT redundante — ADR-051)', () => {
    it('usa o hwm injetado e NÃO chama getGeneratedThrough', async () => {
      const now = new Date('2026-05-10T00:00:00Z')
      const repo = makeRepo('nunca-deve-ser-lido')
      const injected = new Date(now.getTime() + 3 * MS_DAY).toISOString() // dentro do threshold → renova
      const n = await renewProtocolWindow({ protocol, doseInstanceRepo: repo, generatedThrough: injected, now })
      expect(n).toBeGreaterThan(0)
      expect(repo.getGeneratedThrough).not.toHaveBeenCalled()
    })

    it('generatedThrough=null injetado → trata como nunca gerado, sem SELECT', async () => {
      const now = new Date('2026-05-10T00:00:00Z')
      const repo = makeRepo('ignorado')
      const n = await renewProtocolWindow({ protocol, doseInstanceRepo: repo, generatedThrough: null, now })
      expect(n).toBe(WINDOW_DAYS)
      expect(repo.getGeneratedThrough).not.toHaveBeenCalled()
    })

    it('generatedThrough omitido → fallback faz o SELECT (retrocompat)', async () => {
      const repo = makeRepo(null)
      await renewProtocolWindow({ protocol, doseInstanceRepo: repo, now: new Date('2026-05-10T00:00:00Z') })
      expect(repo.getGeneratedThrough).toHaveBeenCalledOnce()
    })
  })
})
