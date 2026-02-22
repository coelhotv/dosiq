import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be defined with factory function (hoisted to top)
vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(), maybeSingle: vi.fn() })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
    })),
  },
  getUserId: vi.fn().mockResolvedValue('test-user-id'),
}))

// Import after mock
import { geminiReviewService } from '../geminiReviewService'

describe('Gemini Review Service - Smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve exportar o service com todas as funções', () => {
    expect(geminiReviewService).toBeDefined()
    expect(typeof geminiReviewService.listReviews).toBe('function')
    expect(typeof geminiReviewService.getReviewById).toBe('function')
    expect(typeof geminiReviewService.createReview).toBe('function')
    expect(typeof geminiReviewService.createReviewsBatch).toBe('function')
    expect(typeof geminiReviewService.updateReview).toBe('function')
    expect(typeof geminiReviewService.updateReviewStatus).toBe('function')
    expect(typeof geminiReviewService.batchUpdateStatus).toBe('function')
    expect(typeof geminiReviewService.getStats).toBe('function')
    expect(typeof geminiReviewService.deleteReview).toBe('function')
    expect(typeof geminiReviewService.getReviewByIssueHash).toBe('function')
  })
})
