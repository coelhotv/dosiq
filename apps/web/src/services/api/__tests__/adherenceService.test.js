import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks hoisted (avaliados antes dos imports do módulo testado).
const mocks = vi.hoisted(() => {
  const repo = {
    countByStatus: vi.fn(),
    getWindow: vi.fn(),
  }
  // Builder Supabase encadeável: thenable (resolve lista) + .single().
  let listResult = { data: [], error: null }
  let singleResult = { data: null, error: null }
  const makeBuilder = () => {
    const b = {}
    b.select = vi.fn(() => b)
    b.eq = vi.fn(() => b)
    b.single = vi.fn(() => Promise.resolve(singleResult))
    b.then = (resolve) => resolve(listResult)
    return b
  }
  return {
    repo,
    setList: (r) => { listResult = r },
    setSingle: (r) => { singleResult = r },
    from: vi.fn(() => makeBuilder()),
    getUserId: vi.fn(() => Promise.resolve('u1')),
  }
})

vi.mock('@shared/utils/supabase', () => ({
  supabase: { from: mocks.from },
  getUserId: mocks.getUserId,
}))

vi.mock('@dosiq/core', async (importActual) => {
  const actual = await importActual()
  return { ...actual, createDoseInstanceRepository: () => mocks.repo }
})

import { adherenceService } from '../adherenceService'

// scheduled_for absoluto; dia local SP (UTC-3).
const at = (day, hourUtc = '12') => `${day}T${hourUtc}:00:00.000Z`
const di = (status, extra = {}) => ({ status, protocol_id: 'p1', scheduled_for: at('2026-05-20'), ...extra })

describe('adherenceService — leitura de dose_instances (Fase 3)', () => {
  beforeEach(() => {
    mocks.repo.countByStatus.mockReset()
    mocks.repo.getWindow.mockReset()
    mocks.setList({ data: [], error: null })
    mocks.setSingle({ data: null, error: null })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('calculateAdherence', () => {
    it('score = taken/(taken+missed)*100; pending/skipped fora do denominador', async () => {
      mocks.repo.countByStatus.mockResolvedValue({
        taken: 8, missed: 2, pending: 5, skipped_paused: 1, skipped_user: 3,
      })
      const r = await adherenceService.calculateAdherence('30d', 'u1')
      expect(r.score).toBe(80)
      expect(r.taken).toBe(8)
      expect(r.expected).toBe(10) // taken + missed
      expect(r.period).toBe('30d')
    })

    it('sem dados → score 0, expected 0 (não NaN)', async () => {
      mocks.repo.countByStatus.mockResolvedValue({
        taken: 0, missed: 0, pending: 0, skipped_paused: 0, skipped_user: 0,
      })
      const r = await adherenceService.calculateAdherence('7d', 'u1')
      expect(r.score).toBe(0)
      expect(r.expected).toBe(0)
    })

    it('passa a janela ao countByStatus', async () => {
      mocks.repo.countByStatus.mockResolvedValue({ taken: 1, missed: 0, pending: 0, skipped_paused: 0, skipped_user: 0 })
      await adherenceService.calculateAdherence('30d', 'u1')
      expect(mocks.repo.countByStatus).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', fromTs: expect.any(Date), toTs: expect.any(Date) })
      )
    })
  })

  describe('calculateProtocolAdherence', () => {
    it('escopa por protocolId e devolve nome', async () => {
      mocks.setSingle({ data: { name: 'Losartana AM', medicine: { name: 'Losartana' } }, error: null })
      mocks.repo.countByStatus.mockResolvedValue({ taken: 9, missed: 1, pending: 0, skipped_paused: 0, skipped_user: 0 })
      const r = await adherenceService.calculateProtocolAdherence('p1', '30d', 'u1')
      expect(r.score).toBe(90)
      expect(r.name).toBe('Losartana AM')
      expect(r.medicineName).toBe('Losartana')
      expect(mocks.repo.countByStatus).toHaveBeenCalledWith(expect.objectContaining({ protocolId: 'p1' }))
    })
  })

  describe('calculateAllProtocolsAdherence', () => {
    it('agrupa instâncias por protocolo', async () => {
      mocks.setList({ data: [
        { id: 'p1', name: 'P1', medicine: { name: 'M1' } },
        { id: 'p2', name: 'P2', medicine: { name: 'M2' } },
      ], error: null })
      mocks.repo.getWindow.mockResolvedValue([
        di('taken', { protocol_id: 'p1' }),
        di('taken', { protocol_id: 'p1' }),
        di('missed', { protocol_id: 'p1' }),
        di('taken', { protocol_id: 'p2' }),
      ])
      const r = await adherenceService.calculateAllProtocolsAdherence('30d', 'u1')
      const p1 = r.find((x) => x.protocolId === 'p1')
      const p2 = r.find((x) => x.protocolId === 'p2')
      expect(p1.score).toBe(67) // 2/3
      expect(p1.taken).toBe(2)
      expect(p1.expected).toBe(3)
      expect(p2.score).toBe(100)
    })

    it('sem protocolos → []', async () => {
      mocks.setList({ data: [], error: null })
      const r = await adherenceService.calculateAllProtocolsAdherence('30d', 'u1')
      expect(r).toEqual([])
    })
  })

  describe('getCurrentStreak', () => {
    it('current + longest das instâncias 90d', async () => {
      mocks.repo.getWindow.mockResolvedValue([
        di('taken', { scheduled_for: at('2026-05-18') }),
        di('taken', { scheduled_for: at('2026-05-19') }),
        di('missed', { scheduled_for: at('2026-05-17') }),
      ])
      const r = await adherenceService.getCurrentStreak('u1')
      expect(r).toHaveProperty('currentStreak')
      expect(r).toHaveProperty('longestStreak')
      expect(r.longestStreak).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getAdherenceSummary', () => {
    it('overall + protocolScores + streaks de 1 janela', async () => {
      mocks.setList({ data: [{ id: 'p1', name: 'P1', medicine: { name: 'M1' } }], error: null })
      mocks.repo.getWindow.mockResolvedValue([
        di('taken', { protocol_id: 'p1' }),
        di('missed', { protocol_id: 'p1' }),
      ])
      const r = await adherenceService.getAdherenceSummary('30d')
      expect(r.overallScore).toBe(50)
      expect(r.overallTaken).toBe(1)
      expect(r.overallExpected).toBe(2)
      expect(r.protocolScores).toHaveLength(1)
      expect(r).toHaveProperty('currentStreak')
      expect(r).toHaveProperty('longestStreak')
    })
  })

  describe('getDailyAdherence', () => {
    it('retorna array com `days` dias e adesão por dia', async () => {
      mocks.repo.getWindow.mockResolvedValue([])
      const r = await adherenceService.getDailyAdherence(7)
      expect(r).toHaveLength(7)
      expect(r[0]).toHaveProperty('date')
      expect(r[0]).toHaveProperty('adherence')
      expect(r[0].adherence).toBe(0) // sem instâncias
    })
  })
})
