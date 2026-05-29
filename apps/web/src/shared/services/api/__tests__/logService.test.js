import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stockService: {
    decrease: vi.fn(),
    increase: vi.fn(),
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id'),
  supabase: {
    from: vi.fn(),
  },
  doseInstanceRepo: {
    findAnchorInstance: vi.fn(),
    markTaken: vi.fn(),
  },
}))

vi.mock('@stock/services/stockService', () => ({
  stockService: mocks.stockService,
}))

vi.mock('@shared/utils/supabase', () => ({
  supabase: mocks.supabase,
  getUserId: mocks.getUserId,
}))

// Repo de instâncias mockado — controla o snap/markTaken da âncora de log (S2.6).
vi.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: () => mocks.doseInstanceRepo,
}))

import { logService } from '@shared/services/api/logService'

function buildLogUpdateChain(result = { error: null }) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

function buildLogInsertChain(result) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

function buildSelectSingleChain(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

function buildDeleteChain(result = { error: null }) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

describe('logService', () => {
  const baseLog = {
    protocol_id: '123e4567-e89b-12d3-a456-426614174001',
    medicine_id: '123e4567-e89b-12d3-a456-426614174000',
    quantity_taken: 2,
    taken_at: '2026-04-02T10:00:00Z',
    notes: 'Tomado após café',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: nenhuma instância casa (dose avulsa) — mantém os testes de estoque isolados.
    mocks.doseInstanceRepo.findAnchorInstance.mockResolvedValue(null)
  })

  describe('create', () => {
    it('creates the log and consumes stock using the created log id', async () => {
      const createdLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from.mockReturnValueOnce(
        buildLogInsertChain({ data: createdLog, error: null })
      )
      mocks.stockService.decrease.mockResolvedValueOnce({ ok: true })

      const result = await logService.create(baseLog)

      expect(mocks.stockService.decrease).toHaveBeenCalledWith(
        baseLog.medicine_id,
        baseLog.quantity_taken,
        createdLog.id
      )
      expect(result).toEqual(createdLog)
    })

    it('ancora o log à instância quando o snap casa (S2.6)', async () => {
      const createdLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from
        .mockReturnValueOnce(buildLogInsertChain({ data: createdLog, error: null }))
        .mockReturnValueOnce(buildLogUpdateChain({ error: null }))
      mocks.stockService.decrease.mockResolvedValueOnce({ ok: true })
      mocks.doseInstanceRepo.findAnchorInstance.mockResolvedValueOnce({ id: 'di-7' })
      mocks.doseInstanceRepo.markTaken.mockResolvedValueOnce(undefined)

      const result = await logService.create(baseLog)

      expect(mocks.doseInstanceRepo.findAnchorInstance).toHaveBeenCalledWith({
        protocolId: baseLog.protocol_id,
        takenAt: baseLog.taken_at,
      })
      expect(mocks.doseInstanceRepo.markTaken).toHaveBeenCalledWith('di-7', 'log-1')
      expect(result.dose_instance_id).toBe('di-7')
    })

    it('deixa o log avulso (sem markTaken) quando nenhuma instância casa', async () => {
      const createdLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from.mockReturnValueOnce(
        buildLogInsertChain({ data: createdLog, error: null })
      )
      mocks.stockService.decrease.mockResolvedValueOnce({ ok: true })
      mocks.doseInstanceRepo.findAnchorInstance.mockResolvedValueOnce(null)

      const result = await logService.create(baseLog)

      expect(mocks.doseInstanceRepo.markTaken).not.toHaveBeenCalled()
      expect(result.dose_instance_id).toBeUndefined()
    })

    it('falha de âncora não quebra o registro da dose (best-effort, R-245)', async () => {
      const createdLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from.mockReturnValueOnce(
        buildLogInsertChain({ data: createdLog, error: null })
      )
      mocks.stockService.decrease.mockResolvedValueOnce({ ok: true })
      mocks.doseInstanceRepo.findAnchorInstance.mockRejectedValueOnce(new Error('snap boom'))

      const result = await logService.create(baseLog)

      // dose registrada e estoque debitado permanecem válidos
      expect(mocks.stockService.decrease).toHaveBeenCalled()
      expect(result.id).toBe('log-1')
      expect(result.dose_instance_id).toBeUndefined()
    })

    it('deletes the created log if stock consumption fails', async () => {
      const createdLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from
        .mockReturnValueOnce(buildLogInsertChain({ data: createdLog, error: null }))
        .mockReturnValueOnce(buildDeleteChain())

      mocks.stockService.decrease.mockRejectedValueOnce(new Error('Estoque insuficiente'))

      await expect(logService.create(baseLog)).rejects.toThrow(
        'Não foi possível consumir o estoque'
      )
    })
  })

  describe('update', () => {
    it('restores old consumption and reapplies FIFO with the same log id', async () => {
      const oldLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }
      const updatedLog = { ...oldLog, quantity_taken: 1 }

      mocks.supabase.from
        .mockReturnValueOnce(buildSelectSingleChain({ data: oldLog, error: null }))
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedLog, error: null }),
                }),
              }),
            }),
          }),
        })

      mocks.stockService.increase.mockResolvedValueOnce({ quantity_restored: 2 })
      mocks.stockService.decrease.mockResolvedValueOnce({ quantity_consumed: 1 })

      const result = await logService.update('log-1', { quantity_taken: 1 })

      expect(mocks.stockService.increase).toHaveBeenCalledWith(
        oldLog.medicine_id,
        oldLog.quantity_taken,
        {
          medicine_log_id: 'log-1',
          reason: 'dose_update_restore',
        }
      )
      expect(mocks.stockService.decrease).toHaveBeenCalledWith(updatedLog.medicine_id, 1, 'log-1')
      expect(result).toEqual(updatedLog)
    })
  })

  describe('delete', () => {
    it('restores exact consumed lots before deleting the log', async () => {
      const oldLog = { id: 'log-1', ...baseLog, user_id: 'test-user-id' }

      mocks.supabase.from
        .mockReturnValueOnce(buildSelectSingleChain({ data: oldLog, error: null }))
        .mockReturnValueOnce(buildDeleteChain())

      mocks.stockService.increase.mockResolvedValueOnce({ quantity_restored: 2 })

      await logService.delete('log-1')

      expect(mocks.stockService.increase).toHaveBeenCalledWith(
        oldLog.medicine_id,
        oldLog.quantity_taken,
        {
          medicine_log_id: 'log-1',
          reason: 'dose_deleted_restore',
        }
      )
    })
  })
})
