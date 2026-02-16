// tests/server/bot/retryManager.test.js
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock dependencies
vi.mock('../../../../server/bot/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('../../../../server/bot/correlationLogger.js', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id')
}))

vi.mock('../../../../server/services/notificationMetrics.js', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  recordRetry: vi.fn(),
  recordRateLimitHit: vi.fn()
}))

// Import after mocks (use dynamic import to support ESM)
let DEFAULT_RETRY_CONFIG
let sendWithRetry

beforeAll(async () => {
  const mod = await import('../../../../server/bot/retryManager.js')
  DEFAULT_RETRY_CONFIG = mod.DEFAULT_RETRY_CONFIG
  sendWithRetry = mod.sendWithRetry
})

describe('RetryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('deve ter configuração padrão definida', () => {
      expect(DEFAULT_RETRY_CONFIG).toBeDefined()
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3)
      expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000)
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000)
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true)
    })

    it('deve ter tipos de erro configurados', () => {
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).toContain('network_error')
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).toContain('rate_limit')
    })
  })

  describe('sendWithRetry', () => {
    it('deve retornar sucesso na primeira tentativa', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(mockOperation, { userId: 'user-123', notificationType: 'dose_reminder' })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(1)
      expect(result.correlationId).toBe('test-correlation-id')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('deve fazer retry em erro de rede', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(mockOperation, { userId: 'user-123', notificationType: 'dose_reminder' })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(result.retried).toBe(true)
    })

    it('deve falhar após todas as tentativas', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('persistent error'))

      const result = await sendWithRetry(mockOperation, { userId: 'user-123', notificationType: 'dose_reminder' })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(result.error).toBeDefined()
    })

    it('deve não fazer retry para erros não recuperáveis', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('invalid chat id'))

      const result = await sendWithRetry(mockOperation, { userId: 'user-123', notificationType: 'dose_reminder' })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
    })

    it('deve aceitar configuração customizada', async () => {
      const customConfig = { maxRetries: 1, baseDelay: 100, jitter: false }
      const mockOperation = vi.fn().mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(mockOperation, { userId: 'user-123' }, customConfig)

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(1)
    })

    it('deve calcular delay crescente entre tentativas', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue({ success: true })

      const startTime = Date.now()
      await sendWithRetry(mockOperation, { userId: 'user-123' }, { maxRetries: 4, baseDelay: 100, jitter: false })
      const elapsed = Date.now() - startTime

      // Deve ter esperado pelo menos a soma dos delays (100 + 200 + 400 = 700ms)
      expect(elapsed).toBeGreaterThanOrEqual(700)
    })

    it('deve gerar correlationId se não fornecido', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true })

      const result = await sendWithRetry(mockOperation, { userId: 'user-123' })

      expect(result.correlationId).toBe('test-correlation-id')
    })
  })
})
