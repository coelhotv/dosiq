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
  const rpc = vi.fn()
  const lte = vi.fn()
  const maybeSingle = vi.fn()

  return {
    eq, single, order, select, insert, update, delete_, gt, from, rpc, lte, maybeSingle
  }
})

// Mock do módulo
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id')
}))

import { stockService } from '../stockService'

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Configurar o encadeamento padrão
    mocks.from.mockImplementation((table) => {
      // Return different chain based on table
      if (table === 'medicine_stock_summary') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mocks.maybeSingle,
                order: mocks.order,
                lte: mocks.lte
              }),
              maybeSingle: mocks.maybeSingle,
              order: mocks.order,
              lte: mocks.lte
            })
          })
        }
      }
      return {
        select: mocks.select,
        insert: mocks.insert,
        update: mocks.update,
        delete: mocks.delete_,
      }
    })

    // select() -> { eq }
    mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single })

    // insert() -> { select }
    mocks.insert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mocks.single }) })

    // update() -> { eq }
    mocks.update.mockReturnValue({ eq: mocks.eq })

    // delete() -> { eq }
    mocks.delete_.mockReturnValue({ eq: mocks.eq })

    // eq() -> { eq, order, single, gt, delete, maybeSingle }
    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      order: mocks.order,
      single: mocks.single,
      gt: mocks.gt,
      delete: mocks.delete_,
      maybeSingle: mocks.maybeSingle,
      lte: mocks.lte,
    })

    // gt() -> { order }
    mocks.gt.mockReturnValue({
      order: mocks.order,
    })

    // lte() -> { order }
    mocks.lte.mockReturnValue({
      order: mocks.order,
    })

    // Default returns
    mocks.order.mockResolvedValue({ data: [], error: null })
    mocks.single.mockResolvedValue({ data: null, error: null })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.rpc.mockResolvedValue({ data: [], error: null })
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
    it('should use optimized view when available', async () => {
      const mockSummary = { total_quantity: 18 }

      // Mock view query chain: select -> eq -> eq -> maybeSingle
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockSummary, error: null })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      const result = await stockService.getTotalQuantity('med-1')

      expect(result).toBe(18)
    })

    it('should fallback to manual calculation when view has no data', async () => {
      // First call returns null from view
      const maybeSingleMock = vi.fn().mockResolvedValueOnce({ data: null, error: null })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      
      // Second call fetches from stock table
      const orderMock = vi.fn().mockResolvedValue({
        data: [{ quantity: 10 }, { quantity: 5 }, { quantity: 3 }],
        error: null
      })
      const fallbackInnerEqMock = vi.fn().mockReturnValue({ order: orderMock })
      const fallbackEqMock = vi.fn().mockReturnValue({ eq: fallbackInnerEqMock })
      
      mocks.select
        .mockReturnValueOnce({ eq: eqMock })  // First call for view
        .mockReturnValueOnce({ eq: fallbackEqMock })  // Fallback to stock table

      const result = await stockService.getTotalQuantity('med-1')

      expect(result).toBe(18)
    })

    it('should return 0 when no stock entries exist', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
      const innerEqMock = vi.fn().mockReturnValue({ order: orderMock })
      const eqMock = vi.fn().mockReturnValue({ eq: maybeSingleMock })
      
      mocks.select
        .mockReturnValueOnce({ eq: eqMock })
        .mockReturnValueOnce({ eq: innerEqMock })

      // Mock maybeSingle separately
      mocks.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }))

      const result = await stockService.getTotalQuantity('med-1')

      expect(result).toBe(0)
    })
  })

  describe('getStockSummary', () => {
    it('should return stock summary from view', async () => {
      const mockSummary = {
        medicine_id: 'med-1',
        user_id: 'test-user-id',
        total_quantity: 25,
        stock_entries_count: 3,
        oldest_entry_date: '2024-01-01',
        newest_entry_date: '2024-03-15'
      }

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockSummary, error: null })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      const result = await stockService.getStockSummary('med-1')

      expect(result).toEqual(mockSummary)
    })

    it('should return default summary when no data found', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      const result = await stockService.getStockSummary('med-1')

      expect(result).toEqual({
        medicine_id: 'med-1',
        user_id: 'test-user-id',
        total_quantity: 0,
        stock_entries_count: 0,
        oldest_entry_date: null,
        newest_entry_date: null
      })
    })

    it('should handle errors from supabase', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'View not found' }
      })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      await expect(stockService.getStockSummary('med-1')).rejects.toThrow('View not found')
    })
  })

  describe('getLowStockMedicines', () => {
    it('should return medicines below threshold using RPC', async () => {
      const mockLowStock = [
        {
          medicine_id: 'med-1',
          total_quantity: 5,
          stock_entries_count: 1,
          oldest_entry_date: '2024-01-01',
          newest_entry_date: '2024-01-01'
        },
        {
          medicine_id: 'med-2',
          total_quantity: 3,
          stock_entries_count: 1,
          oldest_entry_date: '2024-02-01',
          newest_entry_date: '2024-02-01'
        }
      ]

      mocks.rpc.mockResolvedValue({ data: mockLowStock, error: null })

      const result = await stockService.getLowStockMedicines(10)

      expect(mocks.rpc).toHaveBeenCalledWith('get_low_stock_medicines', {
        p_user_id: 'test-user-id',
        p_threshold: 10
      })
      expect(result).toEqual(mockLowStock)
    })

    it('should fallback to view query when RPC fails', async () => {
      // RPC fails
      mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })

      // Fallback to view query
      const mockLowStock = [
        { medicine_id: 'med-1', total_quantity: 5, stock_entries_count: 1 }
      ]
      const orderMock = vi.fn().mockResolvedValue({ data: mockLowStock, error: null })
      const lteMock = vi.fn().mockReturnValue({ order: orderMock })
      const eqMock = vi.fn().mockReturnValue({ lte: lteMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      const result = await stockService.getLowStockMedicines(10)

      expect(result).toEqual(mockLowStock)
    })

    it('should use default threshold of 10', async () => {
      mocks.rpc.mockResolvedValue({ data: [], error: null })

      await stockService.getLowStockMedicines()

      expect(mocks.rpc).toHaveBeenCalledWith('get_low_stock_medicines', {
        p_user_id: 'test-user-id',
        p_threshold: 10
      })
    })

    it('should allow custom threshold', async () => {
      mocks.rpc.mockResolvedValue({ data: [], error: null })

      await stockService.getLowStockMedicines(5)

      expect(mocks.rpc).toHaveBeenCalledWith('get_low_stock_medicines', {
        p_user_id: 'test-user-id',
        p_threshold: 5
      })
    })
  })

  describe('add', () => {
    it('should add new stock entry', async () => {
      const newStock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
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

      await expect(stockService.add(invalidStock)).rejects.toThrow('medicine_id: ID do medicamento deve ser um UUID válido')
    })

    it('should throw error when quantity is zero or negative', async () => {
      const invalidStock = { medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 0 }

      await expect(stockService.add(invalidStock)).rejects.toThrow('quantity: Quantidade deve ser maior que zero')
    })

    it('should throw error when quantity is null', async () => {
      const invalidStock = { medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: null }

      await expect(stockService.add(invalidStock)).rejects.toThrow('quantity: Quantidade deve ser maior que zero')
    })

    it('should handle supabase error with message', async () => {
      mocks.single.mockResolvedValue({ data: null, error: { message: 'Connection failed' } })

      await expect(stockService.add({ medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 10, purchase_date: '2024-01-15' }))
        .rejects.toThrow('Connection failed')
    })
  })

  describe('decrease', () => {
    it('should throw error when stock is insufficient', async () => {
      const mockStock = [
        { id: '1', medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 5, purchase_date: '2024-01-01' },
      ]

      // Mock chain: from -> select -> eq -> eq -> gt -> order
      const orderMock = vi.fn().mockResolvedValue({ data: mockStock, error: null })
      const gtMock = vi.fn().mockReturnValue({ order: orderMock })
      const innerEqMock = vi.fn().mockReturnValue({ gt: gtMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      await expect(stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 10)).rejects.toThrow('Estoque insuficiente')
    })

    it('should handle exact stock consumption', async () => {
      const mockStock = [
        { id: '1', medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 5, purchase_date: '2024-01-01' },
      ]

      // Mock for fetching
      const orderMock = vi.fn().mockResolvedValue({ data: mockStock, error: null })
      const gtMock = vi.fn().mockReturnValue({ order: orderMock })
      const innerEqMock = vi.fn().mockReturnValue({ gt: gtMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      // Mock for update
      mocks.eq.mockResolvedValue({ error: null })

      await stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 5)

      expect(mocks.update).toHaveBeenCalledWith({ quantity: 0 })
    })

    it('should handle fetch error gracefully', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Fetch error' } })
      const gtMock = vi.fn().mockReturnValue({ order: orderMock })
      const innerEqMock = vi.fn().mockReturnValue({ gt: gtMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      await expect(stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 5)).rejects.toThrow('Fetch error')
    })
  })

  describe('increase', () => {
    it('should create adjustment entry when restoring stock', async () => {
      const mockResult = {
        id: 'stock-2',
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 5,
        purchase_date: expect.any(String),
        unit_price: 0,
        user_id: 'test-user-id',
        notes: 'Estorno de dose'
      }

      mocks.single.mockResolvedValue({ data: mockResult, error: null })

      await stockService.increase('123e4567-e89b-12d3-a456-426614174000', 5)

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 5,
        unit_price: 0,
        notes: 'Estorno de dose'
      })])
    })

    it('should accept custom reason for adjustment', async () => {
      const mockResult = {
        id: 'stock-2',
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 3,
        notes: 'Dose excluída (ID: log-123)'
      }

      mocks.single.mockResolvedValue({ data: mockResult, error: null })

      await stockService.increase('123e4567-e89b-12d3-a456-426614174000', 3, 'Dose excluída (ID: log-123)')

      expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({
        notes: 'Dose excluída (ID: log-123)'
      })])
    })
  })

  describe('delete', () => {
    it('should delete a stock entry', async () => {
      // Mock chain: delete() -> eq() -> eq()
      const innerEqMock = vi.fn().mockResolvedValue({ error: null })
      const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: innerEqMock }) })
      mocks.from.mockReturnValue({ delete: deleteMock })

      await stockService.delete('stock-1')

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(deleteMock).toHaveBeenCalled()
    })

    it('should throw error when deletion fails', async () => {
      const innerEqMock = vi.fn().mockResolvedValue({ error: { message: 'Foreign key constraint' } })
      const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: innerEqMock }) })
      mocks.from.mockReturnValue({ delete: deleteMock })

      await expect(stockService.delete('stock-1')).rejects.toThrow('Foreign key constraint')
    })
  })

  describe('Performance Optimization (v1.6)', () => {
    it('should query medicine_stock_summary view for getStockSummary', async () => {
      const mockSummary = { total_quantity: 10, stock_entries_count: 2 }
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockSummary, error: null })
      const innerEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eqMock = vi.fn().mockReturnValue({ eq: innerEqMock })
      mocks.select.mockReturnValue({ eq: eqMock })

      await stockService.getStockSummary('med-1')

      expect(mocks.from).toHaveBeenCalledWith('medicine_stock_summary')
    })

    it('should maintain backward compatibility with existing methods', async () => {
      // All old methods should still work
      const mockStock = [{ id: '1', quantity: 10 }]
      mocks.order.mockResolvedValue({ data: mockStock, error: null })

      const result = await stockService.getByMedicine('med-1')

      expect(mocks.from).toHaveBeenCalledWith('stock')
      expect(result).toEqual(mockStock)
    })
  })
})
