import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Supabase com configuração completa
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}

const mockGetUserId = vi.fn().mockResolvedValue('test-user-id')

vi.mock('@shared/utils/supabase', () => ({
  supabase: mockSupabase,
  getUserId: mockGetUserId,
}))

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Resetar mocks para estado padrão
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
  })

  describe('getByMedicine', () => {
    it('should fetch stock entries for a specific medicine', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockStock = [
        { id: '1', medicine_id: 'med-1', quantity: 10 },
        { id: '2', medicine_id: 'med-1', quantity: 5 },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockStock, error: null }),
            }),
          }),
        }),
      })

      const result = await stockService.getByMedicine('med-1')
      expect(result).toEqual(mockStock)
    })
  })

  describe('getTotalQuantity', () => {
    it('should return total quantity from view', async () => {
      const { stockService } = await import('@stock/services/stockService')

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { total_quantity: 42 }, error: null }),
            }),
          }),
        }),
      })

      const result = await stockService.getTotalQuantity('med-1')
      expect(result).toBe(42)
    })
  })

  describe('getStockSummary', () => {
    it('should return stock summary from view', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockSummary = {
        medicine_id: 'med-1',
        total_quantity: 25,
        stock_entries_count: 3,
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSummary, error: null }),
            }),
          }),
        }),
      })

      const result = await stockService.getStockSummary('med-1')
      expect(result).toEqual(mockSummary)
    })
  })

  describe('getLowStockMedicines', () => {
    it('should return medicines below threshold using RPC', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockLowStock = [{ medicine_id: 'med-1', total_quantity: 5 }]

      mockSupabase.rpc.mockResolvedValue({ data: mockLowStock, error: null })

      const result = await stockService.getLowStockMedicines(10)
      expect(result).toEqual(mockLowStock)
    })
  })

  describe('add', () => {
    it('should add new stock entry', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const newStock = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2024-01-15',
      }
      const createdStock = { id: 'stock-1', ...newStock, user_id: 'test-user-id' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdStock, error: null }),
          }),
        }),
      })

      const result = await stockService.add(newStock)
      expect(result).toEqual(createdStock)
    })

    it('should throw error when data is invalid', async () => {
      const { stockService } = await import('@stock/services/stockService')
      await expect(stockService.add({ quantity: 30 })).rejects.toThrow()
    })
  })

  describe('decrease', () => {
    it('should throw error when stock is insufficient', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockStock = [
        { id: '1', medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 5 },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockStock, error: null }),
              }),
            }),
          }),
        }),
      })

      await expect(
        stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 10)
      ).rejects.toThrow()
    })

    it('should update stock when sufficient', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockStock = [
        { id: '1', medicine_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 10 },
      ]

      let updateCalled = false
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockStock, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            updateCalled = true
            return { error: null }
          }),
        }),
      })

      await stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 5)
      expect(updateCalled).toBe(true)
    })
  })

  describe('increase', () => {
    it('should create adjustment entry', async () => {
      const { stockService } = await import('@stock/services/stockService')
      const mockResult = {
        id: 'stock-2',
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 5,
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
          }),
        }),
      })

      const result = await stockService.increase('123e4567-e89b-12d3-a456-426614174000', 5)
      expect(result).toEqual(mockResult)
    })
  })

  describe('delete', () => {
    it('should delete a stock entry', async () => {
      const { stockService } = await import('@stock/services/stockService')
      let deleteCalled = false

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              deleteCalled = true
              return { error: null }
            }),
          }),
        }),
      })

      await stockService.delete('stock-1')
      expect(deleteCalled).toBe(true)
    })
  })
})
