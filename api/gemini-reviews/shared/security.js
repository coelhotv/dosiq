/**
 * Módulo compartilhado de segurança para endpoints Gemini Reviews
 *
 * Fornece rate limiting e fetch com retry para proteção contra
 * abuso e falhas transitórias.
 *
 * @module api/gemini-reviews/shared/security
 * @version 1.0.0
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Mapa em memória para tracking de rate limits
 * Nota: Em serverless functions, o estado não persiste entre invocações,
 * mas oferece proteção básica contra burst attacks.
 */
const rateLimitMap = new Map()

/**
 * Configuração padrão de rate limiting
 */
const DEFAULT_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 60, // 60 requisições por minuto
}

/**
 * Verifica se o IP está dentro do rate limit permitido
 * @param {string} ip - Endereço IP do cliente
 * @param {Object} options - Opções de configuração
 * @returns {boolean} true se dentro do limite, false se excedido
 */
export function checkRateLimit(ip, options = {}) {
  const { windowMs, maxRequests } = { ...DEFAULT_RATE_LIMIT, ...options }
  const now = Date.now()

  // Limpar entradas antigas do mapa para evitar vazamento de memória
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.resetTime > windowMs * 2) {
      rateLimitMap.delete(key)
    }
  }

  const data = rateLimitMap.get(ip)

  if (!data || now > data.resetTime) {
    // Nova janela ou primeira requisição
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  if (data.count >= maxRequests) {
    return false // Rate limit excedido
  }

  data.count++
  return true
}

/**
 * Retorna headers de rate limit para a resposta
 * @param {string} ip - Endereço IP do cliente
 * @returns {Object} Headers de rate limit
 */
export function getRateLimitHeaders(ip) {
  const data = rateLimitMap.get(ip)
  if (!data) {
    return {
      'X-RateLimit-Limit': String(DEFAULT_RATE_LIMIT.maxRequests),
      'X-RateLimit-Remaining': String(DEFAULT_RATE_LIMIT.maxRequests - 1),
    }
  }

  return {
    'X-RateLimit-Limit': String(DEFAULT_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(Math.max(0, DEFAULT_RATE_LIMIT.maxRequests - data.count)),
    'X-RateLimit-Reset': String(Math.ceil(data.resetTime / 1000)),
  }
}

// ============================================================================
// FETCH COM RETRY
// ============================================================================

/**
 * Executa fetch com retry e exponential backoff
 * @param {string} url - URL para requisição
 * @param {Object} options - Opções do fetch
 * @param {number} maxRetries - Número máximo de tentativas (default: 3)
 * @returns {Promise<Response>} Resposta do fetch
 * @throws {Error} Se todas as tentativas falharem
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const baseDelay = 1000 // 1 segundo

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Sucesso ou erro não-recuperável (4xx, exceto rate limit)
      if (response.ok) {
        return response
      }

      // Erros 4xx (exceto 429 rate limit) não devem ser retentados
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response
      }

      // Se for a última tentativa, retorna a resposta mesmo com erro
      if (attempt === maxRetries - 1) {
        return response
      }

      // Log para debugging (não expõe dados sensíveis)
      console.warn(`Fetch attempt ${attempt + 1} failed with status ${response.status}, retrying...`)
    } catch (error) {
      // Erros de rede (ECONNRESET, ETIMEDOUT, etc) devem ser retentados
      if (attempt === maxRetries - 1) {
        throw error // Última tentativa, propagar erro
      }

      console.warn(`Fetch attempt ${attempt + 1} threw error: ${error.message}, retrying...`)
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = baseDelay * Math.pow(2, attempt)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  // Nunca deve chegar aqui, mas por segurança
  throw new Error(`Fetch failed after ${maxRetries} attempts`)
}

// ============================================================================
// UTILITÁRIOS DE SEGURANÇA
// ============================================================================

/**
 * Extrai IP do cliente da requisição
 * @param {Object} req - Requisição HTTP
 * @returns {string} IP do cliente
 */
export function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * Resposta padronizada para erro de rate limit
 * @param {Object} res - Resposta HTTP
 * @param {Object} _headers - Headers adicionais (reservado para uso futuro)
 */
// eslint-disable-next-line no-unused-vars
export function rateLimitResponse(res, _headers = {}) {
  return res.status(429).json({
    success: false,
    error: 'Rate limit excedido. Tente novamente em alguns instantes.',
  })
}

/**
 * Resposta padronizada para erro interno (não expõe detalhes)
 * @param {Object} res - Resposta HTTP
 * @param {Error} error - Erro ocorrido (apenas para log interno)
 * @param {string} context - Contexto do erro para log
 */
export function internalErrorResponse(res, error, context = 'Operação') {
  console.error(`Erro em ${context}:`, error)
  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
  })
}
