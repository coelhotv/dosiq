import { describe, it, expect, afterEach, vi } from 'vitest'
import { doseInstancesToEvents, createTimelineService } from '../timelineService.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// ── Fixtures ────────────────────────────────────────────────────────────────
const inst = (id, status, scheduled_for, extra = {}) => ({
  id,
  protocol_id: extra.protocol_id ?? 'p1',
  status,
  scheduled_for,
  expected_dose: 1,
  tolerance_minutes: 120,
  medicine_log_id: extra.medicine_log_id ?? null,
  user_id: 'u1',
})
const log = (id, taken_at, extra = {}) => ({
  id,
  protocol_id: extra.protocol_id ?? 'p1',
  medicine_id: extra.medicine_id ?? 'm1',
  taken_at,
  quantity_taken: extra.quantity_taken ?? 1,
  notes: extra.notes ?? null,
  dose_instance_id: extra.dose_instance_id ?? null,
})

describe('doseInstancesToEvents — dedupe e cobertura', () => {
  it('instância taken + log ancorado = UM evento (não dois)', () => {
    const instances = [inst('i1', 'taken', '2026-05-20T13:00:00Z', { medicine_log_id: 'l1' })]
    const logs = [log('l1', '2026-05-20T13:05:00Z', { dose_instance_id: 'i1' })]
    const events = doseInstancesToEvents(instances, logs)
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('inst:i1')
    expect(events[0].payload.source).toBe('instance')
    expect(events[0].payload.logId).toBe('l1')
    expect(events[0].payload.quantityTaken).toBe(1)
  })

  it('evento taken usa taken_at real como occurred_at (não scheduled_for)', () => {
    const instances = [inst('i1', 'taken', '2026-05-20T13:00:00Z', { medicine_log_id: 'l1' })]
    const logs = [log('l1', '2026-05-20T13:45:00Z', { dose_instance_id: 'i1' })]
    const [e] = doseInstancesToEvents(instances, logs)
    expect(e.occurred_at).toBe('2026-05-20T13:45:00Z')
  })

  it('missed/pending usam scheduled_for como occurred_at', () => {
    const events = doseInstancesToEvents(
      [inst('i1', 'missed', '2026-05-20T13:00:00Z'), inst('i2', 'pending', '2026-05-21T13:00:00Z')],
      [],
    )
    expect(events.find(e => e.id === 'inst:i1').occurred_at).toBe('2026-05-20T13:00:00Z')
    expect(events.find(e => e.id === 'inst:i2').occurred_at).toBe('2026-05-21T13:00:00Z')
  })

  it('log avulso (sem elo, fora de slot) vira evento próprio', () => {
    const instances = [inst('i1', 'taken', '2026-05-20T13:00:00Z', { medicine_log_id: 'l1' })]
    const logs = [
      log('l1', '2026-05-20T13:00:00Z', { dose_instance_id: 'i1' }),
      log('prn', '2026-05-22T09:00:00Z', { protocol_id: 'p2' }), // PRN, longe
    ]
    const events = doseInstancesToEvents(instances, logs)
    expect(events.map(e => e.id).sort()).toEqual(['inst:i1', 'log:prn'])
    const avulso = events.find(e => e.id === 'log:prn')
    expect(avulso.payload.source).toBe('log')
    expect(avulso.payload.status).toBe('taken')
  })

  it('AP-193: log avulso coberto por slot representado (tolerância) é suprimido', () => {
    // instância missed no slot 13:00; log avulso às 13:30 (dentro de 120min, mesmo protocolo)
    const instances = [inst('i1', 'missed', '2026-05-20T13:00:00Z')]
    const logs = [log('orf', '2026-05-20T13:30:00Z')] // sem elo
    const events = doseInstancesToEvents(instances, logs)
    expect(events.map(e => e.id)).toEqual(['inst:i1'])
  })

  it('skipped_* são ocultos da timeline', () => {
    const events = doseInstancesToEvents(
      [inst('i1', 'skipped_paused', '2026-05-20T13:00:00Z'), inst('i2', 'skipped_user', '2026-05-21T13:00:00Z')],
      [],
    )
    expect(events).toHaveLength(0)
  })

  it('elo inverso (log.dose_instance_id) também marca consumo', () => {
    // instância sem medicine_log_id, mas log aponta pra ela → não duplicar
    const instances = [inst('i1', 'taken', '2026-05-20T13:00:00Z')]
    const logs = [log('l1', '2026-05-20T13:00:00Z', { dose_instance_id: 'i1' })]
    const events = doseInstancesToEvents(instances, logs)
    // 1 evento da instância + log consumido (não vira avulso)
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('inst:i1')
  })

  it('enriquece payload com protocolsById quando fornecido', () => {
    const events = doseInstancesToEvents(
      [inst('i1', 'pending', '2026-05-20T13:00:00Z')],
      [],
      { protocolsById: { p1: { medicine_name: 'Apidra', dosage_unit: 'ml' } } },
    )
    expect(events[0].payload.medicineName).toBe('Apidra')
    expect(events[0].payload.dosageUnit).toBe('ml')
  })

  it('robustez: entradas não-array → []', () => {
    expect(doseInstancesToEvents(null, null)).toEqual([])
  })
})

// ── getTimeline (client mockado) ─────────────────────────────────────────────
function makeClient({ instances = [], logs = [] }) {
  const chain = (resolveData) => {
    const obj = {
      select: () => obj,
      eq: () => obj,
      gte: () => obj,
      lte: () => obj,
      gt: () => obj,
      order: () => obj,
      limit: () => obj,
      range: () => obj,
      then: (resolve) => resolve({ data: resolveData, error: null }),
    }
    return obj
  }
  return {
    from: (table) => chain(table === 'dose_instances' ? instances : logs),
  }
}

describe('createTimelineService.getTimeline', () => {
  it('exige userId', async () => {
    const svc = createTimelineService({ client: makeClient({}) })
    await expect(svc.getTimeline({ fromTs: '2026-05-01T00:00:00Z', toTs: '2026-05-30T00:00:00Z' }))
      .rejects.toThrow('userId')
  })

  it('exige client na factory', () => {
    expect(() => createTimelineService({})).toThrow('client')
  })

  it('busca instâncias + logs e retorna stream ordenada desc com localDay', async () => {
    const client = makeClient({
      instances: [
        inst('i1', 'taken', '2026-05-20T13:00:00Z', { medicine_log_id: 'l1' }),
        inst('i2', 'missed', '2026-05-22T13:00:00Z'),
      ],
      logs: [
        log('l1', '2026-05-20T13:00:00Z', { dose_instance_id: 'i1' }),
        log('prn', '2026-05-25T09:00:00Z', { protocol_id: 'p2' }),
      ],
    })
    const svc = createTimelineService({ client })
    const out = await svc.getTimeline({
      userId: 'u1',
      fromTs: '2026-05-19T00:00:00Z',
      toTs: '2026-05-26T00:00:00Z',
      tz: 'America/Sao_Paulo',
    })
    // desc: prn(25) > missed i2(22) > taken i1(20)
    expect(out.map(e => e.id)).toEqual(['log:prn', 'inst:i2', 'inst:i1'])
    expect(out[0].localDay).toBe('2026-05-25')
    expect(out.every(e => typeof e.localDay === 'string')).toBe(true)
  })
})
