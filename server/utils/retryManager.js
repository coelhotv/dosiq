/**
 * Retry Manager para Bot Telegram
 *
 * Fornece funções helper para retry com backoff exponencial e jitter.
 * Usado pelo bot adapter para resiliência no envio de mensagens.
 */

import { createLogger } from '../bot/logger.js';
import { generateCorrelationId } from '../bot/correlationLogger.js';
import {
  recordSuccess,
  recordFailure,
  recordRetry,
  recordRateLimitHit
} from '../services/notificationMetrics.js';

const logger = createLogger('RetryManager');

/**
 * Configuração padrão de retry
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,    // 1 segundo
  maxDelay: 10000,    // 10 segundos
  jitter: true        // Adiciona aleatoriedade ao delay
};

/**
 * Verifica se um erro é passível de retry (transitório)
 * @param {Error} error - Objeto de erro
 * @returns {boolean} true se o erro é transitório e pode ser retentado
 */
export function isRetryableError(error) {
  // Network errors (connection issues)
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'Socket hang up',
    'ECONNABORTED',
    'Network Error'
  ];

  if (retryableCodes.some(code =>
    error.message?.includes(code) ||
    error.code === code
  )) {
    return true;
  }

  // Telegram API rate limiting (429 Too Many Requests)
  if (error.response?.status === 429 || error.statusCode === 429) {
    return true;
  }

  // Telegram API internal errors (5xx)
  if ((error.response?.status >= 500) || (error.statusCode >= 500)) {
    return true;
  }

  return false;
}

/**
 * Calcula o delay para a próxima tentativa com backoff exponencial e jitter
 * @param {number} attempt - Número da tentativa atual (1-based)
 * @param {object} config - Configuração de retry
 * @returns {number} Delay em milissegundos
 */
export function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  const { baseDelay, maxDelay, jitter } = config;

  // Backoff exponencial: baseDelay * 2^(attempt-1)
  let delay = baseDelay * Math.pow(2, attempt - 1);

  // Aplicar limite máximo
  delay = Math.min(delay, maxDelay);

  // Aplicar jitter (aleatoriedade) para evitar thundering herd
  if (jitter) {
    // Jitter decorrelacionado: delay = random(0, delay)
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Helper para aguardar um período de tempo
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa uma função com retry automático
 * @param {Function} fn - Função a ser executada
 * @param {object} config - Configuração de retry
 * @param {object} context - Contexto para logging
 * @returns {Promise<{success: boolean, result?: any, error?: Error, attempts: number}>}
 */
export async function sendWithRetry(fn, config = DEFAULT_RETRY_CONFIG, context = {}) {
  const { maxRetries } = config;
  const correlationId = context.correlationId || generateCorrelationId();

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Sucesso - registrar métrica e retornar
      recordSuccess(context.operation || 'unknown');

      if (attempt > 1) {
        logger.info(`Operação bem-sucedida após retry`, {
          correlationId,
          attempt,
          ...context
        });
      }

      return {
        success: true,
        result,
        attempts: attempt
      };
    } catch (err) {
      lastError = err;

      // Verificar se é erro de rate limiting
      if (err.response?.status === 429 || err.statusCode === 429) {
        recordRateLimitHit(context.operation || 'unknown');
      }

      // Verificar se deve retry
      if (!isRetryableError(err) || attempt === maxRetries) {
        break;
      }

      // Registrar retry
      recordRetry(context.operation || 'unknown');

      // Calcular delay
      const delay = calculateDelay(attempt, config);

      logger.warn(`Retry ${attempt}/${maxRetries} após ${delay}ms`, {
        correlationId,
        error: err.message,
        ...context
      });

      // Aguardar antes da próxima tentativa
      await sleep(delay);
    }
  }

  // Falha após todas as tentativas
  recordFailure(context.operation || 'unknown');

  const actualAttempts = isRetryableError(lastError) ? maxRetries : 1;

  logger.error(`Falha após ${actualAttempts} tentativas`, lastError, {
    correlationId,
    ...context
  });

  return {
    success: false,
    error: lastError,
    attempts: actualAttempts
  };
}

export default {
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  calculateDelay,
  sleep,
  sendWithRetry
};
