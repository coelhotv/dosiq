// server/bot/correlationLogger.js
import { createLogger } from './logger.js';
import crypto from 'crypto';

const logger = createLogger('Correlation');

// AsyncLocalStorage para contexto implícito (Node 14.8+)
let asyncLocalStorage = null;
try {
  const { AsyncLocalStorage } = await import('async_hooks');
  asyncLocalStorage = new AsyncLocalStorage();
} catch {
  logger.warn('AsyncLocalStorage não disponível, usando contexto explícito');
}

/**
 * Gera um UUID v4 usando crypto nativo do Node.js
 * @returns {string} Novo correlation ID
 */
export function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Obtém o correlation ID atual ou gera um novo
 * @returns {string} Correlation ID (existente ou novo)
 */
export function getOrGenerateCorrelationId() {
  return getCurrentCorrelationId() || generateCorrelationId();
}

/**
 * Executa uma função com contexto de correlação
 * @param {Function} fn - Função a ser executada
 * @param {object} context - Contexto com correlationId e outros dados
 * @returns {Promise<any>} Resultado da função
 */
export async function withCorrelation(fn, context = {}) {
  const correlationId = context.correlationId || generateCorrelationId();
  const fullContext = {
    correlationId,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  logger.debug('Iniciando operação com correlação', {
    correlationId,
    operation: fn.name || 'anonymous',
    ...context
  });
  
  if (asyncLocalStorage) {
    return asyncLocalStorage.run(fullContext, async () => {
      try {
        const result = await fn(fullContext);
        return result;
      } finally {
        logger.debug('Operação com correlação finalizada', {
          correlationId,
          operation: fn.name || 'anonymous'
        });
      }
    });
  } else {
    // Fallback: passar contexto explicitamente
    try {
      const result = await fn(fullContext);
      return result;
    } finally {
      logger.debug('Operação com correlação finalizada', {
        correlationId,
        operation: fn.name || 'anonymous'
      });
    }
  }
}

/**
 * Obtém o correlation ID atual do contexto
 * @returns {string|null} Correlation ID ou null
 */
export function getCurrentCorrelationId() {
  if (asyncLocalStorage) {
    const store = asyncLocalStorage.getStore();
    return store?.correlationId || null;
  }
  return null;
}

/**
 * Obtém o contexto atual completo
 * @returns {object|null} Contexto ou null
 */
export function getCurrentContext() {
  if (asyncLocalStorage) {
    return asyncLocalStorage.getStore() || null;
  }
  return null;
}

/**
 * Wrapper para logging com correlation ID
 * @param {string} context - Nome do contexto/componente
 * @param {string} correlationId - ID de correlação
 * @returns {object} Logger com contexto
 */
export function createCorrelationLogger(context, correlationId) {
  const baseLogger = createLogger(context);
  
  return {
    error: (message, error, data = {}) => {
      baseLogger.error(message, error, { correlationId, ...data });
    },
    warn: (message, data = {}) => {
      baseLogger.warn(message, { correlationId, ...data });
    },
    info: (message, data = {}) => {
      baseLogger.info(message, { correlationId, ...data });
    },
    debug: (message, data = {}) => {
      baseLogger.debug(message, { correlationId, ...data });
    },
    trace: (message, data = {}) => {
      baseLogger.trace(message, { correlationId, ...data });
    }
  };
}

/**
 * Middleware para Vercel API handlers
 * Adiciona correlation ID a todas as requisições
 * @param {Function} handler - Handler da API
 * @returns {Function} Handler com correlation
 */
export function withCorrelationMiddleware(handler) {
  return async (req, res) => {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    
    // Adicionar correlation ID à resposta
    res.setHeader('X-Correlation-Id', correlationId);
    
    const context = {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    };
    
    return withCorrelation(async () => {
      return handler(req, res, context);
    }, context);
  };
}
