import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be defined with factory function (hoisted to top)
vi.mock('@shared/utils/supabase', () => {
  const mockGetUserId = vi.fn().mockResolvedValue('test-user-id')

  // Mock for getTotalQuantity - uses medicine_stock_summary view
  const createSummaryMock = (returnData) => ({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(returnData),
      }),
    }),
  })

  const mockSupabase = {
    from: vi.fn().mockImplementation((table) => {
      if (table === 'medicine_stock_summary') {
        return {
          select: vi
            .fn()
            .mockReturnValue(createSummaryMock({ data: { total_quantity: 30 }, error: null })),
        }
      }
      return {
        select: vi.fn().mockReturnValue(createSummaryMock({ data: null, error: null })),
      }
    }),
  }

  return {
    supabase: mockSupabase,
    getUserId: mockGetUserId,
  }
})

// Import after mock
import { stockService } from '@stock/services/stockService'

describe('Smoke: Stock Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns total quantity for medicine', async () => {
    const result = await stockService.getTotalQuantity('med-1')
    expect(typeof result).toBe('number')
    expect(result).toBe(30)
  })
})
