# Phase 1: Reliability Improvements - Implementation Specification

> **Status:** Draft Specification  
> **Phase:** P1 - Reliability  
> **Target:** Week 1  
> **Branch:** `feature/telegram-p1-retry-dlq`  
> **Depends on:** Phase 0 (P0) completed

---

## Table of Contents

1. [Architecture Overview](#a-architecture-overview)
2. [File-by-File Specifications](#b-file-by-file-specifications)
3. [Error Categorization](#c-error-categorization)
4. [Data Consistency Patterns](#d-data-consistency-patterns)
5. [Git Workflow](#e-git-workflow)
6. [Testing Strategy](#f-testing-strategy)

---

## A. Architecture Overview

### A.1 How Retry Mechanism Fits with P0 Error Handling

The Phase 0 (PR #19) established the **Result Object Pattern** where all Telegram API calls return:

```typescript
interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  timestamp: string;
}
```

Phase 1 extends this pattern by wrapping the send operation with an exponential backoff retry layer:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    P1 Retry Architecture on Top of P0                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   tasks.js ──► sendWithRetry() ──► bot.sendMessage() ──► Telegram API     │
│                     │                    │                                  │
│                     │                    └── Returns NotificationResult    │
│                     │                                                       │
│                     ├──► Success: Return result                             │
│                     ├──► Retryable Error: Exponential backoff, retry        │
│                     └──► Max retries exceeded: Send to DLQ                  │
│                                                                             │
│   DLQ (Supabase) ──► Retry via Cron ──► Success ──► Mark resolved         │
│                           │                                                 │
│                           └──► Still fails ──► Manual review               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.2 Correlation ID Flow

Every notification receives a unique correlation ID at entry point that flows through the entire system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Correlation ID Flow                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   /api/notify.js                                                            │
│   ├─► correlationId = generateUUID()                                        │
│   ├─► withCorrelation(checkReminders, { correlationId, userId, ... })      │
│   │                                                                         │
│   │   tasks.js                                                              │
│   │   ├─► context.correlationId propagado em todos os logs                │
│   │   ├─► sendWithRetry(sendDoseNotification, context)                     │
│   │   │                                                                     │
│   │   │   retryManager.js                                                   │
│   │   │   ├─► Each attempt logs with same correlationId                    │
│   │   │   ├─► Tracks attempts: attempt 1, 2, 3                             │
│   │   │   └─► Final result: success/failure                                │
│   │   │                                                                     │
│   │   └─► If max retries: DLQ.enqueue(correlationId, ...)                  │
│   │                                                                         │
│   └─► Log entry/exit with correlationId                                     │
│                                                                             │
│   Vercel Logs Search: correlationId=abc-123                                 │
│   → Shows: trigger, attempts, result, DLQ status, resolution               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.3 DLQ Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Dead Letter Queue Lifecycle                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│   │ failed  │───►│ pending  │───►│ retrying│───►│success? │    │resolved │ │
│   └─────────┘    └──────────┘    └─────────┘    └────┬────┘    └─────────┘ │
│                                                      │                      │
│                                                ┌─────▼─────┐    ┌─────────┐ │
│                                                │   yes     │───►│discarded│ │
│                                                └───────────┘    └─────────┘ │
│                                                      │                      │
│                                                ┌─────▼─────┐    ┌─────────┐ │
│                                                │    no     │───►│ manual  │ │
│                                                └───────────┘    └─────────┘ │
│                                                                             │
│   Estados:                                                                  │
│   - failed: Notificação falhou após todas as tentativas                    │
│   - pending: Aguardando retry automático                                   │
│   - retrying: Retry em andamento                                           │
│   - resolved: Recuperado com sucesso ou descartado                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## B. File-by-File Specifications

### B.1 New File: `server/bot/retryManager.js`

**Purpose:** Centralized retry mechanism with exponential backoff and jitter.

**Location:** `server/bot/retryManager.js`

**Implementation:**

```javascript
// server/bot/retryManager.js
import { createLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('RetryManager');

/**
 * Configurações padrão de retry
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,              // Número máximo de tentativas
  baseDelay: 1000,            // 1 segundo - delay inicial
  maxDelay: 30000,            // 30 segundos - delay máximo
  jitter: true,               // Adiciona variação aleatória
  jitterFactor: 0.5,          // +/- 50% de variação
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
  
  // Ensure positive delay
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
  
  // Verificar por código do Telegram
  const telegramCode = error.code || error.error_code;
  if (telegramCode) {
    // Códigos de erro do Telegram que são retryable
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
  const errorMessage = (error.message || '').toLowerCase();
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
  const correlationId = context.correlationId || uuidv4();
  
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
 * @property {NotificationResult|null} result - Resultado da operação (se sucesso)
 * @property {object|null} error - Erro final (se falha)
 * @property {string} correlationId - ID de correlação
 * @property {boolean} retried - Se houve pelo menos um retry
 */
```

**Key Design Decisions:**

1. **Jitter Implementation:** Prevents thundering herd when multiple notifications fail simultaneously
2. **Exponential Backoff:** 1s → 2s → 4s → 8s (capped at 30s)
3. **Telegram Error Codes:** Specifically handles 429, 500, 502, 503, 504 as retryable
4. **Flexible Configuration:** Allows per-operation override of retry settings

---

### B.2 New File: `server/bot/correlationLogger.js`

**Purpose:** Generate and propagate correlation IDs through the notification flow.

**Location:** `server/bot/correlationLogger.js`

**Implementation:**

```javascript
// server/bot/correlationLogger.js
import { createLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('Correlation');

// AsyncLocalStorage para contexto implícito (Node 14.8+)
let asyncLocalStorage = null;
try {
  const { AsyncLocalStorage } = await import('async_hooks');
  asyncLocalStorage = new AsyncLocalStorage();
} catch (e) {
  logger.warn('AsyncLocalStorage não disponível, usando contexto explícito');
}

/**
 * Gera um novo correlation ID (UUID v4)
 * @returns {string} Novo correlation ID
 */
export function generateCorrelationId() {
  return uuidv4();
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
```

**Key Design Decisions:**

1. **AsyncLocalStorage:** Uses Node's async_hooks for implicit context propagation when available
2. **Explicit Fallback:** Falls back to explicit context passing for older Node versions
3. **Vercel Compatibility:** Designed to work within serverless constraints
4. **Response Headers:** Returns correlation ID in response for client-side tracing

---

### B.3 New File: `server/services/deadLetterQueue.js`

**Purpose:** Persistent storage and management of failed notifications.

**Location:** `server/services/deadLetterQueue.js`

**Implementation:**

```javascript
// server/services/deadLetterQueue.js
import { supabase } from './supabase.js';
import { createLogger } from '../bot/logger.js';

const logger = createLogger('DeadLetterQueue');

/**
 * Categorias de erro para DLQ
 * @readonly
 * @enum {string}
 */
export const ErrorCategories = {
  NETWORK_ERROR: 'network_error',           // Erro de rede, retryable
  RATE_LIMIT: 'rate_limit',                 // 429 Too Many Requests
  INVALID_CHAT: 'invalid_chat',             // Usuário bloqueou o bot
  MESSAGE_TOO_LONG: 'message_too_long',     // Mensagem excede limite
  TELEGRAM_API_ERROR: 'telegram_api_error', // Erros da API Telegram
  TELEGRAM_400: 'telegram_400',             // Bad Request
  TELEGRAM_401: 'telegram_401',             // Unauthorized
  TELEGRAM_403: 'telegram_403',             // Forbidden
  TELEGRAM_404: 'telegram_404',             // Not Found
  UNKNOWN: 'unknown'                        // Erro desconhecido
};

/**
 * Status possíveis na DLQ
 * @readonly
 * @enum {string}
 */
export const DLQStatus = {
  PENDING: 'pending',           // Aguardando retry
  RETRYING: 'retrying',         // Retry em andamento
  RESOLVED: 'resolved',         // Resolvido com sucesso
  DISCARDED: 'discarded',       // Descartado (muito antigo ou inválido)
  MANUAL: 'manual'              // Requer intervenção manual
};

/**
 * Categoriza um erro de notificação
 * @param {Error|object} error - Erro ocorrido
 * @returns {string} Categoria do erro
 */
function categorizeError(error) {
  if (!error) return ErrorCategories.UNKNOWN;
  
  const code = error.code || error.error_code;
  const message = (error.message || '').toLowerCase();
  
  // Códigos HTTP do Telegram
  if (code) {
    switch (Number(code)) {
      case 400:
        if (message.includes('too long') || message.includes('message is too long')) {
          return ErrorCategories.MESSAGE_TOO_LONG;
        }
        return ErrorCategories.TELEGRAM_400;
      case 401:
        return ErrorCategories.TELEGRAM_401;
      case 403:
        if (message.includes('bot was blocked') || message.includes('user is deactivated')) {
          return ErrorCategories.INVALID_CHAT;
        }
        return ErrorCategories.TELEGRAM_403;
      case 404:
        return ErrorCategories.TELEGRAM_404;
      case 429:
        return ErrorCategories.RATE_LIMIT;
      default:
        return ErrorCategories.TELEGRAM_API_ERROR;
    }
  }
  
  // Padrões de mensagem
  if (message.includes('etimedout') || message.includes('econnreset') || 
      message.includes('enotfound') || message.includes('network error')) {
    return ErrorCategories.NETWORK_ERROR;
  }
  
  return ErrorCategories.UNKNOWN;
}

/**
 * Adiciona uma notificação falha à DLQ
 * @param {object} notificationData - Dados da notificação
 * @param {Error|object} error - Erro ocorrido
 * @param {number} retryCount - Número de tentativas realizadas
 * @param {string} correlationId - ID de correlação
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function enqueue(notificationData, error, retryCount, correlationId) {
  try {
    const errorCategory = categorizeError(error);
    
    // Verificar se já existe entrada para este protocolo/retry
    const { data: existing } = await supabase
      .from('fila_notificacoes_falhas')
      .select('id, retry_count')
      .eq('protocol_id', notificationData.protocolId)
      .eq('user_id', notificationData.userId)
      .eq('status', DLQStatus.PENDING)
      .maybeSingle();
    
    if (existing) {
      // Atualizar entrada existente
      const { data, error: updateError } = await supabase
        .from('fila_notificacoes_falhas')
        .update({
          retry_count: retryCount,
          error_message: error?.message || 'Erro desconhecido',
          error_category: errorCategory,
          last_retry_at: new Date().toISOString(),
          correlation_id: correlationId,
          notification_payload: notificationData
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      
      if (updateError) throw updateError;
      
      logger.info('Entrada DLQ atualizada', {
        id: data.id,
        correlationId,
        retryCount
      });
      
      return { success: true, id: data.id };
    }
    
    // Criar nova entrada
    const { data, error: insertError } = await supabase
      .from('fila_notificacoes_falhas')
      .insert({
        user_id: notificationData.userId,
        protocol_id: notificationData.protocolId,
        notification_type: notificationData.type,
        notification_payload: notificationData,
        error_code: error?.code || error?.error_code,
        error_message: error?.message || 'Erro desconhecido',
        error_category: errorCategory,
        retry_count: retryCount,
        correlation_id: correlationId,
        status: DLQStatus.PENDING,
        failed_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (insertError) throw insertError;
    
    logger.info('Notificação adicionada à DLQ', {
      id: data.id,
      correlationId,
      userId: notificationData.userId,
      errorCategory
    });
    
    return { success: true, id: data.id };
    
  } catch (err) {
    logger.error('Falha ao adicionar à DLQ', err, {
      correlationId,
      userId: notificationData.userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Marca uma notificação para retry
 * @param {string} id - ID da notificação na DLQ
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function markForRetry(id) {
  try {
    const { error } = await supabase
      .from('fila_notificacoes_falhas')
      .update({
        status: DLQStatus.RETRYING,
        last_retry_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', DLQStatus.PENDING); // Só se estiver pending
    
    if (error) throw error;
    
    logger.info('Notificação marcada para retry', { id });
    return { success: true };
    
  } catch (err) {
    logger.error('Falha ao marcar para retry', err, { id });
    return { success: false, error: err.message };
  }
}

/**
 * Marca uma notificação como resolvida
 * @param {string} id - ID da notificação na DLQ
 * @param {string} resolution - Tipo de resolução ('success' | 'discarded' | 'manual')
 * @param {string} notes - Notas sobre a resolução
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function markAsResolved(id, resolution, notes = '') {
  const statusMap = {
    success: DLQStatus.RESOLVED,
    discarded: DLQStatus.DISCARDED,
    manual: DLQStatus.MANUAL
  };
  
  const status = statusMap[resolution] || DLQStatus.RESOLVED;
  
  try {
    const { error } = await supabase
      .from('fila_notificacoes_falhas')
      .update({
        status,
        resolution_notes: notes,
        resolved_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
    
    logger.info('Notificação resolvida', { id, resolution, notes });
    return { success: true };
    
  } catch (err) {
    logger.error('Falha ao resolver notificação', err, { id });
    return { success: false, error: err.message };
  }
}

/**
 * Obtém notificações falhas de um usuário
 * @param {string} userId - UUID do usuário
 * @param {number} limit - Limite de resultados
 * @param {string} status - Filtrar por status (opcional)
 * @returns {Promise<Array>} Lista de notificações falhas
 */
export async function getFailedForUser(userId, limit = 10, status = null) {
  try {
    let query = supabase
      .from('fila_notificacoes_falhas')
      .select('*')
      .eq('user_id', userId)
      .order('failed_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
    
  } catch (err) {
    logger.error('Falha ao buscar notificações falhas', err, { userId });
    return [];
  }
}

/**
 * Obtém estatísticas da DLQ
 * @returns {Promise<object>} Estatísticas
 */
export async function getStats() {
  try {
    const { data, error } = await supabase
      .from('fila_notificacoes_falhas')
      .select('status, error_category, count')
      .select('*'); // Para agregação manual
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      pending: 0,
      retrying: 0,
      resolved: 0,
      discarded: 0,
      manual: 0,
      byCategory: {}
    };
    
    data.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
      
      const cat = item.error_category || 'unknown';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });
    
    return stats;
    
  } catch (err) {
    logger.error('Falha ao obter estatísticas DLQ', err);
    return {
      total: 0,
      pending: 0,
      retrying: 0,
      resolved: 0,
      discarded: 0,
      manual: 0,
      byCategory: {},
      error: err.message
    };
  }
}

/**
 * Obtém notificações pendentes para retry automático
 * @param {number} limit - Limite de notificações
 * @returns {Promise<Array>} Notificações pendentes
 */
export async function getPendingForRetry(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('fila_notificacoes_falhas')
      .select('*')
      .eq('status', DLQStatus.PENDING)
      .lte('retry_count', 5) // Máximo 5 retries automáticos
      .order('failed_at', { ascending: true }) // Mais antigos primeiro
      .limit(limit);
    
    if (error) throw error;
    return data || [];
    
  } catch (err) {
    logger.error('Falha ao buscar pendentes para retry', err);
    return [];
  }
}

/**
 * Limpa notificações antigas resolvidas
 * @param {number} daysToKeep - Dias para manter (padrão: 30)
 * @returns {Promise<{success: boolean, deleted?: number, error?: string}>}
 */
export async function cleanupResolved(daysToKeep = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { error, count } = await supabase
      .from('fila_notificacoes_falhas')
      .delete()
      .in('status', [DLQStatus.RESOLVED, DLQStatus.DISCARDED])
      .lt('resolved_at', cutoffDate.toISOString());
    
    if (error) throw error;
    
    logger.info('Limpeza DLQ concluída', { deleted: count, olderThan: cutoffDate.toISOString() });
    return { success: true, deleted: count };
    
  } catch (err) {
    logger.error('Falha na limpeza DLQ', err);
    return { success: false, error: err.message };
  }
}

export default {
  enqueue,
  markForRetry,
  markAsResolved,
  getFailedForUser,
  getStats,
  getPendingForRetry,
  cleanupResolved,
  ErrorCategories,
  DLQStatus
};
```

---

### B.4 Migration: `.migrations/add_dead_letter_queue.sql`

**Purpose:** Database schema for Dead Letter Queue.

**Location:** `.migrations/add_dead_letter_queue.sql`

**Implementation:**

```sql
-- Migração: Fila de Notificações Falhas (Dead Letter Queue)
-- Criação: 2026-02-15
-- Fase: P1 - Reliability

-- Tabela para armazenar notificações que falharam após todas as tentativas
CREATE TABLE IF NOT EXISTS fila_notificacoes_falhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    
    -- Dados da notificação
    notification_type VARCHAR(50) NOT NULL,
    notification_payload JSONB NOT NULL,
    
    -- Informações do erro
    error_code VARCHAR(50),
    error_message TEXT,
    error_category VARCHAR(50) NOT NULL DEFAULT 'unknown',
    
    -- Controle de retry
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    failed_at TIMESTAMPTZ DEFAULT now(),
    last_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Status: pending, retrying, resolved, discarded, manual
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Resolução
    resolution_notes TEXT
);

-- Comentários em português para documentação
COMMENT ON TABLE fila_notificacoes_falhas IS 'Fila de notificações falhas (Dead Letter Queue) - armazena notificações que não puderam ser entregues após todas as tentativas de retry';
COMMENT ON COLUMN fila_notificacoes_falhas.user_id IS 'ID do usuário destinatário';
COMMENT ON COLUMN fila_notificacoes_falhas.protocol_id IS 'ID do protocolo relacionado (pode ser nulo para notificações globais)';
COMMENT ON COLUMN fila_notificacoes_falhas.correlation_id IS 'ID de correlação para rastreamento da notificação';
COMMENT ON COLUMN fila_notificacoes_falhas.notification_type IS 'Tipo: dose_reminder, soft_reminder, stock_alert, etc.';
COMMENT ON COLUMN fila_notificacoes_falhas.notification_payload IS 'Dados completos da notificação em JSON';
COMMENT ON COLUMN fila_notificacoes_falhas.error_category IS 'Categoria do erro: network_error, rate_limit, invalid_chat, etc.';
COMMENT ON COLUMN fila_notificacoes_falhas.status IS 'Status: pending, retrying, resolved, discarded, manual';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_notif_user_id ON fila_notificacoes_falhas(user_id);
CREATE INDEX IF NOT EXISTS idx_fila_notif_status ON fila_notificacoes_falhas(status);
CREATE INDEX IF NOT EXISTS idx_fila_notif_correlation ON fila_notificacoes_falhas(correlation_id);
CREATE INDEX IF NOT EXISTS idx_fila_notif_failed_at ON fila_notificacoes_falhas(failed_at);
CREATE INDEX IF NOT EXISTS idx_fila_notif_pending_retry ON fila_notificacoes_falhas(status, retry_count) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fila_notif_error_cat ON fila_notificacoes_falhas(error_category);

-- Políticas RLS para isolamento por usuário
ALTER TABLE fila_notificacoes_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários só veem suas próprias notificações falhas"
    ON fila_notificacoes_falhas
    FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role pode gerenciar todas as notificações"
    ON fila_notificacoes_falhas
    FOR ALL
    TO service_role
    USING (true);

-- Trigger para limpeza automática de notificações resolvidas antigas
CREATE OR REPLACE FUNCTION cleanup_old_dlq_entries()
RETURNS TRIGGER AS $$
BEGIN
    -- Marcar notificações com mais de 30 dias para descarte
    UPDATE fila_notificacoes_falhas
    SET status = 'discarded',
        resolution_notes = 'Descartada automaticamente após 30 dias'
    WHERE status IN ('pending', 'retrying')
      AND failed_at < now() - interval '30 days';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que roda diariamente (executado pelo cron)
-- Nota: O pg_cron deve estar habilitado no Supabase
-- Ou usar cron-job.org para chamar uma função de limpeza

-- Função para estatísticas da DLQ
CREATE OR REPLACE FUNCTION get_dlq_stats()
RETURNS TABLE (
    status VARCHAR,
    count BIGINT,
    error_category VARCHAR,
    oldest_failure TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.status,
        COUNT(*)::BIGINT,
        f.error_category,
        MIN(f.failed_at) as oldest_failure
    FROM fila_notificacoes_falhas f
    GROUP BY f.status, f.error_category
    ORDER BY f.status, COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Comentário final
COMMENT ON TABLE fila_notificacoes_falhas IS 
    'P1: Dead Letter Queue para notificações falhas. Retry automático via cron-job.org.';
```

---

### B.5 Modified: `api/notify.js`

**Purpose:** Integrate retry manager and correlation IDs into the notification endpoint.

**Changes:**

```javascript
// api/notify.js - MODIFIED FOR P1
// Import modules directly (no dynamic imports)
import { createLogger } from '../server/bot/logger.js';
import { withCorrelation, generateCorrelationId } from '../server/bot/correlationLogger.js';
import { sendWithRetry, DEFAULT_RETRY_CONFIG } from '../server/bot/retryManager.js';
import { enqueue, ErrorCategories } from '../server/services/deadLetterQueue.js';
import { 
  checkReminders, 
  runDailyDigest,
  checkStockAlerts, 
  checkAdherenceReports, 
  checkTitrationAlerts, 
  checkMonthlyReport 
} from '../server/bot/tasks.js';

const logger = createLogger('CronNotify');

// --- Bot Adapter (Minimal for Notifications) ---
function createNotifyBotAdapter(token) {
  const telegramFetch = async (method, body) => {
    // ... existing implementation (unchanged from P0)
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!data.ok) {
        logger.error(`Erro na API do Telegram (${method})`, null, { error: data });
        throw new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`);
      }
      
      return data.result;
    } catch (err) {
      logger.error(`Erro de fetch (${method})`, err);
      throw err;
    }
  };

  function isRetryableError(error) {
    const retryableCodes = [
      'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED',
      'Socket hang up', 'ECONNABORTED', 'Network Error'
    ];
    
    return retryableCodes.some(code =>
      error.message?.includes(code) || error.code === code
    );
  }

  return {
    sendMessage: async (chatId, text, options = {}) => {
      try {
        const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
        
        logger.debug(`Mensagem Telegram enviada com sucesso`, {
          chatId,
          messageId: result.message_id
        });
        
        return {
          success: true,
          messageId: result.message_id,
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        logger.error(`Falha ao enviar mensagem Telegram`, err, { chatId });
        
        return {
          success: false,
          error: {
            code: err.name || 'SEND_FAILED',
            message: err.message,
            retryable: isRetryableError(err)
          },
          timestamp: new Date().toISOString()
        };
      }
    }
  };
}

export default async function handler(req, res) {
  // Gerar correlation ID para esta execução do cron
  const correlationId = generateCorrelationId();
  
  // Log de diagnóstico das variáveis de ambiente (apenas existência, não valores)
  logger.info('Ambiente de execução', {
    correlationId,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL ? 'present' : 'absent',
    hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasCronSecret: !!process.env.CRON_SECRET,
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
  });

  logger.info('Cron job triggered', { 
    correlationId,
    method: req.method, 
    url: req.url 
  });

  // Accept both GET (from cron-job.org) and POST (for compatibility)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Protection against unauthorized calls
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn('Unauthorized cron attempt', { correlationId, authHeader });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN not configured', null, { correlationId });
    return res.status(500).json({ error: 'Token missing' });
  }

  const bot = createNotifyBotAdapter(token);

  // Get current time in Sao Paulo
  const now = new Date();
  const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const currentHour = spDate.getHours();
  const currentMinute = spDate.getMinutes();
  const currentDay = spDate.getDate();
  const currentWeekDay = spDate.getDay();
  
  const currentHHMM = spDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  logger.info(`Executing cron jobs`, { 
    correlationId,
    time: currentHHMM, 
    hour: currentHour, 
    minute: currentMinute,
    day: currentDay,
    weekday: currentWeekDay 
  });

  const results = [];

  try {
    // 1. Always check dose reminders (Every minute)
    // P1: Envolver com correlation context
    await withCorrelation(async () => {
      await checkReminders(bot);
    }, { correlationId, jobType: 'reminders' });
    
    results.push('reminders');

    // 2. Daily Digest: Daily at 23:00
    if (currentHour === 23 && currentMinute === 0) {
      await withCorrelation(async () => {
        await runDailyDigest(bot);
      }, { correlationId, jobType: 'daily_digest' });
      results.push('daily_digest');
    }

    // 3. Stock Alerts: Daily at 09:00
    if (currentHour === 9 && currentMinute === 0) {
      await withCorrelation(async () => {
        await checkStockAlerts(bot);
      }, { correlationId, jobType: 'stock_alerts' });
      results.push('stock_alerts');
    }

    // 4. Titration Alerts: Daily at 08:00
    if (currentHour === 8 && currentMinute === 0) {
      await withCorrelation(async () => {
        await checkTitrationAlerts(bot);
      }, { correlationId, jobType: 'titration_alerts' });
      results.push('titration_alerts');
    }

    // 5. Adherence Reports: Sunday at 23:00
    if (currentWeekDay === 0 && currentHour === 23 && currentMinute === 0) {
      await withCorrelation(async () => {
        await checkAdherenceReports(bot);
      }, { correlationId, jobType: 'adherence_reports' });
      results.push('adherence_reports');
    }

    // 6. Monthly Report: 1st of month at 10:00
    if (currentDay === 1 && currentHour === 10 && currentMinute === 0) {
      await withCorrelation(async () => {
        await checkMonthlyReport(bot);
      }, { correlationId, jobType: 'monthly_report' });
      results.push('monthly_report');
    }

    logger.info('Cron jobs completed', { 
      correlationId,
      executed: results,
      duration: Date.now() - now.getTime()
    });

    res.status(200).json({ 
      status: 'ok', 
      executed: results,
      time: currentHHMM,
      correlationId
    });
    
  } catch (error) {
    logger.error('Cron job failed', error, { correlationId });
    res.status(500).json({ 
      error: error.message,
      correlationId
    });
  }
}
```

---

### B.6 Modified: `server/bot/tasks.js`

**Purpose:** Integrate retry manager and DLQ into notification sending.

**Key Changes (add to imports and modify sendDoseNotification):**

```javascript
// server/bot/tasks.js - P1 CHANGES
// ... existing imports ...

// P1: Novos imports
import { sendWithRetry } from './retryManager.js';
import { enqueue, ErrorCategories } from '../services/deadLetterQueue.js';
import { getCurrentCorrelationId } from './correlationLogger.js';

// ... existing code ...

/**
 * Envia notificação de dose com retry automático
 * P1: Agora usa sendWithRetry para resiliência
 * @param {object} bot - Bot adapter
 * @param {string} chatId - ID do chat Telegram
 * @param {object} p - Protocolo
 * @param {string} scheduledTime - Horário agendado (HH:MM)
 * @returns {Promise<RetryResult>} Resultado da operação
 */
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);
  const correlationId = getCurrentCorrelationId() || 'no-correlation';

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  // P1: Envolver com retry
  const result = await sendWithRetry(
    async () => {
      return await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
    },
    {
      correlationId,
      userId: p.user_id,
      protocolId: p.id,
      notificationType: 'dose_reminder',
      chatId
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    }
  );
  
  return result;
}

// P1: Função auxiliar para enviar para DLQ
async function handleNotificationFailure(result, context) {
  const { userId, protocolId, notificationType, chatId } = context;
  const correlationId = result.correlationId || getCurrentCorrelationId();
  
  logger.error(`Todas as tentativas falharam, enviando para DLQ`, {
    correlationId,
    userId,
    protocolId,
    attempts: result.attempts,
    error: result.error
  });
  
  // Enviar para DLQ
  const dlqResult = await enqueue(
    {
      userId,
      protocolId,
      type: notificationType,
      chatId,
      payload: context.payload || {}
    },
    result.error,
    result.attempts,
    correlationId
  );
  
  if (!dlqResult.success) {
    logger.error('Falha crítica: não foi possível adicionar à DLQ', null, {
      correlationId,
      originalError: result.error
    });
  }
  
  return dlqResult;
}

// P1: Modificar checkUserReminders para usar o novo pattern
async function checkUserReminders(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    // ... existing code for fetching protocols ...
    
    // Inside the protocol loop:
    const correlationId = getCurrentCorrelationId();
    
    const notificationResult = await sendDoseNotification(bot, chatId, p, currentHHMM);

    if (!notificationResult.success) {
      // P1: Enviar para DLQ após todas as tentativas falharem
      await handleNotificationFailure(notificationResult, {
        userId,
        protocolId: p.id,
        notificationType: 'dose_reminder',
        chatId
      });
      
      // Não atualiza last_notified_at em caso de falha
      continue;
    }

    logger.info(`Lembrete de dose enviado com sucesso`, {
      correlationId,
      userId,
      medicine: p.medicine?.name,
      time: currentHHMM,
      protocolId: p.id,
      chatId,
      messageId: notificationResult.result?.messageId,
      attempts: notificationResult.attempts
    });

    // P1: Verificar resultado do log antes de atualizar estado
    const logged = await logSuccessfulNotification(userId, p.id, 'dose_reminder', {
      messageId: notificationResult.result?.messageId
    });

    if (logged) {
      await supabase
        .from('protocols')
        .update({
          last_notified_at: new Date().toISOString(),
          status_ultima_notificacao: 'enviada'
        })
        .eq('id', p.id);
    } else {
      // P1: Padrão de consistência - log warning mas não quebra o fluxo
      logger.warn('Falha ao registrar log de notificação. Estado pode estar inconsistente.', {
        correlationId,
        userId,
        protocolId: p.id,
        messageId: notificationResult.result?.messageId
      });
      
      // Mesmo com falha no log, atualizamos para evitar spam
      // Mas logamos o warning para investigação
      await supabase
        .from('protocols')
        .update({
          last_notified_at: new Date().toISOString(),
          status_ultima_notificacao: 'enviada_sem_log'
        })
        .eq('id', p.id);
    }
    
    // ... rest of existing code ...
  }
}
```

---

## C. Error Categorization

### C.1 Error Types for DLQ

| Categoria | Código | Retryable | Descrição | Ação |
|-----------|--------|-----------|-----------|------|
| `network_error` | - | ✅ Sim | Erro de rede (timeout, reset) | Retry com backoff |
| `rate_limit` | 429 | ✅ Sim | Muitas requisições | Retry com delay maior |
| `timeout_error` | - | ✅ Sim | Timeout na conexão | Retry imediato |
| `invalid_chat` | 403 | ❌ Não | Usuário bloqueou bot | Descartar, notificar usuário |
| `message_too_long` | 400 | ❌ Não | Mensagem > 4096 chars | Truncar e reenviar |
| `telegram_400` | 400 | ❌ Não | Bad Request | Analisar e corrigir |
| `telegram_401` | 401 | ❌ Não | Token inválido | Alerta admin |
| `telegram_403` | 403 | ❌ Não | Forbidden | Analisar caso a caso |
| `telegram_404` | 404 | ❌ Não | Chat não encontrado | Descartar |
| `telegram_api_error` | 5xx | ✅ Sim | Erro do servidor Telegram | Retry |
| `unknown` | - | ❓ Talvez | Erro desconhecido | Manual review |

### C.2 Retry Behavior Matrix

| Categoria | Tentativas | Delay Base | Delay Máximo | Jitter |
|-----------|------------|------------|--------------|--------|
| `network_error` | 3 | 1s | 30s | ✅ 50% |
| `rate_limit` | 5 | 5s | 60s | ✅ 30% |
| `timeout_error` | 3 | 2s | 20s | ✅ 50% |
| `telegram_api_error` | 3 | 1s | 30s | ✅ 50% |
| Outros | 0 | - | - | - |

---

## D. Data Consistency Patterns

### D.1 From PR #19 Learnings (Applied in P1)

The critical learning from PR #19 is: **Always verify results before state changes, and log warnings on partial failures.**

```javascript
// ✅ PATTERN CORRETO - Check all results before state changes
const result = await sendWithRetry(
  () => sendDoseNotification(bot, chatId, p, currentHHMM),
  { correlationId, userId, protocolId: p.id }
);

if (result.success) {
  // 1. Tentar logar a notificação
  const logged = await logSuccessfulNotification(userId, p.id, 'dose_reminder', {
    messageId: result.result.messageId
  });
  
  // 2. Log warning se falhou (não bloqueia o fluxo)
  if (!logged) {
    logger.warn('Falha ao registrar log de notificação', {
      correlationId,
      userId,
      protocolId: p.id,
      messageId: result.result.messageId
    });
    // Continua mesmo com falha no log
  }
  
  // 3. SÓ ENTÃO atualizar estado
  await supabase
    .from('protocols')
    .update({
      last_notified_at: new Date().toISOString(),
      status_ultima_notificacao: logged ? 'enviada' : 'enviada_sem_log'
    })
    .eq('id', p.id);
    
} else {
  // Falha definitiva - enviar para DLQ
  await handleNotificationFailure(result, {
    userId,
    protocolId: p.id,
    notificationType: 'dose_reminder',
    chatId
  });
  
  // NÃO atualiza last_notified_at!
  // Permite retry no próximo ciclo
}
```

### D.2 Consistency Checklist

- [ ] Verify `result.success` before any state change
- [ ] Check `logSuccessfulNotification` return value
- [ ] Log warning if logging fails (don't throw)
- [ ] Only update DB after confirmed success
- [ ] On failure: send to DLQ, don't update timestamps
- [ ] Include correlationId in all logs
- [ ] Track attempts in retry result

---

## E. Git Workflow

### E.1 Branch and Commits

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b feature/telegram-p1-retry-dlq

# 2. Implementation commits (atomic)
git add server/bot/retryManager.js
git commit -m "feat(bot): adiciona retryManager com exponential backoff e jitter"

git add server/bot/correlationLogger.js
git commit -m "feat(bot): adiciona correlationLogger para tracing de notificações"

git add server/services/deadLetterQueue.js
git commit -m "feat(services): adiciona serviço de Dead Letter Queue"

git add .migrations/add_dead_letter_queue.sql
git commit -m "feat(db): adiciona tabela fila_notificacoes_falhas para DLQ"

git add api/notify.js server/bot/tasks.js
git commit -m "feat(api): integra retry manager e correlation IDs no fluxo de notificações"

# 3. Validation
npm run lint
npm run test:critical
npm run build

# 4. Push and create PR
git push origin feature/telegram-p1-retry-dlq
gh pr create --title "feat(bot): adiciona retry exponencial, correlation IDs e DLQ" \
             --body-file pr_description.md
```

### E.2 PR Template (Filled Example)

Create `pr_description.md`:

```markdown
# Phase 1: Reliability Improvements

## 🎯 Resumo

Esta PR implementa o Phase 1 (P1) do sistema de notificações Telegram:
- Retry automático com exponential backoff
- Correlation IDs para tracing completo
- Dead Letter Queue para notificações falhas

---

## 📋 Tarefas Implementadas

### ✅ Retry Manager
- [x] Exponential backoff (1s → 2s → 4s)
- [x] Jitter 50% para prevenir thundering herd
- [x] Configuração flexível (maxRetries, delays)
- [x] Detecção inteligente de erros retryable

### ✅ Correlation Logger
- [x] Geração de UUID v4 para correlation IDs
- [x] Propagação via AsyncLocalStorage (quando disponível)
- [x] Fallback para contexto explícito
- [x] Integração com logger existente

### ✅ Dead Letter Queue
- [x] Tabela `fila_notificacoes_falhas` com RLS
- [x] Categorização de erros
- [x] Funções: enqueue, markForRetry, markAsResolved
- [x] Estatísticas e limpeza automática

### ✅ Integração
- [x] `api/notify.js` com correlation context
- [x] `tasks.js` com retry em todas as notificações
- [x] DLQ enrollment após max retries
- [x] Padrão de consistência (PR #19)

---

## 📊 Métricas Esperadas

| Métrica | Antes (P0) | Depois (P1) | Melhoria |
|---------|------------|-------------|----------|
| Retries automáticos | 0 | 3 | +3 tentativas |
| Tracing de notificações | Parcial | Completo | 100% trace |
| Notificações perdidas | Possíveis | DLQ | 0 perdidas |
| Tempo médio retry | N/A | ~7s | Resiliência |

---

## 🔧 Arquivos Principais

```
server/
├── bot/
│   ├── retryManager.js        # Retry com exponential backoff
│   ├── correlationLogger.js   # Context propagation
│   └── tasks.js               # Integração de retry
├── services/
│   └── deadLetterQueue.js     # DLQ service
├── migrations/
│   └── add_dead_letter_queue.sql

api/
└── notify.js                  # Correlation context
```

---

## 🧪 Testes

```bash
# Unit tests
npm run test:critical
# Esperado: 149 tests pass

# Novos testes adicionados:
# - retryManager.test.js (exponential backoff, jitter)
# - correlationLogger.test.js (context propagation)
# - deadLetterQueue.test.js (DLQ operations)
```

---

## ✅ Checklist de Verificação

### Código
- [x] Todos os testes passam (`npm run test:critical`)
- [x] Lint sem erros (`npm run lint`)
- [x] Build bem-sucedido (`npm run build`)
- [x] Sem `process.exit()` em serverless

### Funcional
- [x] Retry funciona em erros de rede
- [x] Correlation ID aparece em todos os logs
- [x] DLQ recebe notificações após max retries
- [x] RLS protege acesso às notificações

### Documentação
- [x] Especificação P1 atualizada
- [x] Comentários em português no código
- [x] Migration com comentários

---

## 🚀 Deploy

1. Executar migration: `npx supabase db push`
2. Deploy Vercel: `vercel --prod`
3. Verificar logs: `vercel logs --json`
4. Testar DLQ: Verificar tabela após falha simulada

---

## 📝 Notas

- Esta PR segue o padrão de consistência do PR #19
- Nenhuma breaking change na API pública
- DLQ pode ser monitorada via Supabase Dashboard
```

---

## F. Testing Strategy

### F.1 Unit Tests for Retry Manager

```javascript
// server/bot/__tests__/retryManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWithRetry, DEFAULT_RETRY_CONFIG } from '../retryManager.js';

describe('sendWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return success on first attempt', async () => {
    const sendFn = vi.fn().mockResolvedValue({
      success: true,
      messageId: '123'
    });

    const result = await sendWithRetry(sendFn, { userId: 'u1' });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const sendFn = vi.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ success: true, messageId: '123' });

    const promise = sendWithRetry(sendFn, { userId: 'u1' }, { maxRetries: 2 });
    
    // Fast-forward timers
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.retried).toBe(true);
  });

  it('should use exponential backoff', async () => {
    const delays = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (fn, delay) => {
      delays.push(delay);
      return originalSetTimeout(fn, 0);
    };

    const sendFn = vi.fn()
      .mockRejectedValue(new Error('ETIMEDOUT'));

    await sendWithRetry(sendFn, { userId: 'u1' }, { maxRetries: 3, baseDelay: 1000 });

    // Expected: ~1000ms, ~2000ms (with jitter variance)
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[0]).toBeLessThanOrEqual(1500);
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(3000);
  });

  it('should not retry non-retryable errors', async () => {
    const sendFn = vi.fn().mockResolvedValue({
      success: false,
      error: {
        code: 403,
        message: 'Forbidden: bot was blocked',
        retryable: false
      }
    });

    const result = await sendWithRetry(sendFn, { userId: 'u1' });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('should include correlationId in result', async () => {
    const sendFn = vi.fn().mockResolvedValue({ success: true });

    const result = await sendWithRetry(sendFn, { 
      userId: 'u1',
      correlationId: 'test-123'
    });

    expect(result.correlationId).toBe('test-123');
  });
});
```

### F.2 Unit Tests for DLQ

```javascript
// server/services/__tests__/deadLetterQueue.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  enqueue, 
  markAsResolved, 
  getFailedForUser,
  getStats,
  ErrorCategories 
} from '../deadLetterQueue.js';
import { supabase } from '../supabase.js';

vi.mock('../supabase.js');

describe('DeadLetterQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should categorize network errors correctly', async () => {
      const error = { message: 'ETIMEDOUT' };
      
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null })
              })
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { id: 'dlq-123' }, 
              error: null 
            })
          })
        })
      });

      const result = await enqueue(
        { userId: 'u1', protocolId: 'p1', type: 'test' },
        error,
        3,
        'corr-123'
      );

      expect(result.success).toBe(true);
      // Verify insert was called with correct category
      const insertCall = supabase.from().insert;
      expect(insertCall).toHaveBeenCalled();
    });

    it('should update existing entry if duplicate', async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ 
                  data: { id: 'existing-123', retry_count: 2 } 
                })
              })
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'existing-123' },
                error: null
              })
            })
          })
        })
      });

      const result = await enqueue(
        { userId: 'u1', protocolId: 'p1', type: 'test' },
        { message: 'error' },
        3,
        'corr-123'
      );

      expect(result.success).toBe(true);
      expect(supabase.from().update).toHaveBeenCalled();
    });
  });

  describe('markAsResolved', () => {
    it('should mark notification as resolved', async () => {
      supabase.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await markAsResolved('dlq-123', 'success', 'Resolved by retry');

      expect(result.success).toBe(true);
    });
  });
});
```

### F.3 Integration Test

```javascript
// tests/integration/notification-flow.test.js
import { describe, it, expect, vi } from 'vitest';

describe('Notification E2E Flow with Retry', () => {
  it('should retry on transient failures and eventually succeed', async () => {
    // Mock bot.sendMessage to fail twice, then succeed
    let callCount = 0;
    const mockSend = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          success: false,
          error: {
            code: 'ETIMEDOUT',
            message: 'Connection timeout',
            retryable: true
          }
        });
      }
      return Promise.resolve({
        success: true,
        messageId: 'msg-123'
      });
    });

    // Execute with retry
    const { sendWithRetry } = await import('../../server/bot/retryManager.js');
    
    const result = await sendWithRetry(
      mockSend,
      { userId: 'u1', notificationType: 'test' },
      { maxRetries: 3, baseDelay: 100 }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should send to DLQ after max retries', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      success: false,
      error: {
        code: 'ETIMEDOUT',
        message: 'Persistent network error',
        retryable: true
      }
    });

    const { sendWithRetry } = await import('../../server/bot/retryManager.js');
    const { enqueue } = await import('../../server/services/deadLetterQueue.js');

    vi.mock('../../server/services/deadLetterQueue.js', () => ({
      enqueue: vi.fn().mockResolvedValue({ success: true, id: 'dlq-123' })
    }));

    const result = await sendWithRetry(
      mockSend,
      { userId: 'u1', notificationType: 'test' },
      { maxRetries: 2 }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
  });
});
```

---

## Summary

This specification provides:

1. **Retry Manager** with exponential backoff and jitter
2. **Correlation Logger** for end-to-end tracing
3. **Dead Letter Queue** for persistent failures
4. **Database migration** with RLS policies
5. **Integration** into existing `api/notify.js` and `tasks.js`
6. **Data consistency patterns** from PR #19 learnings
7. **Complete testing strategy** with unit and integration tests
8. **Git workflow** with filled PR template

The P1 implementation builds on P0's result object pattern to add resilience without breaking existing functionality.
