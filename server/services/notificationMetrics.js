// server/services/notificationMetrics.js
import { createLogger } from '../bot/logger.js';

const logger = createLogger('NotificationMetrics');

/**
 * Janela de retenção de métricas em memória (em minutos)
 */
const METRICS_RETENTION_MINUTES = 60;

/**
 * Estrutura de métricas em memória
 */
class MetricsStore {
  constructor() {
    this.successCount = new Map();      // key: "YYYY-MM-DDTHH:mm", value: count
    this.failureCount = new Map();      // key: "YYYY-MM-DDTHH:mm", value: count
    this.retryCount = new Map();        // key: "YYYY-MM-DDTHH:mm", value: count
    this.deliveryTimes = new Map();     // key: "YYYY-MM-DDTHH:mm", value: number[]
    this.errorBreakdown = new Map();    // key: errorCategory, value: count
    this.rateLimitHits = new Map();     // key: "YYYY-MM-DDTHH:mm", value: count
    this.lastSuccessfulSend = null;
    this.lastFailure = null;
    this.dlqSize = 0;
    this.lastDlqCheck = null;
  }

  /**
   * Gera chave de minuto atual
   * @returns {string} Formato: "YYYY-MM-DDTHH:mm"
   */
  getCurrentMinuteKey() {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  }

  /**
   * Incrementa contador em um Map
   * @param {Map} map - Mapa de contadores
   * @param {string} key - Chave
   */
  increment(map, key) {
    const current = map.get(key) || 0;
    map.set(key, current + 1);
  }

  /**
   * Limpa dados antigos (mais de METRICS_RETENTION_MINUTES)
   */
  cleanup() {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - METRICS_RETENTION_MINUTES);
    const cutoffKey = cutoff.toISOString().slice(0, 16);

    const cleanMap = (map) => {
      for (const key of map.keys()) {
        if (key < cutoffKey) {
          map.delete(key);
        }
      }
    };

    cleanMap(this.successCount);
    cleanMap(this.failureCount);
    cleanMap(this.retryCount);
    cleanMap(this.deliveryTimes);
    cleanMap(this.rateLimitHits);

    logger.debug('Métricas limpas', { cutoffKey });
  }
}

// Instância singleton
const metricsStore = new MetricsStore();

/**
 * Registra uma notificação bem-sucedida
 * @param {number} deliveryTimeMs - Tempo de entrega em ms (opcional)
 * @param {object} metadata - Metadados adicionais
 */
export function recordSuccess(deliveryTimeMs = null, metadata = {}) {
  const key = metricsStore.getCurrentMinuteKey();
  metricsStore.increment(metricsStore.successCount, key);
  
  if (deliveryTimeMs) {
    if (!metricsStore.deliveryTimes.has(key)) {
      metricsStore.deliveryTimes.set(key, []);
    }
    metricsStore.deliveryTimes.get(key).push(deliveryTimeMs);
  }
  
  metricsStore.lastSuccessfulSend = new Date().toISOString();
  
  logger.debug('Métrica: sucesso registrado', {
    minute: key,
    deliveryTimeMs,
    ...metadata
  });
}

/**
 * Registra uma notificação falha
 * @param {string} errorCategory - Categoria do erro
 * @param {boolean} wasRetryable - Se o erro era retryable
 * @param {object} metadata - Metadados adicionais
 */
export function recordFailure(errorCategory = 'unknown', wasRetryable = false, metadata = {}) {
  const key = metricsStore.getCurrentMinuteKey();
  metricsStore.increment(metricsStore.failureCount, key);
  
  // Error breakdown
  const catKey = `${errorCategory}_${wasRetryable ? 'retryable' : 'final'}`;
  metricsStore.increment(metricsStore.errorBreakdown, catKey);
  
  metricsStore.lastFailure = {
    timestamp: new Date().toISOString(),
    category: errorCategory,
    retryable: wasRetryable
  };
  
  logger.debug('Métrica: falha registrada', {
    minute: key,
    errorCategory,
    wasRetryable,
    ...metadata
  });
}

/**
 * Registra uma tentativa de retry
 * @param {number} attemptNumber - Número da tentativa (1-based)
 * @param {object} metadata - Metadados adicionais
 */
export function recordRetry(attemptNumber, metadata = {}) {
  const key = metricsStore.getCurrentMinuteKey();
  metricsStore.increment(metricsStore.retryCount, key);
  
  // Track retry distribution
  const retryKey = `attempt_${attemptNumber}`;
  metricsStore.increment(metricsStore.errorBreakdown, retryKey);
  
  logger.debug('Métrica: retry registrado', {
    minute: key,
    attemptNumber,
    ...metadata
  });
}

/**
 * Registra hit de rate limit
 * @param {object} metadata - Metadados adicionais
 */
export function recordRateLimitHit(metadata = {}) {
  const key = metricsStore.getCurrentMinuteKey();
  metricsStore.increment(metricsStore.rateLimitHits, key);
  
  logger.debug('Métrica: rate limit hit', {
    minute: key,
    ...metadata
  });
}

/**
 * Atualiza tamanho da DLQ
 * @param {number} size - Tamanho atual da DLQ
 */
export function updateDlqSize(size) {
  metricsStore.dlqSize = size;
  metricsStore.lastDlqCheck = new Date().toISOString();
}

/**
 * Calcula percentil de um array de números
 * @param {number[]} arr - Array de números
 * @param {number} p - Percentil (0-100)
 * @returns {number} Valor do percentil
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Obtém métricas agregadas para um período
 * @param {number} windowMinutes - Janela de tempo em minutos (padrão: 5)
 * @returns {object} Métricas agregadas
 */
export function getMetrics(windowMinutes = 5) {
  const now = new Date();
  const keys = [];
  
  // Gerar chaves dos últimos N minutos
  for (let i = 0; i < windowMinutes; i++) {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() - i);
    keys.push(d.toISOString().slice(0, 16));
  }

  // Agregar contagens
  let totalSuccess = 0;
  let totalFailure = 0;
  let totalRetry = 0;
  let totalRateLimitHits = 0;
  const allDeliveryTimes = [];

  keys.forEach(key => {
    totalSuccess += metricsStore.successCount.get(key) || 0;
    totalFailure += metricsStore.failureCount.get(key) || 0;
    totalRetry += metricsStore.retryCount.get(key) || 0;
    totalRateLimitHits += metricsStore.rateLimitHits.get(key) || 0;
    
    const times = metricsStore.deliveryTimes.get(key) || [];
    allDeliveryTimes.push(...times);
  });

  const totalAttempts = totalSuccess + totalFailure;
  const errorRate = totalAttempts > 0 ? (totalFailure / totalAttempts) * 100 : 0;

  // Calcular percentis de tempo de entrega
  const deliveryTimeStats = {
    count: allDeliveryTimes.length,
    avg: allDeliveryTimes.length > 0 
      ? Math.round(allDeliveryTimes.reduce((a, b) => a + b, 0) / allDeliveryTimes.length)
      : 0,
    p50: percentile(allDeliveryTimes, 50),
    p95: percentile(allDeliveryTimes, 95),
    p99: percentile(allDeliveryTimes, 99)
  };

  // Error breakdown
  const errorBreakdown = {};
  for (const [key, count] of metricsStore.errorBreakdown.entries()) {
    errorBreakdown[key] = count;
  }

  return {
    window: {
      start: keys[keys.length - 1],
      end: keys[0],
      minutes: windowMinutes
    },
    summary: {
      totalAttempts,
      successful: totalSuccess,
      failed: totalFailure,
      retried: totalRetry,
      errorRate: Math.round(errorRate * 100) / 100, // 2 decimals
      rateLimitHits: totalRateLimitHits
    },
    deliveryTime: deliveryTimeStats,
    errorBreakdown,
    dlq: {
      currentSize: metricsStore.dlqSize,
      lastCheck: metricsStore.lastDlqCheck
    },
    timestamps: {
      lastSuccessfulSend: metricsStore.lastSuccessfulSend,
      lastFailure: metricsStore.lastFailure
    }
  };
}

/**
 * Obtém métricas para dashboard
 * @returns {object} Métricas simplificadas
 */
export function getDashboardMetrics() {
  const metrics = getMetrics(60); // Última hora
  
  return {
    sentToday: metrics.summary.successful,
    failed: metrics.summary.failed,
    errorRate: metrics.summary.errorRate,
    inDlq: metrics.dlq.currentSize,
    avgDeliveryTime: metrics.deliveryTime.avg,
    lastSuccessfulSend: metrics.timestamps.lastSuccessfulSend
  };
}

/**
 * Reseta todas as métricas (útil para testes)
 */
export function resetMetrics() {
  metricsStore.successCount.clear();
  metricsStore.failureCount.clear();
  metricsStore.retryCount.clear();
  metricsStore.deliveryTimes.clear();
  metricsStore.errorBreakdown.clear();
  metricsStore.rateLimitHits.clear();
  metricsStore.dlqSize = 0;
  metricsStore.lastSuccessfulSend = null;
  metricsStore.lastFailure = null;
  
  logger.info('Métricas resetadas');
}

/**
 * Inicia limpeza periódica de métricas
 * @param {number} intervalMinutes - Intervalo em minutos
 * @returns {Interval} Interval ID
 */
export function startPeriodicCleanup(intervalMinutes = 10) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  return setInterval(() => {
    metricsStore.cleanup();
  }, intervalMs);
}

export default {
  recordSuccess,
  recordFailure,
  recordRetry,
  recordRateLimitHit,
  updateDlqSize,
  getMetrics,
  getDashboardMetrics,
  resetMetrics,
  startPeriodicCleanup
};
