// Tests — createDoseInstanceRepository (ADR-048, Fase 2 PR-F2.1)
//
// Foco: idempotência do upsert (ON CONFLICT DO NOTHING) e a regra inviolável do
// wipe (nunca toca taken/missed/skipped nem o passado). Mock builder fluente —
// não toca no Supabase real (espelha createProtocolRepository.test.js).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDoseInstanceRepository } from '../createDoseInstanceRepository'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function makeBuilder(result: any) {
  const builder = {
    _calls: [] as any[],
    select: vi.fn(function (...a) { this._calls.push(['select', a]); return this }),
    insert: vi.fn(function (...a) { this._calls.push(['insert', a]); return this }),
    upsert: vi.fn(function (...a) { this._calls.push(['upsert', a]); return this }),
    update: vi.fn(function (...a) { this._calls.push(['update', a]); return this }),
    delete: vi.fn(function (...a) { this._calls.push(['delete', a]); return this }),
    eq:     vi.fn(function (...a) { this._calls.push(['eq', a]); return this }),
    in:     vi.fn(function (...a) { this._calls.push(['in', a]); return this }),
    gt:     vi.fn(function (...a) { this._calls.push(['gt', a]); return this }),
    gte:    vi.fn(function (...a) { this._calls.push(['gte', a]); return this }),
    lte:    vi.fn(function (...a) { this._calls.push(['lte', a]); return this }),
    order:  vi.fn(function (...a) { this._calls.push(['order', a]); return this }),
    range:  vi.fn(function (...a) { this._calls.push(['range', a]); return this }),
    single: vi.fn(function ()     { this._calls.push(['single', []]); return Promise.resolve(result) }),
    then:   (resolve: any) => resolve(result),
  }
  return builder
}

function makeClient(result: any) {
  const builder = makeBuilder(result)
  const client = {
    _builder: builder,
    _from: null as string | null,
    from: vi.fn((table: string) => { client._from = table; return builder }),
    // 067/B: pausa/retomada saíram do UPDATE cru e viraram RPC (ADR-092).
    rpc: vi.fn(async () => ({ data: { affected: 0 }, error: null })),
  }
  return client as any
}

function callNames(builder: any) {
  return builder._calls.map(([name]: [string]) => name)
}

describe('createDoseInstanceRepository', () => {
  it('exige client', () => {
    expect(() => createDoseInstanceRepository({} as any)).toThrow(/client é obrigatório/)
  })

  describe('upsertMany — idempotência', () => {
    let client: any, repo: any
    beforeEach(() => {
      client = makeClient({ data: [{ id: 'di-1' }], error: null })
      repo = createDoseInstanceRepository({ client })
    })

    it('usa ON CONFLICT DO NOTHING (onConflict + ignoreDuplicates)', async () => {
      await repo.upsertMany([{ protocol_id: 'p1', scheduled_for: '2026-05-10T11:00:00Z' }])
      const upsertCall = client._builder._calls.find(([n]: [string]) => n === 'upsert')
      expect(client._from).toBe('dose_instances')
      expect(upsertCall[1][1]).toEqual({
        onConflict: 'protocol_id,scheduled_for',
        ignoreDuplicates: true,
      })
    })

    it('array vazio → [] sem tocar no client', async () => {
      const out = await repo.upsertMany([])
      expect(out).toEqual([])
      expect(client.from).not.toHaveBeenCalled()
    })

    it('propaga erro do Supabase', async () => {
      client = makeClient({ data: null, error: new Error('boom') })
      repo = createDoseInstanceRepository({ client })
      await expect(repo.upsertMany([{ protocol_id: 'p1' }])).rejects.toThrow('boom')
    })
  })

  describe('wipeFuturePending — regra inviolável', () => {
    it('filtra status=pending E scheduled_for > now (nunca passado/taken/missed)', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      const before = Date.now()
      await repo.wipeFuturePending('p1')

      const b = client._builder
      expect(client._from).toBe('dose_instances')
      expect(callNames(b)).toContain('delete')
      // escopo por protocolo + status pending/skipped_paused
      expect(b.eq).toHaveBeenCalledWith('protocol_id', 'p1')
      expect(b.in).toHaveBeenCalledWith('status', ['pending', 'skipped_paused'])
      // corte temporal estritamente futuro (gt, não gte)
      const gtCall = b._calls.find(([n]: [string]) => n === 'gt')
      expect(gtCall[1][0]).toBe('scheduled_for')
      const cutoff = new Date(gtCall[1][1]).getTime()
      expect(cutoff).toBeGreaterThanOrEqual(before)
    })
  })

  describe('markSkippedPaused', () => {
    it('vai por RPC com mode pause_until e o limite declarado (067/B, FR-030)', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      const until = '2026-05-11T00:00:00Z'
      await repo.markSkippedPaused('u1', 'p1', until)

      expect(client.rpc).toHaveBeenCalledWith('set_protocol_dose_state_atomic', {
        p_user_id: 'u1',
        p_protocol_id: 'p1',
        p_mode: 'pause_until',
        p_until: new Date(until).toISOString(),
      })
      // Nenhum UPDATE cru sobrevive — é o ponto do REVOKE (SC-008).
      expect(client.from).not.toHaveBeenCalled()
    })

    it('propaga erro da RPC (recusa nunca vira sucesso mudo — R-305)', async () => {
      const client = makeClient({ data: null, error: null })
      client.rpc = vi.fn(async () => ({ data: null, error: { message: 'Acesso não autorizado' } }))
      const repo = createDoseInstanceRepository({ client })
      await expect(repo.markSkippedPaused('u1', 'p1', '2026-05-11T00:00:00Z')).rejects.toMatchObject({
        message: 'Acesso não autorizado',
      })
    })
  })

  describe('markAllFutureSkippedPaused', () => {
    it('vai por RPC com mode pause_all (writer REAL da pausa — C1.5/F-B1)', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      await repo.markAllFutureSkippedPaused('u1', 'p1')

      expect(client.rpc).toHaveBeenCalledWith('set_protocol_dose_state_atomic', {
        p_user_id: 'u1',
        p_protocol_id: 'p1',
        p_mode: 'pause_all',
        p_until: null,
      })
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  describe('wipeFuturePendingForProtocols', () => {
    it('DELETE único em lote com .in() + pending + futuro', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      const before = Date.now()
      await repo.wipeFuturePendingForProtocols(['p1', 'p2'])

      const b = client._builder
      expect(client._from).toBe('dose_instances')
      expect(callNames(b)).toContain('delete')
      expect(b.in).toHaveBeenCalledWith('protocol_id', ['p1', 'p2'])
      expect(b.in).toHaveBeenCalledWith('status', ['pending', 'skipped_paused'])
      const gtCall = b._calls.find(([n]: [string]) => n === 'gt')
      expect(gtCall[1][0]).toBe('scheduled_for')
      expect(new Date(gtCall[1][1]).getTime()).toBeGreaterThanOrEqual(before)
    })

    it('lista vazia → no-op (não toca client)', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      await repo.wipeFuturePendingForProtocols([])
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  describe('reactivateFuturePaused', () => {
    it('vai por RPC com mode resume (067/B, FR-030)', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      await repo.reactivateFuturePaused('u1', 'p1')

      expect(client.rpc).toHaveBeenCalledWith('set_protocol_dose_state_atomic', {
        p_user_id: 'u1',
        p_protocol_id: 'p1',
        p_mode: 'resume',
        p_until: null,
      })
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  describe('getWindow', () => {
    it('escopa por userId e ordena por scheduled_for ascendente', async () => {
      const client = makeClient({ data: [{ id: 'di-1' }], error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.getWindow('u1', '2026-05-10T00:00:00Z', '2026-05-10T23:59:59Z')

      const b = client._builder
      expect(b.eq).toHaveBeenCalledWith('user_id', 'u1')
      expect(b.gte).toHaveBeenCalled()
      expect(b.lte).toHaveBeenCalled()
      expect(b.order).toHaveBeenCalledWith('scheduled_for', { ascending: true })
      expect(out).toEqual([{ id: 'di-1' }])
    })
  })

  describe('generated_through high-water-mark', () => {
    it('getGeneratedThrough lê de protocols e retorna o valor', async () => {
      const client = makeClient({ data: { generated_through: '2026-06-01T00:00:00Z' }, error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.getGeneratedThrough('p1')
      expect(client._from).toBe('protocols')
      expect(out).toBe('2026-06-01T00:00:00Z')
    })

    it('setGeneratedThrough atualiza protocols.generated_through', async () => {
      const client = makeClient({ data: null, error: null })
      const repo = createDoseInstanceRepository({ client })
      await repo.setGeneratedThrough('p1', '2026-06-01T00:00:00Z')
      const b = client._builder
      expect(client._from).toBe('protocols')
      expect(b.update).toHaveBeenCalledWith({ generated_through: '2026-06-01T00:00:00.000Z' })
      expect(b.eq).toHaveBeenCalledWith('id', 'p1')
    })
  })

  describe('findAnchorInstance — snap por tolerância (S2.6)', () => {
    const takenAt = '2026-05-10T22:35:00Z' // 22:35

    it('escopa por protocol_id + status pending|missed (AP-A03, re-anchor F2.5)', async () => {
      const client = makeClient({ data: [], error: null })
      const repo = createDoseInstanceRepository({ client })
      await repo.findAnchorInstance({ protocolId: 'p1', takenAt })

      const b = client._builder
      expect(client._from).toBe('dose_instances')
      expect(b.eq).toHaveBeenCalledWith('protocol_id', 'p1')
      expect(b.in).toHaveBeenCalledWith('status', ['pending', 'missed'])
      // janela grosseira do SELECT usa gte/lte (±120min)
      expect(b.gte).toHaveBeenCalled()
      expect(b.lte).toHaveBeenCalled()
    })

    it('pega a instância mais próxima quando há várias dentro da tolerância', async () => {
      const client = makeClient({
        data: [
          { id: 'far', scheduled_for: '2026-05-10T22:50:00Z', tolerance_minutes: 120 }, // 15min
          { id: 'near', scheduled_for: '2026-05-10T22:30:00Z', tolerance_minutes: 120 }, // 5min
        ],
        error: null,
      })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.findAnchorInstance({ protocolId: 'p1', takenAt })
      expect(out?.id).toBe('near')
    })

    it('respeita a tolerância de CADA linha — exclui slot fora da própria janela', async () => {
      // 21:00 está a 95min de 22:35; com tolerance 60 → fora; volta null.
      const client = makeClient({
        data: [{ id: 'tight', scheduled_for: '2026-05-10T21:00:00Z', tolerance_minutes: 60 }],
        error: null,
      })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.findAnchorInstance({ protocolId: 'p1', takenAt })
      expect(out).toBeNull()
    })

    it('sem candidatos → null (dose avulsa)', async () => {
      const client = makeClient({ data: [], error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.findAnchorInstance({ protocolId: 'p1', takenAt })
      expect(out).toBeNull()
    })

    it('protocolId ausente → null sem tocar no client', async () => {
      const client = makeClient({ data: [], error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.findAnchorInstance({ protocolId: null as any, takenAt })
      expect(out).toBeNull()
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  describe('markTaken — elo instância↔log (FP-1)', () => {
    it('marca taken + medicine_log_id, guard status=pending, retorna true se reservou', async () => {
      const client = makeClient({ data: [{ id: 'di-1' }], error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.markTaken('di-1', 'log-9')

      const b = client._builder
      expect(client._from).toBe('dose_instances')
      expect(b.update).toHaveBeenCalledWith({ status: 'taken', medicine_log_id: 'log-9' })
      expect(b.eq).toHaveBeenCalledWith('id', 'di-1')
      expect(b.in).toHaveBeenCalledWith('status', ['pending', 'missed', 'skipped_user'])
      expect(b.select).toHaveBeenCalledWith('id')
      expect(out).toBe(true)
    })

    it('retorna false em no-op (corrida: instância já taken)', async () => {
      const client = makeClient({ data: [], error: null })
      const repo = createDoseInstanceRepository({ client })
      const out = await repo.markTaken('di-1', 'log-9')
      expect(out).toBe(false)
    })

    it('propaga erro do Supabase', async () => {
      const client = makeClient({ data: null, error: new Error('boom') })
      const repo = createDoseInstanceRepository({ client })
      await expect(repo.markTaken('di-1', 'log-9')).rejects.toThrow('boom')
    })
  })
})
