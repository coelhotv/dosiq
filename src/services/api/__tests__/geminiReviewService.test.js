import { describe, it, expect } from 'vitest'
import { geminiReviewService } from '../geminiReviewService'

describe('Gemini Review Service - Smoke', () => {
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
