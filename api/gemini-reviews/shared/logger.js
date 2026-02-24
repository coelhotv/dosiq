/**
 * Logger estruturado para endpoints da API Gemini Reviews
 *
 * Fornece logging consistente com níveis e formatação JSON
 * para fácil parsing nos logs da Vercel.
 *
 * @module api/gemini-reviews/shared/logger
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Níveis de log disponíveis
 * @readonly
 */
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
}

/**
 * Prefixo para identificar logs nos endpoints Gemini
 */
const LOG_PREFIX = '[gemini-api]'

// ============================================================================
// FUNÇÕES DE LOG
// ============================================================================

/**
 * Log estruturado com timestamp e contexto
 * @param {string} endpoint - Nome do endpoint (persist, create-issues, etc.)
 * @param {string} level - Nível do log (debug, info, warn, error)
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais para o log
 */
export function log(endpoint, level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    endpoint,
    level,
    message,
    ...data,
  }

  const formattedMessage = `${LOG_PREFIX}[${endpoint}] ${message}`

  if (level === LOG_LEVELS.ERROR) {
    console.error(formattedMessage, JSON.stringify(logEntry, null, 2))
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(formattedMessage, JSON.stringify(logEntry, null, 2))
  } else {
    console.log(formattedMessage, JSON.stringify(logEntry, null, 2))
  }
}

/**
 * Log de debug (detalhes finos para troubleshooting)
 * @param {string} endpoint - Nome do endpoint
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
export function logDebug(endpoint, message, data = {}) {
  log(endpoint, LOG_LEVELS.DEBUG, message, data)
}

/**
 * Log de informação (eventos normais)
 * @param {string} endpoint - Nome do endpoint
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
export function logInfo(endpoint, message, data = {}) {
  log(endpoint, LOG_LEVELS.INFO, message, data)
}

/**
 * Log de aviso (situações anômalas mas não críticas)
 * @param {string} endpoint - Nome do endpoint
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
export function logWarn(endpoint, message, data = {}) {
  log(endpoint, LOG_LEVELS.WARN, message, data)
}

/**
 * Log de erro com detalhes completos do erro
 * @param {string} endpoint - Nome do endpoint
 * @param {string} message - Mensagem descritiva
 * @param {Error|Object} error - Erro ocorrido
 * @param {Object} additionalData - Dados adicionais de contexto
 */
export function logError(endpoint, message, error, additionalData = {}) {
  const errorDetails = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      }
    : {
        error: String(error),
      }

  log(endpoint, LOG_LEVELS.ERROR, message, {
    ...errorDetails,
    ...additionalData,
  })
}

// ============================================================================
// FUNÇÕES DE LOG ESPECÍFICAS
// ============================================================================

/**
 * Log de requisição recebida
 * @param {string} endpoint - Nome do endpoint
 * @param {Object} req - Requisição HTTP
 */
export function logRequest(endpoint, req) {
  const sanitizedHeaders = { ...req.headers }
  // Remover dados sensíveis
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = '[REDACTED]'
  }
  if (sanitizedHeaders.cookie) {
    sanitizedHeaders.cookie = '[REDACTED]'
  }

  logInfo(endpoint, 'Request received', {
    method: req.method,
    headers: sanitizedHeaders,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasBody: !!req.body,
    bodyType: Array.isArray(req.body) ? 'array' : typeof req.body,
  })
}

/**
 * Log de validação JWT
 * @param {string} endpoint - Nome do endpoint
 * @param {boolean} success - Se a validação foi bem-sucedida
 * @param {string} [reason] - Razão da falha (se aplicável)
 */
export function logAuth(endpoint, success, reason = null) {
  if (success) {
    logInfo(endpoint, 'JWT validation successful')
  } else {
    logWarn(endpoint, 'JWT validation failed', { reason })
  }
}

/**
 * Log de operação com Supabase
 * @param {string} endpoint - Nome do endpoint
 * @param {string} operation - Nome da operação (select, insert, update)
 * @param {string} table - Nome da tabela
 * @param {Object} [details] - Detalhes adicionais
 */
export function logSupabase(endpoint, operation, table, details = {}) {
  logInfo(endpoint, `Supabase ${operation}`, {
    table,
    operation,
    ...details,
  })
}

/**
 * Log de operação com GitHub API
 * @param {string} endpoint - Nome do endpoint
 * @param {string} operation - Nome da operação
 * @param {Object} [details] - Detalhes adicionais
 */
export function logGitHub(endpoint, operation, details = {}) {
  logInfo(endpoint, `GitHub API ${operation}`, {
    operation,
    ...details,
  })
}

/**
 * Log de download do Vercel Blob
 * @param {string} endpoint - Nome do endpoint
 * @param {string} blobUrl - URL do blob (sanitizada)
 * @param {Object} [result] - Resultado do download
 */
export function logBlobDownload(endpoint, blobUrl, result = {}) {
  // Sanitizar URL para não expor tokens
  const sanitizedUrl = blobUrl.split('?')[0]

  logInfo(endpoint, 'Blob download', {
    url: sanitizedUrl,
    ...result,
  })
}

/**
 * Log de resultado de operação
 * @param {string} endpoint - Nome do endpoint
 * @param {string} operation - Nome da operação
 * @param {Object} result - Resultado da operação
 */
export function logResult(endpoint, operation, result) {
  logInfo(endpoint, `${operation} completed`, {
    success: result.success !== false,
    ...result,
  })
}

/**
 * Log de rate limiting
 * @param {string} endpoint - Nome do endpoint
 * @param {string} clientIP - IP do cliente
 * @param {boolean} allowed - Se a requisição foi permitida
 * @param {Object} [details] - Detalhes adicionais
 */
export function logRateLimit(endpoint, clientIP, allowed, details = {}) {
  if (allowed) {
    logDebug(endpoint, 'Rate limit check passed', {
      clientIP: clientIP.substring(0, 3) + '***', // Partially mask IP
      ...details,
    })
  } else {
    logWarn(endpoint, 'Rate limit exceeded', {
      clientIP: clientIP.substring(0, 3) + '***',
      ...details,
    })
  }
}

/**
 * Log de retry de fetch
 * @param {string} endpoint - Nome do endpoint
 * @param {number} attempt - Número da tentativa
 * @param {number} maxRetries - Máximo de tentativas
 * @param {string} [reason] - Razão do retry
 */
export function logRetry(endpoint, attempt, maxRetries, reason = '') {
  logWarn(endpoint, `Fetch retry ${attempt}/${maxRetries}`, {
    attempt,
    maxRetries,
    reason,
  })
}

export default {
  log,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logRequest,
  logAuth,
  logSupabase,
  logGitHub,
  logBlobDownload,
  logResult,
  logRateLimit,
  logRetry,
  LOG_LEVELS,
}
