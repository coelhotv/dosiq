// treatmentMeasureService — leitor da série de peso (069 Bb · PO-8 · analysis-Bb failure modes).
// Datas locais literais; "hoje" fixado pelo fuso do dono (AP-270).

import { describe, it, expect, afterEach, beforeEach } from '@jest/globals'

const mockLadder = jest.fn()
const mockTz = jest.fn()
const mockToday = jest.fn()
const mockBiomarkerPage = jest.fn()
const mockRpcPage = jest.fn()
const mockRpc = jest.fn()
const mockEq = jest.fn()

jest.mock('@treatments/services/titrationService', () => ({
  getLadderForProtocol: (...a) => mockLadder(...a),
  getUserTimezone: (...a) => mockTz(...a),
}))

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return { ...actual, getTodayLocal: (...a) => mockToday(...a) }
})

jest.mock('@platform/supabase/nativeSupabaseClient', () => {
  const chain: any = {}
  chain.select = () => chain
  chain.eq = (...a) => {
    mockEq(...a)
    return chain
  }
  chain.gte = () => chain
  chain.lte = () => chain
  chain.order = () => chain
  chain.range = (a, b) => mockBiomarkerPage(a, b)
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
      from: () => chain,
      rpc: (name, args) => {
        mockRpc(name, args)
        return { range: (a, b) => mockRpcPage(args, a, b) }
      },
    },
  }
})

import { loadTreatmentMeasureSeries, MEASURE_PAGE_SIZE } from '../treatmentMeasureService'

const MOUN = {
  id: 'm_moun',
  presentation: 'injetavel',
  dosage_unit: 'mg/ml',
  dosage_per_pill: 10,
  units_per_ml: null,
  concentration_volume_ml: 0.5,
}

const PROTO = {
  id: 'p_moun',
  medicine_id: 'm_moun',
  frequency: 'semanal',
  intake_unit: 'mg',
  dosage_per_intake: 5,
  start_date: '2026-09-01',
  medicine: MOUN,
}

const peso = (day: string, kg: number, id = day) => ({ id, type: 'peso', value: kg, measured_at: `${day}T07:00:00-03:00` })

describe('loadTreatmentMeasureSeries', () => {
  beforeEach(() => {
    mockLadder.mockResolvedValue([])
    mockTz.mockResolvedValue('America/Sao_Paulo')
    mockToday.mockReturnValue('2026-10-05')
    mockBiomarkerPage.mockResolvedValue({ data: [], error: null })
    mockRpcPage.mockResolvedValue({ data: [], error: null })
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('sem escada: janela desde start_date até hoje do dono; 1 fatia da RPC; user_id explícito', async () => {
    mockBiomarkerPage.mockResolvedValue({
      data: [peso('2026-09-02', 90), peso('2026-09-10', 89), peso('2026-09-20', 88)],
      error: null,
    })
    const r = await loadTreatmentMeasureSeries(PROTO as any)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('report_dose_days', { p_from: '2026-09-01', p_to: '2026-10-05' })
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockEq).toHaveBeenCalledWith('type', 'peso')
    expect(r?.state).toBe('B0')
    expect(r?.hasLadder).toBe(false)
    expect(r?.today).toBe('2026-10-05')
  })

  it('hoje vem do fuso do DONO (E-B3)', async () => {
    mockTz.mockResolvedValue('Asia/Tokyo')
    await loadTreatmentMeasureSeries(PROTO as any)
    expect(mockToday).toHaveBeenCalledWith('Asia/Tokyo')
  })

  it('fuso indisponível: fallback São Paulo, sem erro', async () => {
    mockTz.mockRejectedValue(new Error('x'))
    await loadTreatmentMeasureSeries(PROTO as any)
    expect(mockToday).toHaveBeenCalledWith('America/Sao_Paulo')
  })

  it('janela de 400 dias: RPC chamada por fatias ≤ 186 dias, contíguas', async () => {
    await loadTreatmentMeasureSeries({ ...PROTO, start_date: '2025-09-01' } as any)
    const calls = mockRpc.mock.calls.map((c) => c[1])
    expect(calls.length).toBe(3)
    expect(calls[0].p_from).toBe('2025-09-01')
    expect(calls[calls.length - 1].p_to).toBe('2026-10-05')
  })

  it('página cheia: lê a próxima até a incompleta (AP-186)', async () => {
    const full = Array.from({ length: MEASURE_PAGE_SIZE }, (_, i) => peso('2026-09-02', 90, `a${i}`))
    mockBiomarkerPage
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [peso('2026-09-20', 88)], error: null })
    mockRpcPage
      .mockResolvedValueOnce({ data: Array.from({ length: MEASURE_PAGE_SIZE }, () => ({ protocol_id: 'x', day: '2026-09-02', taken_count: 1, missed_count: 0 })), error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const r = await loadTreatmentMeasureSeries(PROTO as any)
    expect(mockBiomarkerPage).toHaveBeenCalledWith(MEASURE_PAGE_SIZE, 2 * MEASURE_PAGE_SIZE - 1)
    expect(mockRpcPage).toHaveBeenCalledTimes(2)
    expect(r?.series.points.map((p) => p.day)).toEqual(['2026-09-02', '2026-09-20'])
  })

  it('doses contam pelo protocol_id da linha (R-299): outro protocolo fica fora', async () => {
    mockRpcPage.mockResolvedValue({
      data: [
        { protocol_id: 'p_moun', medicine_id: 'm_old', day: '2026-09-08', taken_count: 1, missed_count: 0 },
        { protocol_id: 'p_outro', medicine_id: 'm_moun', day: '2026-09-08', taken_count: 3, missed_count: 2 },
      ],
      error: null,
    })
    const r = await loadTreatmentMeasureSeries(PROTO as any)
    expect(r?.series.steps[0]).toMatchObject({ taken: 1, expected: 1 })
  })

  it('falha de uma fatia LANÇA (nunca série parcial)', async () => {
    mockRpcPage.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } })
    await expect(loadTreatmentMeasureSeries({ ...PROTO, start_date: '2025-09-01' } as any)).rejects.toMatchObject({ code: 'XX000' })
  })

  it('start_date futuro: nenhuma leitura de peso/RPC, B3', async () => {
    const r = await loadTreatmentMeasureSeries({ ...PROTO, start_date: '2026-11-01' } as any)
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockBiomarkerPage).not.toHaveBeenCalled()
    expect(r?.state).toBe('B3')
  })

  it('start_date nulo sem escada: janela de 1 dia, sem erro', async () => {
    await loadTreatmentMeasureSeries({ ...PROTO, start_date: null } as any)
    expect(mockRpc).toHaveBeenCalledWith('report_dose_days', { p_from: '2026-10-05', p_to: '2026-10-05' })
  })

  it('oral diário: null (não elegível)', async () => {
    const r = await loadTreatmentMeasureSeries({
      ...PROTO,
      frequency: 'diário',
      medicine: { ...MOUN, presentation: 'comprimido', dosage_unit: 'mg' },
    } as any)
    expect(r).toBeNull()
  })

  it('escada de 2+ etapas: hasLadder e janela da 1ª etapa iniciada', async () => {
    mockLadder.mockResolvedValue([
      { position: 1, medicine_id: 'm_moun', dose: 2.5, intake_unit: 'mg', duration_days: 28, status: 'completed', started_at: '2026-08-10T09:00:00-03:00', ended_at: '2026-09-07T09:00:00-03:00', medicine: MOUN },
      { position: 2, medicine_id: 'm_moun', dose: 5, intake_unit: 'mg', duration_days: null, status: 'current', started_at: '2026-09-07T09:00:00-03:00', ended_at: null, medicine: MOUN },
    ])
    const r = await loadTreatmentMeasureSeries(PROTO as any)
    expect(r?.hasLadder).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('report_dose_days', { p_from: '2026-08-10', p_to: '2026-10-05' })
  })
})
