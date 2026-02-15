// server/bot/retryManager.js
import { createLogger } from './logger.js';
import { generateCorrelationId } from './correlationLogger.js';

const logger = createLogger('RetryManager');

/**
 * Configurações padrão de retry
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,              // Número máximo de tentativas
  baseDelay: 1000,            // 1 segundo - delay inicial
  maxDelay: 30000,            // 30 segundos - delay máximo
  jitter: true,               // Adiciona variação aleatória
  jitterFactor: 0.25,         // +/- 25% de variação
  retryableErrorTypes: [
    'network_error',
    'rate_limit',
    'timeout_error',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND'
  ]
};

/**
 * Calcula delay com exponential backoff e jitter
 * @param {number} attempt - Número da tentativa (1-based)
 * @param {object} config - Configuração de retry
 * @returns {number} Delay em milissegundos
 */
function calculateDelay(attempt, config) {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  if (!config.jitter) {
    return cappedDelay;
  }
  
  // Add jitter: +/- jitterFactor
  const jitter = (Math.random() - 0.5) * 2 * config.jitterFactor;
  const jitteredDelay = cappedDelay * (1 + jitter);
  
  // Ensure positive delay (minimum 100ms)
  return Math.max(100, Math.floor(jitteredDelay));
}

/**
 * Verifica se um erro é passível de retry
 * @param {Error} error - Objeto de erro
 * @param {object} config - Configuração de retry
 * @returns {boolean} true se deve fazer retry
 */
function isRetryableError(error, config) {
  if (!error) return false;
  
  const errorMessage = (error.message || '').toLowerCase();
  let telegramCode = error.code || error.error_code;
  
  // Se o código não estiver no objeto, tente extrair da mensagem de erro
  // Formato: "Erro Telegram API: 429 - ..."
  if (!telegramCode) {
    const match = errorMessage.match(/telegram api:\s*(\d+)/);
    if (match) {
      telegramCode = Number(match[1]);
    }
  }
  
  // Verificar por código do Telegram
  if (telegramCode) {
    const retryableTelegramCodes = [
      429,  // Too Many Requests
      500,  // Internal Server Error
      502,  // Bad Gateway
      503,  // Service Unavailable
      504   // Gateway Timeout
    ];
    
    if (retryableTelegramCodes.includes(Number(telegramCode))) {
      return true;
    }
  }
  
  // Verificar por tipo de erro
  const errorType = error.type || error.name || '';
  if (config.retryableErrorTypes.includes(errorType)) {
    return true;
  }
  
  // Verificar mensagem de erro
  const retryablePatterns = [
    'timeout',
    'econnreset',
    'etimedout',
    'enotfound',
    'econnrefused',
    'network error',
    'socket hang up'
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Executa uma operação com retry automático
 * @param {Function} sendFn - Função a ser executada (deve retornar NotificationResult)
 * @param {object} context - Contexto da operação (correlationId, userId, etc)
 * @param {object} config - Configuração de retry (opcional)
 * @returns {Promise<RetryResult>} Resultado da operação
 */
export async function sendWithRetry(sendFn, context, config = {}) {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const correlationId = context.correlationId || generateCorrelationId();
  
  const result = {
    success: false,
    attempts: 0,
    result: null,
    error: null,
    correlationId,
    retried: false
  };
  
  for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
    result.attempts = attempt;
    
    try {
      logger.debug(`Tentativa ${attempt}/${mergedConfig.maxRetries}`, {
        correlationId,
        attempt,
        maxRetries: mergedConfig.maxRetries,
        userId: context.userId,
        notificationType: context.notificationType
      });
      
      // Executar operação
      const operationResult = await sendFn();
      
      // Verificar se o resultado indica sucesso
      if (operationResult && operationResult.success) {
        result.success = true;
        result.result = operationResult;
        
        logger.info(`Operação bem-sucedida após ${attempt} tentativa(s)`, {
          correlationId,
          attempts: attempt,
          userId: context.userId,
          messageId: operationResult.messageId
        });
        
        return result;
      }
      
      // Resultado indica falha, mas não lançou erro
      // Verificar se é retryable
      if (operationResult && operationResult.error) {
        const error = operationResult.error;
        
        if (!isRetryableError(error, mergedConfig) || attempt === mergedConfig.maxRetries) {
          result.error = error;
          result.result = operationResult;
          
          logger.warn(`Falha não recuperável após ${attempt} tentativa(s)`, {
            correlationId,
            attempts: attempt,
            error: error.message,
            retryable: false
          });
          
          return result;
        }
        
        // Falha retryable, continuar para próxima tentativa
        result.retried = true;
        
        if (attempt < mergedConfig.maxRetries) {
          const delay = calculateDelay(attempt, mergedConfig);
          
          logger.info(`Retry agendado`, {
            correlationId,
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay,
            error: error.message
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
    } catch (error) {
      result.error = {
        code: error.name || 'UNEXPECTED_ERROR',
        message: error.message,
        retryable: isRetryableError(error, mergedConfig)
      };
      
      if (!isRetryableError(error, mergedConfig) || attempt === mergedConfig.maxRetries) {
        logger.error(`Erro não recuperável na tentativa ${attempt}`, error, {
          correlationId,
          attempt,
          userId: context.userId
        });
        
        return result;
      }
      
      // Erro retryable, continuar
      result.retried = true;
      
      if (attempt < mergedConfig.maxRetries) {
        const delay = calculateDelay(attempt, mergedConfig);
        
        logger.info(`Retry após erro`, {
          correlationId,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Todas as tentativas esgotadas
  logger.error(`Todas as ${mergedConfig.maxRetries} tentativas falharam`, null, {
    correlationId,
    attempts: result.attempts,
    userId: context.userId
  });
  
  return result;
}

/**
 * Interface de resultado do retry
 * @typedef {object} RetryResult
 * @property {boolean} success - Se a operação foi bem-sucedida
 * @property {number} attempts - Número de tentativas realizadas
 * @property {object|null} result - Resultado da operação (se sucesso)
 * @property {object|null} error - Erro final (se falha)
 * @property {string} correlationId - ID de correlação
 * @property {boolean} retried - Se houve pelo menos um retry
 */
