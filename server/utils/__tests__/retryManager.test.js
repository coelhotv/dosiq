// tests/server/utils/retryManager.test.js
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock dependencies
vi.mock('../../../../server/bot/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('../../../../server/bot/correlationLogger.js', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id'),
}))

vi.mock('../../../../server/services/notificationMetrics.js', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  recordRetry: vi.fn(),
  recordRateLimitHit: vi.fn(),
}))

// Import after mocks (use dynamic import to support ESM)
let DEFAULT_RETRY_CONFIG
let sendWithRetry
let isRetryableError
let calculateDelay
let sleep

beforeAll(async () => {
  const mod = await import('../../../../server/utils/retryManager.js')
  DEFAULT_RETRY_CONFIG = mod.DEFAULT_RETRY_CONFIG
  sendWithRetry = mod.sendWithRetry
  isRetryableError = mod.isRetryableError
  calculateDelay = mod.calculateDelay
  sleep = mod.sleep
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
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(10000)
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true)
    })
  })

  describe('isRetryableError', () => {
    it('deve identificar erros de rede como retryable', () => {
      const networkError = new Error('ETIMEDOUT')
      expect(isRetryableError(networkError)).toBe(true)
    })

    it('deve identificar erro 429 como retryable', () => {
      const rateLimitError = new Error('Rate limited')
      rateLimitError.response = { status: 429 }
      expect(isRetryableError(rateLimitError)).toBe(true)
    })

    it('deve identificar erro 5xx como retryable', () => {
      const serverError = new Error('Internal server error')
      serverError.response = { status: 500 }
      expect(isRetryableError(serverError)).toBe(true)
    })

    it('não deve identificar erros de cliente como retryable', () => {
      const clientError = new Error('Bad request')
      clientError.response = { status: 400 }
      expect(isRetryableError(clientError)).toBe(false)
    })
  })

  describe('sleep', () => {
    it('deve aguardar o tempo especificado', async () => {
      const start = Date.now()
      await sleep(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some margin
    })
  })

  describe('calculateDelay', () => {
    it('deve calcular delay com backoff exponencial', () => {
      const delay1 = calculateDelay(1, { baseDelay: 1000, maxDelay: 10000, jitter: false })
      const delay2 = calculateDelay(2, { baseDelay: 1000, maxDelay: 10000, jitter: false })
      const delay3 = calculateDelay(3, { baseDelay: 1000, maxDelay: 10000, jitter: false })

      expect(delay1).toBe(1000)
      expect(delay2).toBe(2000)
      expect(delay3).toBe(4000)
    })

    it('deve respeitar maxDelay', () => {
      const delay = calculateDelay(10, { baseDelay: 1000, maxDelay: 5000, jitter: false })
      expect(delay).toBe(5000)
    })
  })

  describe('sendWithRetry', () => {
    it('deve retornar sucesso na primeira tentativa', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(mockOperation, DEFAULT_RETRY_CONFIG, {
        operation: 'test',
      })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(1)
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('deve fazer retry em erro de rede', async () => {
      const networkError = new Error('ETIMEDOUT')
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(
        mockOperation,
        { ...DEFAULT_RETRY_CONFIG, jitter: false },
        {
          operation: 'test',
        }
      )

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
    })

    it('deve falhar após todas as tentativas', async () => {
      const networkError = new Error('ETIMEDOUT')
      const mockOperation = vi.fn().mockRejectedValue(networkError)

      const result = await sendWithRetry(
        mockOperation,
        { ...DEFAULT_RETRY_CONFIG, jitter: false },
        {
          operation: 'test',
        }
      )

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(result.error).toBeDefined()
    })

    it('deve não fazer retry para erros não recuperáveis', async () => {
      const clientError = new Error('Bad request')
      clientError.response = { status: 400 }
      const mockOperation = vi.fn().mockRejectedValue(clientError)

      const result = await sendWithRetry(mockOperation, DEFAULT_RETRY_CONFIG, {
        operation: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
    })

    it('deve aceitar configuração customizada', async () => {
      const customConfig = { maxRetries: 1, baseDelay: 100, maxDelay: 1000, jitter: false }
      const mockOperation = vi.fn().mockResolvedValue({ success: true, messageId: '123' })

      const result = await sendWithRetry(mockOperation, customConfig, { operation: 'test' })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(1)
    })
  })
})
