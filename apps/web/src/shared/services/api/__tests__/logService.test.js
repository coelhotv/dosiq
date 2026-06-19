import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  registerDose: vi.fn(),
  undoDose: vi.fn(),
  updateOrphanLog: vi.fn(),
  deleteOrphanLog: vi.fn(),
  registerDoseMany: vi.fn(),
  getUserId: vi.fn().mockResolvedValue('test-user-id'),
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('@shared/utils/supabase', () => ({
  supabase: mocks.supabase,
  getUserId: mocks.getUserId,
}))

// Mock do @dosiq/core para interceptar chamadas ao doseLogCore
vi.mock('@dosiq/core', () => {
  return {
    createDoseLogService: () => ({
      registerDose: mocks.registerDose,
      undoDose: mocks.undoDose,
      updateOrphanLog: mocks.updateOrphanLog,
      deleteOrphanLog: mocks.deleteOrphanLog,
      registerDoseMany: mocks.registerDoseMany,
    }),
    parseISO: (str) => new Date(str),
  }
})

import { logService } from '@shared/services/api/logService'

describe('logService (Web Adapter)', () => {
  const baseLog = {
    protocol_id: '123e4567-e89b-12d3-a456-426614174001',
    medicine_id: '123e4567-e89b-12d3-a456-426614174000',
    quantity_taken: 2,
    taken_at: '2026-04-02T10:00:00Z',
    notes: 'Tomado após café',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('delega para o core e busca o log completo com relações', async () => {
      const coreResult = { id: 'log-123', ...baseLog }
      const populatedLog = {
        ...coreResult,
        protocol: { id: baseLog.protocol_id, name: 'Protocolo A' },
        medicine: { id: baseLog.medicine_id, name: 'Medicamento A' },
      }

      mocks.registerDose.mockResolvedValueOnce(coreResult)

      // Mock da query do supabase.from('medicine_logs').select(...).eq().single()
      const mockSingle = vi.fn().mockResolvedValueOnce({ data: populatedLog, error: null })
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      mocks.supabase.from.mockReturnValue({ select: mockSelect })

      const result = await logService.create(baseLog, { instanceId: 'inst-77' })

      expect(mocks.registerDose).toHaveBeenCalledWith(baseLog, { instanceId: 'inst-77' })
      expect(mocks.supabase.from).toHaveBeenCalledWith('medicine_logs')
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('protocol:protocols'))
      expect(mockEq).toHaveBeenCalledWith('id', 'log-123')
      expect(result).toEqual(populatedLog)
    })
  })

  describe('createBulk', () => {
    it('delega para o core (registerDoseMany) e retorna os logs populados', async () => {
      const logs = [baseLog, { ...baseLog, notes: 'Dose 2' }]
      const coreResults = [
        { success: true, data: { id: 'log-1', ...logs[0] } },
        { success: true, data: { id: 'log-2', ...logs[1] } },
      ]
      const populatedLogs = [
        { id: 'log-1', ...logs[0], protocol: {}, medicine: {} },
        { id: 'log-2', ...logs[1], protocol: {}, medicine: {} },
      ]

      mocks.registerDoseMany.mockResolvedValueOnce(coreResults)

      const mockOrder = vi.fn().mockResolvedValueOnce({ data: populatedLogs, error: null })
      const mockIn = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn })
      mocks.supabase.from.mockReturnValue({ select: mockSelect })

      const result = await logService.createBulk(logs)

      expect(mocks.registerDoseMany).toHaveBeenCalledWith([
        { ...logs[0], instanceId: null },
        { ...logs[1], instanceId: null },
      ])
      expect(mockIn).toHaveBeenCalledWith('id', ['log-1', 'log-2'])
      expect(result).toEqual(populatedLogs)
    })

    it('lança erro se alguma dose no lote falhar', async () => {
      const logs = [baseLog]
      const coreResults = [
        { success: false, error: 'Estoque insuficiente' },
      ]

      mocks.registerDoseMany.mockResolvedValueOnce(coreResults)

      await expect(logService.createBulk(logs)).rejects.toThrow('Estoque insuficiente')
    })
  })

  describe('update', () => {
    it('delega para o core e retorna o log atualizado populado', async () => {
      const updates = { notes: 'Nova nota' }
      const populatedLog = {
        id: 'log-123',
        ...baseLog,
        ...updates,
        protocol: {},
        medicine: {},
      }

      mocks.updateOrphanLog.mockResolvedValueOnce({ id: 'log-123' })

      const mockSingle = vi.fn().mockResolvedValueOnce({ data: populatedLog, error: null })
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      mocks.supabase.from.mockReturnValue({ select: mockSelect })

      const result = await logService.update('log-123', updates)

      expect(mocks.updateOrphanLog).toHaveBeenCalledWith('log-123', updates)
      expect(mockEq).toHaveBeenCalledWith('id', 'log-123')
      expect(result).toEqual(populatedLog)
    })
  })

  describe('delete', () => {
    it('delega para o core', async () => {
      mocks.deleteOrphanLog.mockResolvedValueOnce()

      await logService.delete('log-123')

      expect(mocks.deleteOrphanLog).toHaveBeenCalledWith('log-123')
    })
  })
})
