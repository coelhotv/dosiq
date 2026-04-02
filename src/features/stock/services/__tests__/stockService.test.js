import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
}

const mockGetUserId = vi.fn().mockResolvedValue('test-user-id')

vi.mock('@shared/utils/supabase', () => ({
  supabase: mockSupabase,
  getUserId: mockGetUserId,
}))

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'stock-1',
                entry_type: 'adjustment',
                quantity: 5,
                original_quantity: 5,
              },
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })

    mockSupabase.rpc.mockResolvedValue({ data: { ok: true }, error: null })
  })

  describe('add', () => {
    it('calls create_purchase_with_stock RPC', async () => {
      const { stockService } = await import('@stock/services/stockService')

      const payload = {
        medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 30,
        purchase_date: '2026-04-02',
        expiration_date: '2026-05-02',
        unit_price: 1.5,
        pharmacy: 'Drogaria Teste',
        laboratory: 'Lab Teste',
        notes: 'Compra mensal',
      }

      const rpcResult = { purchase: { id: 'purchase-1' }, stock: { id: 'stock-1' } }
      mockSupabase.rpc.mockResolvedValueOnce({ data: rpcResult, error: null })

      const result = await stockService.add(payload)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_purchase_with_stock', {
        p_medicine_id: payload.medicine_id,
        p_quantity: payload.quantity,
        p_unit_price: payload.unit_price,
        p_purchase_date: payload.purchase_date,
        p_expiration_date: payload.expiration_date,
        p_pharmacy: payload.pharmacy,
        p_laboratory: payload.laboratory,
        p_notes: payload.notes,
      })
      expect(result).toEqual(rpcResult)
    })
  })

  describe('decrease', () => {
    it('requires medicineLogId for tracked FIFO consumption', async () => {
      const { stockService } = await import('@stock/services/stockService')

      await expect(
        stockService.decrease('123e4567-e89b-12d3-a456-426614174000', 2)
      ).rejects.toThrow('medicineLogId é obrigatório')
    })

    it('calls consume_stock_fifo RPC', async () => {
      const { stockService } = await import('@stock/services/stockService')

      await stockService.decrease(
        '123e4567-e89b-12d3-a456-426614174000',
        2,
        '123e4567-e89b-12d3-a456-426614174111'
      )

      expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_stock_fifo', {
        p_medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        p_quantity: 2,
        p_medicine_log_id: '123e4567-e89b-12d3-a456-426614174111',
      })
    })
  })

  describe('increase', () => {
    it('calls restore_stock_for_log when medicine_log_id is provided', async () => {
      const { stockService } = await import('@stock/services/stockService')

      await stockService.increase('123e4567-e89b-12d3-a456-426614174000', 2, {
        medicine_log_id: '123e4567-e89b-12d3-a456-426614174111',
        reason: 'dose_deleted_restore',
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('restore_stock_for_log', {
        p_medicine_log_id: '123e4567-e89b-12d3-a456-426614174111',
        p_reason: 'dose_deleted_restore',
      })
    })

    it('calls apply_manual_stock_adjustment for positive manual adjustment', async () => {
      const { stockService } = await import('@stock/services/stockService')

      await stockService.increase('123e4567-e89b-12d3-a456-426614174000', 5, {
        reason: 'manual_adjustment',
        notes: 'Entrada manual',
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('apply_manual_stock_adjustment', {
        p_medicine_id: '123e4567-e89b-12d3-a456-426614174000',
        p_quantity_delta: 5,
        p_reason: 'manual_adjustment',
        p_notes: 'Entrada manual',
      })
    })
  })

  describe('delete', () => {
    it('deletes a removable stock entry', async () => {
      const { stockService } = await import('@stock/services/stockService')

      await stockService.delete('stock-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('stock')
    })

    it('blocks deletion of a partially consumed purchase', async () => {
      const { stockService } = await import('@stock/services/stockService')

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'stock-2',
                  entry_type: 'purchase',
                  quantity: 10,
                  original_quantity: 30,
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      await expect(stockService.delete('stock-2')).rejects.toThrow('não podem ser removidas')
    })
  })
})
