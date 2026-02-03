import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist functions to be used inside vi.mock
const mocks = vi.hoisted(() => {
  const eq = vi.fn()
  const single = vi.fn()
  const order = vi.fn()
  const select = vi.fn()
  const insert = vi.fn()
  const update = vi.fn()
  const delete_ = vi.fn()
  const gt = vi.fn()
  const from = vi.fn()

  return {
    eq, single, order, select, insert, update, delete_, gt, from
  }
})

// Mock do módulo
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mocks.from
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id')
}))

import { stockService } from '../stockService'

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Configurar o encadeamento padrão
    mocks.from.mockReturnValue({
      select: mocks.select,
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.delete_,
    })

    // select() -> { eq }
    mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single })

    // insert() -> { select }
    mocks.insert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mocks.single }) })

    // update() -> { eq }
    mocks.update.mockReturnValue({ eq: mocks.eq })

    // delete() -> { eq }
    mocks.delete_.mockReturnValue({ eq: mocks.eq })

    // eq() -> { eq, order, single, gt, delete }
    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      order: mocks.order,
      single: mocks.single,
      gt: mocks.gt,
      delete: mocks.delete_,
    })

    // gt() -> { order }
    mocks.gt.mockReturnValue({
      order: mocks.order,
    })

    // Default returns
    mocks.order.mockResolvedValue({ data: [], error: null })
    mocks.single.mockResolvedValue({ data: null, error: null })
  })

  describe('getByMedicine', () => {
    it('should fetch stock entries for a specific medicine', async () => {
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 10, purchase_date: '2024-01-01' },
        { id: '2', medicine_id: 'med-1', quantity: 5, purchase_date: '2024-02-01' },
      ]

      mocks.order.mockResolvedValue({ data: mockStock, error: null })

      const result = await stockService.getByMedicine('med-1')

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(result).toEqual(mockStock)
    })

    it('should handle errors from supabase', async () => {
      mocks.order.mockResolvedValue({ data: null, error: { message: 'Database error' } })

      await expect(stockService.getByMedicine('med-1')).rejects.toThrow('Database error')
    })
  })

  describe('getTotalQuantity', () => {
    it('should calculate total quantity for a medicine', async () => {
      const mockStock = [
        { quantity: 10 },
        { quantity: 5 },
        { quantity: 3 },
      ]

      mocks.order.mockResolvedValue({ data: mockStock, error: null })

      const result = await stockService.getTotalQuantity('med-1')

      expect(result).toBe(18)
    })

    it('should return 0 when no stock entries exist', async () => {
      mocks.order.mockResolvedValue({ data: [], error: null })

      const result = await stockService.getTotalQuantity('med-1')

      expect(result).toBe(0)
    })
  })

  describe('add', () => {
    it('should add new stock entry', async () => {
      const newStock = {
        medicine_id: 'med-1',
        quantity: 30,
        unit_price: 0.5,
        purchase_date: '2024-01-15'
      }
      const createdStock = { id: 'stock-1', ...newStock, user_id: 'test-user-id' }

      mocks.single.mockResolvedValue({ data: createdStock, error: null })

      const result = await stockService.add(newStock)

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(mocks.insert).toHaveBeenCalledWith([{ ...newStock, user_id: 'test-user-id' }])
      expect(result).toEqual(createdStock)
    })

    it('should throw error when medicine_id is missing', async () => {
      const invalidStock = { quantity: 30 }

      await expect(stockService.add(invalidStock)).rejects.toThrow('ID do medicamento é obrigatório')
    })

    it('should throw error when quantity is zero or negative', async () => {
      const invalidStock = { medicine_id: 'med-1', quantity: 0 }

      await expect(stockService.add(invalidStock)).rejects.toThrow('Quantidade deve ser maior que zero')
    })

    it('should throw error when quantity is null', async () => {
      const invalidStock = { medicine_id: 'med-1', quantity: null }

      await expect(stockService.add(invalidStock)).rejects.toThrow('Quantidade deve ser maior que zero')
    })
  })

  describe('decrease', () => {
    it('should consume oldest stock first - FIFO', async () => {
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 5, purchase_date: '2024-01-01' },
        { id: '2', medicine_id: 'med-1', quantity: 10, purchase_date: '2024-02-01' },
      ]

      // Setup chain for fetching stock (with gt and order)
      mocks.from.mockReturnValue({
        select: mocks.select,
      })
      mocks.select.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockReturnValue({
        eq: mocks.eq,
        gt: mocks.gt,
      })
      mocks.gt.mockReturnValue({
        order: mocks.order,
      })
      mocks.order.mockResolvedValueOnce({ data: mockStock, error: null })

      // Mock update calls
      mocks.from.mockReturnValue({
        select: mocks.select,
        update: mocks.update,
      })
      mocks.update.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockResolvedValue({ error: null })

      await stockService.decrease('med-1', 7)

      // First entry should be depleted (5 - 5 = 0)
      // Second entry should have 8 remaining (10 - 3 = 7)
      expect(mocks.update).toHaveBeenCalledTimes(2)
    })

    it('should throw error when stock is insufficient', async () => {
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 5, purchase_date: '2024-01-01' },
      ]

      // Setup chain for fetching stock
      mocks.from.mockReturnValue({
        select: mocks.select,
      })
      mocks.select.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockReturnValue({
        eq: mocks.eq,
        gt: mocks.gt,
      })
      mocks.gt.mockReturnValue({
        order: mocks.order,
      })
      mocks.order.mockResolvedValueOnce({ data: mockStock, error: null })

      await expect(stockService.decrease('med-1', 10)).rejects.toThrow('Estoque insuficiente')
    })

    it('should handle exact stock consumption', async () => {
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 5, purchase_date: '2024-01-01' },
      ]

      // Setup chain for fetching stock
      mocks.from.mockReturnValue({
        select: mocks.select,
      })
      mocks.select.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockReturnValue({
        eq: mocks.eq,
        gt: mocks.gt,
      })
      mocks.gt.mockReturnValue({
        order: mocks.order,
      })
      mocks.order.mockResolvedValueOnce({ data: mockStock, error: null })

      // Mock update
      mocks.from.mockReturnValue({
        select: mocks.select,
        update: mocks.update,
      })
      mocks.update.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockResolvedValue({ error: null })

      await stockService.decrease('med-1', 5)

      expect(mocks.update).toHaveBeenCalledTimes(1)
      expect(mocks.update).toHaveBeenCalledWith({ quantity: 0 })
    })

    it('should handle multiple stock entries consumption', async () => {
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 3, purchase_date: '2024-01-01' },
        { id: '2', medicine_id: 'med-1', quantity: 3, purchase_date: '2024-01-15' },
        { id: '3', medicine_id: 'med-1', quantity: 10, purchase_date: '2024-02-01' },
      ]

      // Setup chain for fetching stock
      mocks.from.mockReturnValue({
        select: mocks.select,
      })
      mocks.select.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockReturnValue({
        eq: mocks.eq,
        gt: mocks.gt,
      })
      mocks.gt.mockReturnValue({
        order: mocks.order,
      })
      mocks.order.mockResolvedValueOnce({ data: mockStock, error: null })

      // Mock update
      mocks.from.mockReturnValue({
        select: mocks.select,
        update: mocks.update,
      })
      mocks.update.mockReturnValue({
        eq: mocks.eq,
      })
      mocks.eq.mockResolvedValue({ error: null })

      await stockService.decrease('med-1', 8)

      // Should consume: 3 from entry 1, 3 from entry 2, 2 from entry 3
      expect(mocks.update).toHaveBeenCalledTimes(3)
    })
  })

  describe('increase', () => {
    it('should create adjustment entry when restoring stock', async () => {
      const mockResult = {
        id: 'stock-2',
        medicine_id: 'med-1',
        quantity: 5,
        purchase_date: expect.any(String),
        unit_price: 0,
        user_id: 'test-user-id',
        notes: 'Estorno de dose'
      }

      mocks.single.mockResolvedValue({ data: mockResult, error: null })

      const result = await stockService.increase('med-1', 5)

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({
        medicine_id: 'med-1',
        quantity: 5,
        unit_price: 0,
        notes: 'Estorno de dose'
      })])
    })

    it('should accept custom reason for adjustment', async () => {
      const mockResult = {
        id: 'stock-2',
        medicine_id: 'med-1',
        quantity: 3,
        notes: 'Dose excluída (ID: log-123)'
      }

      mocks.single.mockResolvedValue({ data: mockResult, error: null })

      await stockService.increase('med-1', 3, 'Dose excluída (ID: log-123)')

      expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({
        notes: 'Dose excluída (ID: log-123)'
      })])
    })
  })

  describe('delete', () => {
    it('should delete a stock entry', async () => {
      mocks.eq.mockResolvedValue({ error: null })

      await stockService.delete('stock-1')

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(mocks.delete_).toHaveBeenCalled()
    })

    it('should throw error when deletion fails', async () => {
      mocks.eq.mockResolvedValue({ error: { message: 'Foreign key constraint' } })

      await expect(stockService.delete('stock-1')).rejects.toThrow('Foreign key constraint')
    })
  })
})
