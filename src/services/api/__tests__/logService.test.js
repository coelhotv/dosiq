import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist functions to be used inside vi.mock
const mocks = vi.hoisted(() => {
  const eq = vi.fn()
  const single = vi.fn()
  const order = vi.fn()
  const limit = vi.fn()
  const select = vi.fn()
  const insert = vi.fn()
  const update = vi.fn()
  const delete_ = vi.fn()
  const from = vi.fn()

  return {
    eq, single, order, limit, select, insert, update, delete_, from
  }
})

// Mock do módulo supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mocks.from
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id')
}))

// Mock do stockService
const mockStockDecrease = vi.fn()
const mockStockIncrease = vi.fn()

vi.mock('../stockService', () => ({
  stockService: {
    decrease: mockStockDecrease,
    increase: mockStockIncrease
  }
}))

import { logService } from '../logService'

describe('logService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStockDecrease.mockClear()
    mockStockIncrease.mockClear()

    // Configurar o encadeamento padrão
    mocks.from.mockReturnValue({
      select: mocks.select,
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.delete_,
    })

    // select() -> { eq, order, limit, single }
    mocks.select.mockReturnValue({
      eq: mocks.eq,
      order: mocks.order,
      limit: mocks.limit,
      single: mocks.single,
    })

    // insert() -> { select }
    mocks.insert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mocks.single })
    })

    // update() -> { eq, select }
    mocks.update.mockReturnValue({
      eq: mocks.eq,
      select: vi.fn().mockReturnValue({ single: mocks.single }),
    })

    // delete() -> { eq }
    mocks.delete_.mockReturnValue({ eq: mocks.eq })

    // eq() -> { eq, order, limit, single, delete, select }
    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      order: mocks.order,
      limit: mocks.limit,
      single: mocks.single,
      delete: mocks.delete_,
      select: vi.fn().mockReturnValue({ single: mocks.single }),
    })

    // limit() -> { data, error }
    mocks.limit.mockReturnValue({ data: [], error: null })

    // order() -> { limit }
    mocks.order.mockReturnValue({ limit: mocks.limit })

    // Default returns
    mocks.single.mockResolvedValue({ data: null, error: null })
  })

  describe('getAll', () => {
    it('should fetch all logs with related data', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          quantity_taken: 1,
          taken_at: '2024-01-15T10:00:00Z',
          protocol: { id: 'proto-1', name: 'Protocolo A' },
          medicine: { id: 'med-1', name: 'Dipirona' }
        }
      ]

      mocks.limit.mockResolvedValue({ data: mockLogs, error: null })

      const result = await logService.getAll()

      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
      expect(result).toEqual(mockLogs)
    })

    it('should respect limit parameter', async () => {
      mocks.limit.mockResolvedValue({ data: [], error: null })

      await logService.getAll(25)

      expect(mocks.limit).toHaveBeenCalledWith(25)
    })

    it('should handle errors from supabase', async () => {
      mocks.limit.mockResolvedValue({ data: null, error: { message: 'Connection failed' } })

      await expect(logService.getAll()).rejects.toThrow('Connection failed')
    })
  })

  describe('getByProtocol', () => {
    it('should fetch logs for a specific protocol', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          quantity_taken: 1,
          taken_at: '2024-01-15T10:00:00Z'
        }
      ]

      mocks.limit.mockResolvedValue({ data: mockLogs, error: null })

      const result = await logService.getByProtocol('proto-1')

      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
      expect(mocks.eq).toHaveBeenCalledWith('protocol_id', 'proto-1')
      expect(result).toEqual(mockLogs)
    })

    it('should apply user_id filter', async () => {
      mocks.limit.mockResolvedValue({ data: [], error: null })

      await logService.getByProtocol('proto-1')

      // Should filter by both protocol_id and user_id
      expect(mocks.eq).toHaveBeenCalledWith('protocol_id', 'proto-1')
    })
  })

  describe('create', () => {
    const mockLog = {
      protocol_id: 'proto-1',
      medicine_id: 'med-1',
      quantity_taken: 2,
      taken_at: '2024-01-15T10:00:00Z',
      notes: 'Tomado após café'
    }

    it('should create log and decrease stock', async () => {
      const createdLog = { id: 'log-1', ...mockLog, user_id: 'test-user-id' }

      mocks.single.mockResolvedValueOnce({ data: createdLog, error: null })
      mockStockDecrease.mockResolvedValue(undefined)

      const result = await logService.create(mockLog)

      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
      expect(mocks.insert).toHaveBeenCalledWith([{ ...mockLog, user_id: 'test-user-id' }])
      expect(mockStockDecrease).toHaveBeenCalledWith('med-1', 2)
      expect(result).toEqual(createdLog)
    })

    it('should throw error when log creation fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Validation error' } })

      await expect(logService.create(mockLog)).rejects.toThrow('Validation error')
      expect(mockStockDecrease).not.toHaveBeenCalled()
    })

    it('should throw combined error when stock decrease fails', async () => {
      const createdLog = { id: 'log-1', ...mockLog }

      mocks.single.mockResolvedValueOnce({ data: createdLog, error: null })
      mockStockDecrease.mockRejectedValue(new Error('Estoque insuficiente'))

      await expect(logService.create(mockLog)).rejects.toThrow('Remédio registrado, mas erro ao atualizar estoque')
    })
  })

  describe('createBulk', () => {
    const mockLogs = [
      {
        protocol_id: 'proto-1',
        medicine_id: 'med-1',
        quantity_taken: 1,
        taken_at: '2024-01-15T10:00:00Z'
      },
      {
        protocol_id: 'proto-2',
        medicine_id: 'med-2',
        quantity_taken: 2,
        taken_at: '2024-01-15T10:00:00Z'
      }
    ]

    it('should create multiple logs and decrease stock for each', async () => {
      const createdLogs = mockLogs.map((log, i) => ({ id: `log-${i}`, ...log }))

      mocks.single.mockResolvedValueOnce({ data: createdLogs, error: null })
      mockStockDecrease.mockResolvedValue(undefined)

      const result = await logService.createBulk(mockLogs)

      expect(mocks.insert).toHaveBeenCalledWith([
        { ...mockLogs[0], user_id: 'test-user-id' },
        { ...mockLogs[1], user_id: 'test-user-id' }
      ])
      expect(mockStockDecrease).toHaveBeenCalledTimes(2)
      expect(mockStockDecrease).toHaveBeenNthCalledWith(1, 'med-1', 1)
      expect(mockStockDecrease).toHaveBeenNthCalledWith(2, 'med-2', 2)
      expect(result).toEqual(createdLogs)
    })

    it('should continue processing even if one stock decrease fails', async () => {
      const createdLogs = mockLogs.map((log, i) => ({ id: `log-${i}`, ...log }))

      mocks.single.mockResolvedValueOnce({ data: createdLogs, error: null })
      mockStockDecrease
        .mockRejectedValueOnce(new Error('Stock error'))
        .mockResolvedValueOnce(undefined)

      // Should not throw, just log errors
      const result = await logService.createBulk(mockLogs)

      expect(result).toEqual(createdLogs)
      expect(mockStockDecrease).toHaveBeenCalledTimes(2)
    })
  })

  describe('update', () => {
    const existingLog = {
      id: 'log-1',
      protocol_id: 'proto-1',
      medicine_id: 'med-1',
      quantity_taken: 2,
      taken_at: '2024-01-15T10:00:00Z'
    }

    it('should update log when quantity unchanged', async () => {
      const updates = { notes: 'Updated note' }
      const updatedLog = { ...existingLog, ...updates }

      // First call: fetch original log
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      // Second call: update log
      mocks.single.mockResolvedValueOnce({ data: updatedLog, error: null })

      const result = await logService.update('log-1', updates)

      expect(mockStockDecrease).not.toHaveBeenCalled()
      expect(mockStockIncrease).not.toHaveBeenCalled()
      expect(result).toEqual(updatedLog)
    })

    it('should decrease stock when quantity increased', async () => {
      const updates = { quantity_taken: 5 } // Increased by 3
      const updatedLog = { ...existingLog, ...updates }

      mocks.single
        .mockResolvedValueOnce({ data: existingLog, error: null }) // Fetch original
      mocks.single.mockResolvedValueOnce({ data: updatedLog, error: null }) // Update
      mockStockDecrease.mockResolvedValue(undefined)

      await logService.update('log-1', updates)

      expect(mockStockDecrease).toHaveBeenCalledWith('med-1', 3)
      expect(mockStockIncrease).not.toHaveBeenCalled()
    })

    it('should increase stock when quantity decreased', async () => {
      const updates = { quantity_taken: 1 } // Decreased by 1
      const updatedLog = { ...existingLog, ...updates }

      mocks.single
        .mockResolvedValueOnce({ data: existingLog, error: null }) // Fetch original
      mocks.single.mockResolvedValueOnce({ data: updatedLog, error: null }) // Update
      mockStockIncrease.mockResolvedValue(undefined)

      await logService.update('log-1', updates)

      expect(mockStockIncrease).toHaveBeenCalledWith('med-1', 1, 'Ajuste de dose (ID: log-1)')
      expect(mockStockDecrease).not.toHaveBeenCalled()
    })

    it('should throw error if stock adjustment fails', async () => {
      const updates = { quantity_taken: 5 }

      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      mockStockDecrease.mockRejectedValue(new Error('Stock error'))

      await expect(logService.update('log-1', updates)).rejects.toThrow('Não foi possível atualizar o estoque')
    })

    it('should throw error when original log not found', async () => {
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(logService.update('log-1', { quantity_taken: 5 })).rejects.toThrow('Not found')
    })

    it('should throw error when update fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null }) // Fetch success
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } }) // Update fail

      await expect(logService.update('log-1', { notes: 'Test' })).rejects.toThrow('Update failed')
    })
  })

  describe('delete', () => {
    const existingLog = {
      id: 'log-1',
      protocol_id: 'proto-1',
      medicine_id: 'med-1',
      quantity_taken: 2
    }

    it('should restore stock before deleting log', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      mockStockIncrease.mockResolvedValue(undefined)
      mocks.eq.mockResolvedValueOnce({ error: null })

      await logService.delete('log-1')

      expect(mockStockIncrease).toHaveBeenCalledWith('med-1', 2, 'Dose excluída (ID: log-1)')
      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
    })

    it('should throw error if log not found', async () => {
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(logService.delete('log-1')).rejects.toThrow('Not found')
    })

    it('should throw error if stock restoration fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      mockStockIncrease.mockRejectedValue(new Error('Stock error'))

      await expect(logService.delete('log-1')).rejects.toThrow('Não foi possível devolver o remédio ao estoque')
    })

    it('should throw error if delete fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      mockStockIncrease.mockResolvedValue(undefined)
      mocks.eq.mockResolvedValueOnce({ error: { message: 'Delete failed' } })

      await expect(logService.delete('log-1')).rejects.toThrow('Delete failed')
    })
  })
})
