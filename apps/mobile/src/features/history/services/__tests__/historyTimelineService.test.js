/**
 * Testes unitários de historyTimelineService (spec 033, SC-007 — ≥80% cobertura).
 * Cobre: buildProtocolsById, mapToMobileShape, getHistoryTimeline (happy + failure modes).
 * Mocks: supabase, measuresRepo, @dosiq/core services.
 */

// ─── Mocks (antes dos imports) ──────────────────────────────────────────────

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}))

jest.mock('../../../measures/services/measuresRepo', () => ({
  measuresRepo: {
    list: jest.fn(),
  },
}))

// Mock @dosiq/core — controla getTimeline e biomarkersToEvents
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return {
    ...actual,
    createTimelineService: jest.fn(),
    biomarkersToEvents: jest.fn(),
    buildTimeline: jest.fn(),
    TIMELINE_ORDER: { ASC: 'asc', DESC: 'desc' },
  }
})

// ─── Imports (depois dos mocks) ──────────────────────────────────────────────

import { createTimelineService, biomarkersToEvents, buildTimeline } from '@dosiq/core'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'
import { measuresRepo } from '../../../measures/services/measuresRepo'
import { buildProtocolsById, mapToMobileShape, getHistoryTimeline } from '../historyTimelineService'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROTOCOL = {
  id: 'p1',
  name: 'Metformina 850mg',
  medicine_id: 'm1',
  dosage_per_intake: 1,
  intake_unit: 'cp',
  medicine: { name: 'Metformina', dosage_per_pill: 850, dosage_unit: 'mg', units_per_ml: null },
  treatment_plan: { name: 'Diabetes T2' },
}

const DOSE_EVENT = {
  id: 'ev-dose-1',
  type: 'dose',
  occurred_at: '2026-06-16T11:00:00Z',
  localDay: '2026-06-16',
  payload: {
    source: 'instance',
    instanceId: 'inst-1',
    protocolId: 'p1',
    status: 'taken',
    scheduledFor: '2026-06-16T11:00:00Z',
    expectedDose: 1,
    logId: null,
    medicineId: 'm1',
    quantityTaken: 1,
    notes: null,
    medicineName: 'Metformina',
    dosageUnit: 'mg',
  },
}

const BIO_EVENT = {
  id: 'ev-bio-1',
  type: 'biomarker',
  occurred_at: '2026-06-16T08:00:00Z',
  localDay: '2026-06-16',
  payload: {
    source: 'biomarker',
    biomarkerId: 'bio-1',
    biomarkerType: 'glicemia',
    value: 120,
    valueSecondary: null,
    unit: 'mg/dL',
    context: 'jejum',
    notes: null,
  },
}

const BIO_ROW = {
  id: 'bio-1',
  type: 'glicemia',
  value: 120,
  value_secondary: null,
  unit: 'mg/dL',
  context: 'jejum',
  measured_at: '2026-06-16T08:00:00Z',
}

// ─── Setup/Teardown ───────────────────────────────────────────────────────────

let mockGetTimeline

beforeEach(() => {
  jest.clearAllMocks()

  // createTimelineService retorna objeto com getTimeline mockado
  mockGetTimeline = jest.fn()
  createTimelineService.mockReturnValue({ getTimeline: mockGetTimeline })

  // Supabase .from() default: retorna erro (para buildProtocolsById)
  supabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined,
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

// ─── buildProtocolsById ───────────────────────────────────────────────────────

describe('buildProtocolsById', () => {
  function mockProtocolsQuery(protocols) {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: protocols, error: null }),
    }
    supabase.from.mockReturnValue(chain)
    return chain
  }

  test('retorna mapa indexado por id', async () => {
    mockProtocolsQuery([PROTOCOL])
    const result = await buildProtocolsById('user-1')
    expect(result).toEqual({ p1: PROTOCOL })
  })

  test('retorna {} em caso de erro do supabase', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    }
    supabase.from.mockReturnValue(chain)
    const result = await buildProtocolsById('user-1')
    expect(result).toEqual({})
  })

  test('retorna {} quando data é null (sem protocolos)', async () => {
    mockProtocolsQuery(null)
    const result = await buildProtocolsById('user-1')
    expect(result).toEqual({})
  })
})

// ─── mapToMobileShape ─────────────────────────────────────────────────────────

describe('mapToMobileShape', () => {
  test('evento dose → shape flat com campos corretos', () => {
    const protocolsById = { p1: PROTOCOL }
    const [item] = mapToMobileShape([DOSE_EVENT], protocolsById)

    expect(item.type).toBe('dose')
    expect(item.id).toBe('ev-dose-1')
    expect(item.localDay).toBe('2026-06-16')
    expect(item.scheduled_for).toBe('2026-06-16T11:00:00Z')
    expect(item.status).toBe('taken')
    expect(item.medicine_name).toBe('Metformina')
    expect(item.protocol_name).toBe('Metformina 850mg')
    expect(item.dosage_per_pill).toBe(850)
    expect(item.dosage_per_intake).toBe(1)
    expect(item.intake_unit).toBe('cp')
    expect(item.is_orphan).toBe(false)
    expect(item.instanceId).toBe('inst-1')
    expect(item.protocol_id).toBe('p1')
  })

  test('evento log avulso → is_orphan true', () => {
    const orphanEvent = {
      ...DOSE_EVENT,
      id: 'ev-log-1',
      payload: { ...DOSE_EVENT.payload, source: 'log', logId: 'log-1', instanceId: null },
    }
    const [item] = mapToMobileShape([orphanEvent], {})
    expect(item.is_orphan).toBe(true)
    expect(item.logId).toBe('log-1')
  })

  test('evento biomarker → shape flat com bioType/value/unit', () => {
    const [item] = mapToMobileShape([BIO_EVENT], {})

    expect(item.type).toBe('biomarker')
    expect(item.id).toBe('ev-bio-1')
    expect(item.localDay).toBe('2026-06-16')
    expect(item.bioType).toBe('glicemia')
    expect(item.value).toBe(120)
    expect(item.value_secondary).toBeNull()
    expect(item.unit).toBe('mg/dL')
    expect(item.context).toBe('jejum')
    expect(item.biomarkerId).toBe('bio-1')
    expect(item.measured_at).toBe('2026-06-16T08:00:00Z')
  })

  test('dose sem protocolo no map — usa fallbacks do payload', () => {
    const [item] = mapToMobileShape([DOSE_EVENT], {})
    expect(item.medicine_name).toBe('Metformina') // do payload.medicineName
    expect(item.dosage_per_pill).toBeNull()        // sem protocolo no map
  })

  test('array misto — mantém ordem', () => {
    const items = mapToMobileShape([BIO_EVENT, DOSE_EVENT], { p1: PROTOCOL })
    expect(items[0].type).toBe('biomarker')
    expect(items[1].type).toBe('dose')
  })
})

// ─── getHistoryTimeline ───────────────────────────────────────────────────────

describe('getHistoryTimeline', () => {
  function setupSupa(protocols) {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: protocols, error: null }),
    }
    supabase.from.mockReturnValue(chain)
  }

  test('happy path — doses + biomarkers mesclados e mapeados', async () => {
    setupSupa([PROTOCOL])
    mockGetTimeline.mockResolvedValue([DOSE_EVENT])
    measuresRepo.list.mockResolvedValue([BIO_ROW])
    biomarkersToEvents.mockReturnValue([BIO_EVENT])
    buildTimeline.mockReturnValue([BIO_EVENT, DOSE_EVENT])

    const items = await getHistoryTimeline('user-1', { tz: 'America/Sao_Paulo' })

    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('biomarker')
    expect(items[1].type).toBe('dose')
    expect(measuresRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ fromTs: expect.any(String), toTs: expect.any(String) })
    )
  })

  test('biomarkers vazia — retorna só doses sem chamar buildTimeline', async () => {
    setupSupa([PROTOCOL])
    mockGetTimeline.mockResolvedValue([DOSE_EVENT])
    measuresRepo.list.mockResolvedValue([])

    const items = await getHistoryTimeline('user-1', { tz: 'America/Sao_Paulo' })

    expect(buildTimeline).not.toHaveBeenCalled()
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('dose')
  })

  test('GAP-1: falha de biomarkers não derruba doses (best-effort)', async () => {
    setupSupa([PROTOCOL])
    mockGetTimeline.mockResolvedValue([DOSE_EVENT])
    measuresRepo.list.mockRejectedValue(new Error('network fail'))

    const items = await getHistoryTimeline('user-1', { tz: 'America/Sao_Paulo' })

    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('dose')
  })

  test('getTimeline lança — propaga erro', async () => {
    setupSupa([PROTOCOL])
    mockGetTimeline.mockRejectedValue(new Error('supabase fail'))

    await expect(getHistoryTimeline('user-1')).rejects.toThrow('supabase fail')
  })

  test('passa protocolsById correto para getTimeline', async () => {
    setupSupa([PROTOCOL])
    mockGetTimeline.mockResolvedValue([])
    measuresRepo.list.mockResolvedValue([])

    await getHistoryTimeline('user-1', { tz: 'America/Sao_Paulo' })

    expect(mockGetTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tz: 'America/Sao_Paulo',
        protocolsById: { p1: PROTOCOL },
      })
    )
  })
})

// ─── KPI isolation (ADR-054, SC-004) ─────────────────────────────────────────

describe('ADR-054 — KPI isolation via mapToMobileShape', () => {
  test('eventos biomarker NÃO geram items type=dose', () => {
    const items = mapToMobileShape([BIO_EVENT], {})
    const doseItems = items.filter(ev => ev.type === 'dose')
    expect(doseItems).toHaveLength(0)
  })

  test('evento dose NÃO gera items type=biomarker', () => {
    const items = mapToMobileShape([DOSE_EVENT], { p1: PROTOCOL })
    const bioItems = items.filter(ev => ev.type === 'biomarker')
    expect(bioItems).toHaveLength(0)
  })

  test('filtrar type===dose isola stream para KPI', () => {
    const items = mapToMobileShape([BIO_EVENT, DOSE_EVENT], { p1: PROTOCOL })
    const doseItems = items.filter(ev => ev.type === 'dose')
    expect(doseItems).toHaveLength(1)
    expect(doseItems[0].status).toBe('taken')
  })
})
