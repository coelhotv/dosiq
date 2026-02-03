import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do stockService - deve ser hoisted
vi.mock('../stockService', () => ({
  stockService: {
    decrease: vi.fn(),
    increase: vi.fn()
  }
}))

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

import { logService } from '../logService'
import { stockService } from '../stockService'

describe('logService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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
      protocol_id: '123e4567-e89b-12d3-a456-426614174001',
      medicine_id: '123e4567-e89b-12d3-a456-426614174000',
      quantity_taken: 2,
      taken_at: '2024-01-15T10:00:00Z',
      notes: 'Tomado após café'
    }

    it('should create log and decrease stock', async () => {
      const createdLog = { id: 'log-1', ...mockLog, user_id: 'test-user-id' }

      mocks.single.mockResolvedValueOnce({ data: createdLog, error: null })
      stockService.decrease.mockResolvedValue(undefined)

      const result = await logService.create(mockLog)

      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
      expect(mocks.insert).toHaveBeenCalledWith([{ ...mockLog, user_id: 'test-user-id' }])
      expect(stockService.decrease).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 2)
      expect(result).toEqual(createdLog)
    })

    it('should throw error when log creation fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Validation error' } })

      await expect(logService.create(mockLog)).rejects.toThrow('Validation error')
      expect(stockService.decrease).not.toHaveBeenCalled()
    })

    it('should throw combined error when stock decrease fails', async () => {
      const createdLog = { id: 'log-1', ...mockLog }

      mocks.single.mockResolvedValueOnce({ data: createdLog, error: null })
      stockService.decrease.mockRejectedValue(new Error('Estoque insuficiente'))

      await expect(logService.create(mockLog)).rejects.toThrow('Remédio registrado, mas erro ao atualizar estoque')
    })
  })

  describe('createBulk', () => {
    const mockLogs = [
      {
        protocol_id: '123e4567-e89b-12d3-a456-426614174001',
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_taken: 1,
        taken_at: '2024-01-15T10:00:00Z'
      },
      {
        protocol_id: '123e4567-e89b-12d3-a456-426614174002',
        medicine_id: '123e4567-e89b-12d3-a456-426614174003',
        quantity_taken: 2,
        taken_at: '2024-01-15T10:00:00Z'
      }
    ]

    it('should create multiple logs and decrease stock for each', async () => {
      const createdLogs = mockLogs.map((log, i) => ({ id: `log-${i}`, ...log }))

      mocks.single.mockResolvedValueOnce({ data: createdLogs, error: null })
      stockService.decrease.mockResolvedValue(undefined)

      const result = await logService.createBulk(mockLogs)

      expect(mocks.insert).toHaveBeenCalledWith([
        { ...mockLogs[0], user_id: 'test-user-id' },
        { ...mockLogs[1], user_id: 'test-user-id' }
      ])
      expect(stockService.decrease).toHaveBeenCalledTimes(2)
      expect(stockService.decrease).toHaveBeenNthCalledWith(1, '123e4567-e89b-12d3-a456-426614174000', 1)
      expect(stockService.decrease).toHaveBeenNthCalledWith(2, '123e4567-e89b-12d3-a456-426614174003', 2)
      expect(result).toEqual(createdLogs)
    })

    it('should continue processing even if one stock decrease fails', async () => {
      const createdLogs = mockLogs.map((log, i) => ({ id: `log-${i}`, ...log }))

      mocks.single.mockResolvedValueOnce({ data: createdLogs, error: null })
      stockService.decrease
        .mockRejectedValueOnce(new Error('Stock error'))
        .mockResolvedValueOnce(undefined)

      // Should not throw, just log errors
      const result = await logService.createBulk(mockLogs)

      expect(result).toEqual(createdLogs)
      expect(stockService.decrease).toHaveBeenCalledTimes(2)
    })
  })

  describe('update', () => {
    const existingLog = {
      id: 'log-1',
      protocol_id: '123e4567-e89b-12d3-a456-426614174001',
      medicine_id: '123e4567-e89b-12d3-a456-426614174000',
      quantity_taken: 2,
      taken_at: '2024-01-15T10:00:00Z'
    }

    it('should decrease stock when quantity increased', async () => {
      const updates = { quantity_taken: 5 } // Increased by 3
      const updatedLog = { ...existingLog, ...updates }

      // Setup complex mock chain for fetching original log
      const singleMock = vi.fn()
      const selectMock = vi.fn()
      const eqMock = vi.fn()

      // First single call returns original log
      // Second single call returns updated log
      singleMock
        .mockResolvedValueOnce({ data: existingLog, error: null })
        .mockResolvedValueOnce({ data: updatedLog, error: null })

      selectMock.mockReturnValue({ single: singleMock })
      eqMock.mockReturnValue({ select: selectMock })
      mocks.eq.mockReturnValue({
        eq: eqMock,
        order: mocks.order,
        limit: mocks.limit,
        single: singleMock,
        delete: mocks.delete_,
        select: selectMock
      })
      mocks.select.mockReturnValue({ eq: eqMock, single: singleMock })

      stockService.decrease.mockResolvedValue(undefined)

      const result = await logService.update('log-1', updates)

      expect(stockService.decrease).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 3)
      expect(stockService.increase).not.toHaveBeenCalled()
    })

    it('should increase stock when quantity decreased', async () => {
      const updates = { quantity_taken: 1 } // Decreased by 1
      const updatedLog = { ...existingLog, ...updates }

      const singleMock = vi.fn()
      const selectMock = vi.fn()
      const eqMock = vi.fn()

      singleMock
        .mockResolvedValueOnce({ data: existingLog, error: null })
        .mockResolvedValueOnce({ data: updatedLog, error: null })

      selectMock.mockReturnValue({ single: singleMock })
      eqMock.mockReturnValue({ select: selectMock })
      mocks.eq.mockReturnValue({
        eq: eqMock,
        order: mocks.order,
        limit: mocks.limit,
        single: singleMock,
        delete: mocks.delete_,
        select: selectMock
      })
      mocks.select.mockReturnValue({ eq: eqMock, single: singleMock })

      stockService.increase.mockResolvedValue(undefined)

      const result = await logService.update('log-1', updates)

      expect(stockService.increase).toHaveBeenCalledWith('med-1', 1, 'Ajuste de dose (ID: log-1)')
      expect(stockService.decrease).not.toHaveBeenCalled()
    })

    it('should throw error if stock adjustment fails', async () => {
      const updates = { quantity_taken: 5 }

      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      stockService.decrease.mockRejectedValue(new Error('Stock error'))

      await expect(logService.update('log-1', updates)).rejects.toThrow('Não foi possível atualizar o estoque')
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
      stockService.increase.mockResolvedValue(undefined)
      mocks.eq.mockResolvedValueOnce({ error: null })

      await logService.delete('log-1')

      expect(stockService.increase).toHaveBeenCalledWith('med-1', 2, 'Dose excluída (ID: log-1)')
      expect(mocks.from).toHaveBeenCalledWith('medicine_logs')
    })

    it('should throw error if log not found', async () => {
      mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(logService.delete('log-1')).rejects.toThrow('Not found')
    })

    it('should throw error if stock restoration fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      stockService.increase.mockRejectedValue(new Error('Stock error'))

      await expect(logService.delete('log-1')).rejects.toThrow('Não foi possível devolver o remédio ao estoque')
    })

    it('should throw error if delete fails', async () => {
      mocks.single.mockResolvedValueOnce({ data: existingLog, error: null })
      stockService.increase.mockResolvedValue(undefined)
      mocks.eq.mockResolvedValueOnce({ error: { message: 'Delete failed' } })

      await expect(logService.delete('log-1')).rejects.toThrow('Delete failed')
    })
  })
})
