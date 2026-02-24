# Phase 2: Observability and Monitoring - Implementation Specification

> **Status:** Draft Specification  
> **Phase:** P2 - Observability/Monitoring  
> **Target:** Week 2-3  
> **Branch:** `feature/telegram-p2-monitoring`  
> **Depends on:** Phase 1 (P1) completed

---

## Table of Contents

1. [Metrics Overview](#a-metrics-overview)
2. [File-by-File Specifications](#b-file-by-file-specifications)
3. [Alerting Rules](#c-alerting-rules)
4. [Database Schema](#d-database-schema)
5. [Git Workflow](#e-git-workflow)
6. [Testing Strategy](#f-testing-strategy)

---

## A. Metrics Overview

### A.1 Metrics Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    P2 Metrics Collection Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Notification Flow:                                                        │
│   ┌─────────────┐                                                           │
│   │  Success    │ ──► recordSuccess() ──► In-Memory Map                     │
│   └─────────────┘                                                           │
│                                                                             │
│   ┌─────────────┐                                                           │
│   │  Failure    │ ──► recordFailure() ──► In-Memory Map                     │
│   └─────────────┘                                                           │
│                                                                             │
│   ┌─────────────┐                                                           │
│   │   Retry     │ ──► recordRetry() ──► In-Memory Map                       │
│   └─────────────┘                                                           │
│                                                                             │
│   In-Memory Metrics (notificationMetrics.js)                                │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  successCount: Map<minute, number>                                  │  │
│   │  failureCount: Map<minute, number>                                  │  │
│   │  retryCount: Map<minute, number>                                    │  │
│   │  deliveryTimes: Map<minute, number[]>                               │  │
│   │  errorBreakdown: Map<category, number>                              │  │
│   │  dlqSize: number                                                    │  │
│   │  lastSuccessfulSend: timestamp                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Health Check Endpoint (/api/health/notifications.js)                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  GET /api/health/notifications                                      │  │
│   │  ──► Retorna: queueSize, errorRate, lastSuccessfulSend              │  │
│   │  ──► Para: UptimeRobot, Pingdom, etc.                               │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Dashboard Widget (NotificationStatsWidget.jsx)                           │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  ──► Shows: sent today, failed, in DLQ                              │  │
│   │  ──► Uses: cachedServices para dados em tempo real                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.2 Metrics Collection Strategy

| Métrica | Tipo | Coleção | Armazenamento |
|---------|------|---------|---------------|
| Success/Failure Counts | Counter | In-memory, flush a cada 1min | In-Memory Map |
| Delivery Time | Histogram | In-memory, percentiles calculados | In-Memory Array |
| Retry Distribution | Counter | In-memory, por tentativa | In-Memory Map |
| Error Breakdown | Counter | In-memory, por categoria | In-Memory Map |
| DLQ Size | Gauge | Query Supabase a cada 5min | Supabase + Cache |
| Rate Limit Hits | Counter | In-memory | In-Memory Map |

---

## B. File-by-File Specifications

### B.1 New File: `server/services/notificationMetrics.js`

**Purpose:** Centralized metrics collection with in-memory storage.

**Location:** `server/services/notificationMetrics.js`

**Implementation:**

```javascript
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
```

**Key Design Decisions:**

1. **In-Memory Storage:** Fast, no external dependencies for metrics collection
2. **Time-Bucketed Keys:** Minute-level granularity for trend analysis
3. **Automatic Cleanup:** Prevents memory leaks from old data
4. **Percentile Calculations:** p50, p95, p99 for delivery time insights

---

### B.2 New File: `api/health/notifications.js`

**Purpose:** Health check endpoint for monitoring tools.

**Location:** `api/health/notifications.js`

**Implementation:**

```javascript
// api/health/notifications.js
import { createLogger } from '../../server/bot/logger.js';
import { getMetrics } from '../../server/services/notificationMetrics.js';
import { getStats as getDlqStats } from '../../server/services/deadLetterQueue.js';

const logger = createLogger('HealthNotifications');

/**
 * Thresholds para health checks
 */
const HEALTH_THRESHOLDS = {
  maxErrorRate: 5,           // 5% erro máximo
  maxDlqSize: 100,           // 100 notificações na DLQ
  maxMinutesSinceSuccess: 10, // 10 minutos sem sucesso
  maxRateLimitHitsPerHour: 10 // 10 rate limits por hora
};

/**
 * Verifica a saúde do sistema de notificações
 * @returns {object} Status de saúde
 */
async function checkHealth() {
  const metrics = getMetrics(5); // Últimos 5 minutos
  const dlqStats = await getDlqStats();
  
  const now = new Date();
  const checks = {
    errorRate: {
      status: 'healthy',
      value: metrics.summary.errorRate,
      threshold: HEALTH_THRESHOLDS.maxErrorRate,
      message: 'Taxa de erro dentro do limite'
    },
    dlqSize: {
      status: 'healthy',
      value: dlqStats.pending + dlqStats.retrying,
      threshold: HEALTH_THRESHOLDS.maxDlqSize,
      message: 'DLQ com tamanho adequado'
    },
    lastSuccessfulSend: {
      status: 'healthy',
      value: metrics.timestamps.lastSuccessfulSend,
      threshold: HEALTH_THRESHOLDS.maxMinutesSinceSuccess,
      message: 'Envios recentes detectados'
    },
    rateLimitHits: {
      status: 'healthy',
      value: metrics.summary.rateLimitHits,
      threshold: HEALTH_THRESHOLDS.maxRateLimitHitsPerHour,
      message: 'Rate limits dentro do esperado'
    }
  };
  
  // Verificar taxa de erro
  if (metrics.summary.errorRate > HEALTH_THRESHOLDS.maxErrorRate) {
    checks.errorRate.status = 'warning';
    checks.errorRate.message = `Taxa de erro alta: ${metrics.summary.errorRate.toFixed(1)}%`;
  }
  
  // Verificar DLQ
  const dlqPending = dlqStats.pending + dlqStats.retrying;
  if (dlqPending > HEALTH_THRESHOLDS.maxDlqSize) {
    checks.dlqSize.status = 'critical';
    checks.dlqSize.message = `DLQ com ${dlqPending} notificações pendentes`;
  } else if (dlqPending > HEALTH_THRESHOLDS.maxDlqSize / 2) {
    checks.dlqSize.status = 'warning';
    checks.dlqSize.message = `DLQ com ${dlqPending} notificações`;
  }
  
  // Verificar último envio bem-sucedido
  if (metrics.timestamps.lastSuccessfulSend) {
    const lastSuccess = new Date(metrics.timestamps.lastSuccessfulSend);
    const minutesSinceSuccess = (now - lastSuccess) / (1000 * 60);
    
    if (minutesSinceSuccess > HEALTH_THRESHOLDS.maxMinutesSinceSuccess) {
      checks.lastSuccessfulSend.status = 'critical';
      checks.lastSuccessfulSend.message = `Sem envios há ${Math.round(minutesSinceSuccess)} minutos`;
    } else if (minutesSinceSuccess > HEALTH_THRESHOLDS.maxMinutesSinceSuccess / 2) {
      checks.lastSuccessfulSend.status = 'warning';
      checks.lastSuccessfulSend.message = `Último envio há ${Math.round(minutesSinceSuccess)} minutos`;
    }
    checks.lastSuccessfulSend.minutesSince = Math.round(minutesSinceSuccess);
  } else {
    checks.lastSuccessfulSend.status = 'unknown';
    checks.lastSuccessfulSend.message = 'Nenhum envio registrado no período';
  }
  
  // Verificar rate limits
  if (metrics.summary.rateLimitHits > HEALTH_THRESHOLDS.maxRateLimitHitsPerHour) {
    checks.rateLimitHits.status = 'warning';
    checks.rateLimitHits.message = `${metrics.summary.rateLimitHits} rate limits no período`;
  }
  
  // Determinar status geral
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus = 'healthy';
  
  if (statuses.includes('critical')) {
    overallStatus = 'critical';
  } else if (statuses.includes('warning')) {
    overallStatus = 'warning';
  }
  
  return {
    status: overallStatus,
    timestamp: now.toISOString(),
    checks,
    metrics: {
      totalAttempts: metrics.summary.totalAttempts,
      successful: metrics.summary.successful,
      failed: metrics.summary.failed,
      errorRate: metrics.summary.errorRate,
      avgDeliveryTime: metrics.deliveryTime.avg
    }
  };
}

/**
 * Handler da API de health check
 */
export default async function handler(req, res) {
  // Apenas GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['GET']
    });
  }
  
  logger.debug('Health check request', {
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  });
  
  try {
    const health = await checkHealth();
    
    // Status HTTP baseado no health
    const statusCode = health.status === 'critical' ? 503 
                     : health.status === 'warning' ? 200 
                     : 200;
    
    // Headers para monitoramento
    res.setHeader('X-Health-Status', health.status);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

**Usage with Monitoring Tools:**

```bash
# UptimeRobot / Pingdom
curl https://meus-remedios.vercel.app/api/health/notifications

# Response when healthy
{
  "status": "healthy",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "checks": {
    "errorRate": { "status": "healthy", "value": 0.5, "threshold": 5 },
    "dlqSize": { "status": "healthy", "value": 3, "threshold": 100 },
    "lastSuccessfulSend": { "status": "healthy", ... },
    "rateLimitHits": { "status": "healthy", "value": 0, "threshold": 10 }
  },
  "metrics": { "totalAttempts": 200, "successful": 199, "failed": 1, ... }
}

# Response when critical (HTTP 503)
{
  "status": "critical",
  "checks": {
    "dlqSize": { "status": "critical", "value": 150, "threshold": 100, ... }
  }
}
```

---

### B.3 New File: `src/components/dashboard/NotificationStatsWidget.jsx`

**Purpose:** Dashboard widget showing notification statistics.

**Location:** `src/components/dashboard/NotificationStatsWidget.jsx`

**Implementation:**

```javascript
// src/components/dashboard/NotificationStatsWidget.jsx
import { useState, useEffect } from 'react';
import { createLogger } from '../../../server/bot/logger.js';
import Card from '../../shared/components/ui/Card';
import Loading from '../../shared/components/ui/Loading';
import { getDashboardMetrics } from '../../../server/services/notificationMetrics.js';

const logger = createLogger('NotificationStatsWidget');

/**
 * Formata número com separador de milhares
 * @param {number} num - Número a formatar
 * @returns {string} Número formatado
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('pt-BR');
}

/**
 * Formata tempo em ms para display
 * @param {number} ms - Tempo em milissegundos
 * @returns {string} Tempo formatado
 */
function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Determina cor do status baseado na taxa de erro
 * @param {number} rate - Taxa de erro
 * @returns {string} Classe CSS
 */
function getErrorRateColor(rate) {
  if (rate < 1) return 'var(--color-success)';
  if (rate < 5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

/**
 * Widget de estatísticas de notificações para o Dashboard
 */
export default function NotificationStatsWidget() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMetrics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Em produção, isso viria de uma API
      // Por enquanto, usamos o service diretamente (server-side)
      // ou fazemos fetch para um endpoint
      const data = getDashboardMetrics();
      
      setMetrics(data);
      setError(null);
    } catch (err) {
      logger.error('Erro ao carregar métricas', err);
      setError('Falha ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <Card title="📊 Notificações" className="notification-stats-widget">
        <Loading size="small" message="Carregando..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="📊 Notificações" className="notification-stats-widget">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={loadMetrics}>Tentar novamente</button>
        </div>
      </Card>
    );
  }

  const {
    sentToday = 0,
    failed = 0,
    errorRate = 0,
    inDlq = 0,
    avgDeliveryTime = 0,
    lastSuccessfulSend
  } = metrics || {};

  // Calcular tempo desde último envio
  const timeSinceLastSend = lastSuccessfulSend 
    ? Math.round((Date.now() - new Date(lastSuccessfulSend)) / (1000 * 60))
    : null;

  return (
    <Card title="📊 Notificações" className="notification-stats-widget">
      <div className="stats-grid">
        {/* Enviadas com sucesso */}
        <div className="stat-item success">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatNumber(sentToday)}
          </div>
          <div className="stat-label">Enviadas (hoje)</div>
        </div>

        {/* Falhas */}
        <div className="stat-item error">
          <div className="stat-value" style={{ color: 'var(--color-error)' }}>
            {formatNumber(failed)}
          </div>
          <div className="stat-label">Falhas</div>
        </div>

        {/* Taxa de erro */}
        <div className="stat-item">
          <div 
            className="stat-value" 
            style={{ color: getErrorRateColor(errorRate) }}
          >
            {errorRate.toFixed(1)}%
          </div>
          <div className="stat-label">Taxa de erro</div>
        </div>

        {/* DLQ */}
        <div className="stat-item warning">
          <div 
            className="stat-value"
            style={{ 
              color: inDlq > 50 ? 'var(--color-error)' 
                   : inDlq > 10 ? 'var(--color-warning)' 
                   : 'var(--color-success)' 
            }}
          >
            {formatNumber(inDlq)}
          </div>
          <div className="stat-label">Na fila de retry</div>
        </div>

        {/* Tempo médio de entrega */}
        <div className="stat-item">
          <div className="stat-value">
            {formatDuration(avgDeliveryTime)}
          </div>
          <div className="stat-label">Tempo médio</div>
        </div>

        {/* Último envio */}
        <div className="stat-item">
          <div className="stat-value">
            {timeSinceLastSend !== null 
              ? `${timeSinceLastSend}min` 
              : '-'}
          </div>
          <div className="stat-label">Último envio</div>
        </div>
      </div>

      {/* Status geral */}
      <div className={`overall-status ${getOverallStatus(errorRate, inDlq, timeSinceLastSend)}`}>
        {getStatusMessage(errorRate, inDlq, timeSinceLastSend)}
      </div>
    </Card>
  );
}

/**
 * Determina status geral do sistema
 */
function getOverallStatus(errorRate, dlqSize, timeSinceLastSend) {
  if (errorRate > 5 || dlqSize > 50 || (timeSinceLastSend && timeSinceLastSend > 10)) {
    return 'critical';
  }
  if (errorRate > 1 || dlqSize > 10 || (timeSinceLastSend && timeSinceLastSend > 5)) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Mensagem de status
 */
function getStatusMessage(errorRate, dlqSize, timeSinceLastSend) {
  if (errorRate > 5) return '⚠️ Taxa de erro alta - investigar';
  if (dlqSize > 50) return '⚠️ Muitas notificações na fila';
  if (timeSinceLastSend && timeSinceLastSend > 10) return '⚠️ Sem envios recentes';
  if (errorRate > 1 || dlqSize > 10) return '⚡ Sistema operando com ressalvas';
  return '✅ Sistema operando normalmente';
}
```

**CSS (NotificationStatsWidget.css):**

```css
.notification-stats-widget {
  padding: var(--spacing-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.stat-item {
  text-align: center;
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-xs);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.overall-status {
  text-align: center;
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-md);
  font-size: 0.875rem;
  font-weight: 500;
}

.overall-status.healthy {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.overall-status.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.overall-status.critical {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.error-state {
  text-align: center;
  padding: var(--spacing-lg);
}

.error-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: var(--spacing-sm);
}
```

---

### B.4 Modified: Integration Points

**Update `server/bot/tasks.js` to record metrics:**

```javascript
// Add to imports in tasks.js
import { 
  recordSuccess, 
  recordFailure, 
  recordRetry 
} from '../services/notificationMetrics.js';

// Modify checkUserReminders to record metrics
async function checkUserReminders(bot, userId, chatId) {
  // ... existing code ...
  
  const notificationResult = await sendDoseNotification(bot, chatId, p, currentHHMM);

  if (!notificationResult.success) {
    // Record failure metric
    recordFailure(
      notificationResult.error?.code || 'unknown',
      notificationResult.error?.retryable || false,
      {
        userId,
        protocolId: p.id,
        notificationType: 'dose_reminder'
      }
    );
    
    await handleNotificationFailure(notificationResult, { ... });
    continue;
  }

  // Record retry metric if applicable
  if (notificationResult.retried) {
    recordRetry(notificationResult.attempts, {
      userId,
      protocolId: p.id
    });
  }

  // Record success metric
  recordSuccess(null, {
    userId,
    protocolId: p.id,
    notificationType: 'dose_reminder',
    attempts: notificationResult.attempts
  });
  
  // ... rest of existing code ...
}
```

**Update `server/services/deadLetterQueue.js` to update DLQ size:**

```javascript
// Add to imports
import { updateDlqSize } from './notificationMetrics.js';

// Modify enqueue to update metrics
export async function enqueue(notificationData, error, retryCount, correlationId) {
  // ... existing code ...
  
  // After successful enqueue, update metrics
  const stats = await getStats();
  updateDlqSize(stats.pending + stats.retrying);
  
  return { success: true, id: data.id };
}
```

---

## C. Alerting Rules

### C.1 Alerting Configuration

| Alerta | Condição | Severidade | Ação |
|--------|----------|------------|------|
| High Error Rate | `error_rate > 5%` em 5 min | 🔴 Critical | PagerDuty / Email |
| DLQ Overflow | `dlq_size > 100` | 🔴 Critical | PagerDuty / Email |
| No Success | `last_successful_send > 10 min` | 🔴 Critical | PagerDuty / Email |
| Rate Limit Spike | `rate_limit_hits > 10/hour` | 🟡 Warning | Email |
| High Error Trend | `error_rate > 1%` em 15 min | 🟡 Warning | Slack |
| DLQ Growing | `dlq_size > 50` e crescendo | 🟡 Warning | Slack |

### C.2 Alerting Implementation (Vercel + External)

Since Vercel doesn't have built-in alerting, use external services:

```javascript
// server/services/alertingService.js
import { createLogger } from '../bot/logger.js';

const logger = createLogger('Alerting');

const ALERT_WEBHOOKS = {
  critical: process.env.ALERT_CRITICAL_WEBHOOK,    // PagerDuty/Opsgenie
  warning: process.env.ALERT_WARNING_WEBHOOK,      // Slack/Discord
  info: process.env.ALERT_INFO_WEBHOOK             // Slack #alerts
};

/**
 * Envia alerta para webhook configurado
 * @param {string} level - Nível do alerta (critical, warning, info)
 * @param {string} title - Título do alerta
 * @param {string} message - Mensagem detalhada
 * @param {object} data - Dados adicionais
 */
export async function sendAlert(level, title, message, data = {}) {
  const webhook = ALERT_WEBHOOKS[level];
  
  if (!webhook) {
    logger.warn(`Webhook não configurado para alerta ${level}`, { title });
    return { success: false, reason: 'no_webhook' };
  }
  
  const payload = {
    level,
    title,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    logger.info(`Alerta ${level} enviado`, { title });
    return { success: true };
    
  } catch (error) {
    logger.error(`Falha ao enviar alerta ${level}`, error, { title });
    return { success: false, error: error.message };
  }
}

/**
 * Verifica condições de alerta baseado nas métricas
 * @param {object} metrics - Métricas atuais
 */
export async function checkAlertConditions(metrics) {
  const alerts = [];
  
  // Alerta: Taxa de erro alta
  if (metrics.summary.errorRate > 5) {
    alerts.push(sendAlert(
      'critical',
      'Taxa de erro crítica',
      `Taxa de erro de ${metrics.summary.errorRate.toFixed(1)}% nos últimos 5 minutos`,
      { errorRate: metrics.summary.errorRate }
    ));
  }
  
  // Alerta: DLQ grande
  if (metrics.dlq.currentSize > 100) {
    alerts.push(sendAlert(
      'critical',
      'DLQ Overflow',
      `${metrics.dlq.currentSize} notificações na fila de retry`,
      { dlqSize: metrics.dlq.currentSize }
    ));
  }
  
  // Alerta: Sem envios recentes
  if (metrics.timestamps.lastSuccessfulSend) {
    const minutesSince = (Date.now() - new Date(metrics.timestamps.lastSuccessfulSend)) / (1000 * 60);
    if (minutesSince > 10) {
      alerts.push(sendAlert(
        'critical',
        'Sem envios de notificações',
        `Nenhuma notificação enviada há ${Math.round(minutesSince)} minutos`,
        { minutesSince }
      ));
    }
  }
  
  // Alerta: Rate limits
  if (metrics.summary.rateLimitHits > 10) {
    alerts.push(sendAlert(
      'warning',
      'Rate limit spike',
      `${metrics.summary.rateLimitHits} rate limits no período`,
      { rateLimitHits: metrics.summary.rateLimitHits }
    ));
  }
  
  return Promise.all(alerts);
}
```

### C.3 Cron Job for Alerting

```javascript
// api/alerts/check.js
import { getMetrics } from '../../server/services/notificationMetrics.js';
import { checkAlertConditions } from '../../server/services/alertingService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Verificar autorização
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const metrics = getMetrics(5);
  const results = await checkAlertConditions(metrics);
  
  res.status(200).json({
    checked: results.length,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
}
```

**Configure on cron-job.org:**
- URL: `https://meus-remedios.vercel.app/api/alerts/check`
- Schedule: Every 5 minutes
- Method: POST
- Headers: `Authorization: Bearer ${CRON_SECRET}`

---

## D. Database Schema

### D.1 Optional: Historical Metrics Table

```sql
-- Migração: Tabela de métricas históricas (opcional para P2)
-- Criação: 2026-02-15
-- Fase: P2 - Observability

CREATE TABLE IF NOT EXISTS metricas_notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Período
    periodo_inicio TIMESTAMPTZ NOT NULL,
    periodo_fim TIMESTAMPTZ NOT NULL,
    duracao_minutos INTEGER NOT NULL DEFAULT 5,
    
    -- Contagens
    total_tentativas INTEGER DEFAULT 0,
    sucessos INTEGER DEFAULT 0,
    falhas INTEGER DEFAULT 0,
    retries INTEGER DEFAULT 0,
    rate_limit_hits INTEGER DEFAULT 0,
    
    -- Tempos de entrega (em ms)
    tempo_entrega_medio INTEGER,
    tempo_entrega_p50 INTEGER,
    tempo_entrega_p95 INTEGER,
    tempo_entrega_p99 INTEGER,
    
    -- Breakdown de erros (JSON)
    erro_breakdown JSONB DEFAULT '{}',
    
    -- DLQ no momento
    dlq_size INTEGER DEFAULT 0,
    
    -- Timestamps
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_metricas_periodo 
    ON metricas_notificacoes(periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_metricas_criado 
    ON metricas_notificacoes(criado_em DESC);

-- Comentários
COMMENT ON TABLE metricas_notificacoes IS 'Métricas históricas de notificações (P2)';
COMMENT ON COLUMN metricas_notificacoes.erro_breakdown IS 'Contagem por categoria de erro em JSON';

-- Política RLS (service_role apenas)
ALTER TABLE metricas_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role pode gerenciar métricas"
    ON metricas_notificacoes
    FOR ALL
    TO service_role
    USING (true);

-- Função para inserir métricas (chamada pelo cron)
CREATE OR REPLACE FUNCTION inserir_metricas_notificacoes(
    p_periodo_inicio TIMESTAMPTZ,
    p_periodo_fim TIMESTAMPTZ,
    p_tentativas INTEGER,
    p_sucessos INTEGER,
    p_falhas INTEGER,
    p_retries INTEGER,
    p_rate_limits INTEGER,
    p_tempo_medio INTEGER,
    p_erro_breakdown JSONB,
    p_dlq_size INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO metricas_notificacoes (
        periodo_inicio,
        periodo_fim,
        duracao_minutos,
        total_tentativas,
        sucessos,
        falhas,
        retries,
        rate_limit_hits,
        tempo_entrega_medio,
        erro_breakdown,
        dlq_size
    ) VALUES (
        p_periodo_inicio,
        p_periodo_fim,
        EXTRACT(EPOCH FROM (p_periodo_fim - p_periodo_inicio)) / 60,
        p_tentativas,
        p_sucessos,
        p_falhas,
        p_retries,
        p_rate_limits,
        p_tempo_medio,
        p_erro_breakdown,
        p_dlq_size
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```

---

## E. Git Workflow

### E.1 Branch and Commits

```bash
# 1. Create branch from main (after P1 merged)
git checkout main
git pull origin main
git checkout -b feature/telegram-p2-monitoring

# 2. Implementation commits (atomic)
git add server/services/notificationMetrics.js
git commit -m "feat(services): adiciona notificationMetrics para coleta de métricas"

git add api/health/notifications.js
git commit -m "feat(api): adiciona endpoint de health check para notificações"

git add server/services/alertingService.js api/alerts/check.js
git commit -m "feat(services): adiciona sistema de alertas para notificações"

git add src/components/dashboard/NotificationStatsWidget.jsx
git commit -m "feat(dashboard): adiciona widget de estatísticas de notificações"

git add server/bot/tasks.js server/services/deadLetterQueue.js
git commit -m "feat(bot): integra métricas no fluxo de notificações"

git add .migrations/add_notification_metrics.sql
git commit -m "feat(db): adiciona tabela de métricas históricas (opcional)"

# 3. Validation
npm run lint
npm run test:critical
npm run build

# 4. Push and create PR
git push origin feature/telegram-p2-monitoring
gh pr create --title "feat(bot): adiciona métricas e monitoramento de notificações" \
             --body-file pr_description_p2.md
```

### E.2 PR Template (Filled Example)

```markdown
# Phase 2: Observability and Monitoring

## 🎯 Resumo

Esta PR implementa o Phase 2 (P2) do sistema de notificações Telegram:
- Coleta de métricas em tempo real
- Health check endpoint
- Sistema de alertas
- Dashboard widget

---

## 📋 Tarefas Implementadas

### ✅ Metrics Collection
- [x] In-memory metrics store com Map
- [x] recordSuccess(), recordFailure(), recordRetry()
- [x] Delivery time tracking (p50, p95, p99)
- [x] Error breakdown por categoria
- [x] Rate limit tracking
- [x] DLQ size monitoring

### ✅ Health Check Endpoint
- [x] GET /api/health/notifications
- [x] Verifica: errorRate, dlqSize, lastSuccess, rateLimits
- [x] Status: healthy/warning/critical
- [x] Headers para monitoramento

### ✅ Alerting System
- [x] Alert rules configuration
- [x] Webhook integration (PagerDuty, Slack)
- [x] Alert levels: critical, warning, info
- [x] Cron job para verificação periódica

### ✅ Dashboard Widget
- [x] NotificationStatsWidget component
- [x] Real-time metrics display
- [x] Auto-refresh a cada 30s
- [x] Status indicators

### ✅ Integration
- [x] Metrics recording in tasks.js
- [x] DLQ size updates
- [x] Migration para métricas históricas

---

## 📊 Métricas Disponíveis

| Métrica | Fonte | Granularidade |
|---------|-------|---------------|
| Total Attempts | In-Memory | Por minuto |
| Success/Failure | In-Memory | Por minuto |
| Error Rate | Calculado | Últimos 5 min |
| Avg Delivery Time | In-Memory | Últimos 5 min |
| DLQ Size | Supabase | Real-time |
| Rate Limit Hits | In-Memory | Por hora |

---

## 🔧 Arquivos Principais

```
server/
├── services/
│   ├── notificationMetrics.js    # Métricas em tempo real
│   ├── alertingService.js        # Sistema de alertas
│   └── deadLetterQueue.js        # Atualizado para métricas
├── bot/
│   └── tasks.js                  # Integração de métricas

api/
├── health/
│   └── notifications.js          # Health check endpoint
└── alerts/
    └── check.js                  # Cron de verificação

src/
└── components/
    └── dashboard/
        └── NotificationStatsWidget.jsx

.migrations/
└── add_notification_metrics.sql  # Tabela histórica (opcional)
```

---

## 🧪 Testes

```bash
# Unit tests
npm run test:critical
# Esperado: 149+ tests pass

# Novos testes:
# - notificationMetrics.test.js
# - health/notifications.test.js
# - alertingService.test.js
```

---

## ✅ Checklist de Verificação

### Código
- [x] Todos os testes passam (`npm run test:critical`)
- [x] Lint sem erros (`npm run lint`)
- [x] Build bem-sucedido (`npm run build`)
- [x] React hook order correto nos componentes

### Funcional
- [x] Métricas são coletadas em todas as notificações
- [x] Health endpoint responde corretamente
- [x] Widget atualiza automaticamente
- [x] Alertas são enviados quando thresholds atingidos

### Monitoramento
- [x] Health check configurado no UptimeRobot
- [x] Webhooks de alerta configurados
- [x] Cron-job configurado para /api/alerts/check

---

## 🚀 Deploy

1. Deploy Vercel: `vercel --prod`
2. Configurar cron-job.org para `/api/alerts/check` (5 min)
3. Configurar UptimeRobot para `/api/health/notifications`
4. Configurar webhooks de alerta (Slack/PagerDuty)
5. Verificar dashboard widget

---

## 📝 Notas

- Métricas são mantidas em memória (60 min window)
- Tabela histórica é opcional para análise long-term
- Sem breaking changes na API
- P2 depende de P1 (retry/dlq) estar merged
```

---

## F. Testing Strategy

### F.1 Unit Tests for Metrics

```javascript
// server/services/__tests__/notificationMetrics.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordSuccess,
  recordFailure,
  recordRetry,
  getMetrics,
  getDashboardMetrics,
  resetMetrics
} from '../notificationMetrics.js';

describe('notificationMetrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordSuccess', () => {
    it('should increment success count', () => {
      recordSuccess();
      recordSuccess();
      
      const metrics = getMetrics(5);
      expect(metrics.summary.successful).toBe(2);
    });

    it('should track delivery time', () => {
      recordSuccess(1500);
      recordSuccess(2500);
      
      const metrics = getMetrics(5);
      expect(metrics.deliveryTime.count).toBe(2);
      expect(metrics.deliveryTime.avg).toBe(2000);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        recordSuccess(i * 10); // 10, 20, 30... 1000
      }
      
      const metrics = getMetrics(5);
      expect(metrics.deliveryTime.p50).toBe(500);
      expect(metrics.deliveryTime.p95).toBe(950);
      expect(metrics.deliveryTime.p99).toBe(990);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      recordFailure('network_error', true);
      recordFailure('rate_limit', true);
      
      const metrics = getMetrics(5);
      expect(metrics.summary.failed).toBe(2);
    });

    it('should track error breakdown', () => {
      recordFailure('network_error', true);
      recordFailure('network_error', true);
      recordFailure('invalid_chat', false);
      
      const metrics = getMetrics(5);
      expect(metrics.errorBreakdown['network_error_retryable']).toBe(2);
      expect(metrics.errorBreakdown['invalid_chat_final']).toBe(1);
    });
  });

  describe('recordRetry', () => {
    it('should track retry attempts', () => {
      recordRetry(1);
      recordRetry(2);
      recordRetry(2);
      
      const metrics = getMetrics(5);
      expect(metrics.summary.retried).toBe(3);
      expect(metrics.errorBreakdown['attempt_1']).toBe(1);
      expect(metrics.errorBreakdown['attempt_2']).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should calculate error rate correctly', () => {
      recordSuccess();
      recordSuccess();
      recordFailure('network', true);
      
      const metrics = getMetrics(5);
      expect(metrics.summary.errorRate).toBeCloseTo(33.33, 1);
    });

    it('should handle empty metrics', () => {
      const metrics = getMetrics(5);
      
      expect(metrics.summary.totalAttempts).toBe(0);
      expect(metrics.summary.errorRate).toBe(0);
      expect(metrics.deliveryTime.avg).toBe(0);
    });
  });

  describe('time windowing', () => {
    it('should only return metrics within window', () => {
      // Este teste requer mock de tempo
      // Simplificado para exemplo
      recordSuccess();
      
      const metrics = getMetrics(1); // 1 min window
      expect(metrics.summary.successful).toBe(1);
    });
  });
});
```

### F.2 Health Check Tests

```javascript
// api/health/__tests__/notifications.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../notifications.js';
import { getMetrics } from '../../../server/services/notificationMetrics.js';
import { getStats } from '../../../server/services/deadLetterQueue.js';

vi.mock('../../../server/services/notificationMetrics.js');
vi.mock('../../../server/services/deadLetterQueue.js');

describe('/api/health/notifications', () => {
  const createReq = (method = 'GET') => ({ method });
  const createRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.setHeader = vi.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 405 for non-GET methods', async () => {
    const req = createReq('POST');
    const res = createRes();
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('should return healthy status when all checks pass', async () => {
    getMetrics.mockReturnValue({
      summary: { errorRate: 0.5, totalAttempts: 100, successful: 99, failed: 1 },
      timestamps: { lastSuccessfulSend: new Date().toISOString() }
    });
    getStats.mockResolvedValue({ pending: 5, retrying: 0 });
    
    const req = createReq();
    const res = createRes();
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        checks: expect.objectContaining({
          errorRate: expect.objectContaining({ status: 'healthy' }),
          dlqSize: expect.objectContaining({ status: 'healthy' })
        })
      })
    );
  });

  it('should return critical when error rate is high', async () => {
    getMetrics.mockReturnValue({
      summary: { errorRate: 10, totalAttempts: 100, successful: 90, failed: 10 },
      timestamps: { lastSuccessfulSend: new Date().toISOString() }
    });
    getStats.mockResolvedValue({ pending: 5, retrying: 0 });
    
    const req = createReq();
    const res = createRes();
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'critical',
        checks: expect.objectContaining({
          errorRate: expect.objectContaining({ 
            status: 'warning',
            value: 10 
          })
        })
      })
    );
  });

  it('should set X-Health-Status header', async () => {
    getMetrics.mockReturnValue({
      summary: { errorRate: 0, totalAttempts: 10, successful: 10, failed: 0 },
      timestamps: { lastSuccessfulSend: new Date().toISOString() }
    });
    getStats.mockResolvedValue({ pending: 0, retrying: 0 });
    
    const req = createReq();
    const res = createRes();
    
    await handler(req, res);
    
    expect(res.setHeader).toHaveBeenCalledWith('X-Health-Status', 'healthy');
  });
});
```

### F.3 Integration Test for Full Flow

```javascript
// tests/integration/p1-p2-integration.test.js
import { describe, it, expect, vi } from 'vitest';

describe('P1 + P2 Integration', () => {
  it('should record metrics for successful retry', async () => {
    // Simular fluxo completo: falha → retry → sucesso → métricas
    const { sendWithRetry } = await import('../../server/bot/retryManager.js');
    const { recordSuccess, recordRetry, getMetrics } = await import(
      '../../server/services/notificationMetrics.js'
    );
    
    // Mock que falha uma vez, depois sucede
    let attempts = 0;
    const mockSend = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.resolve({
          success: false,
          error: { code: 'ETIMEDOUT', retryable: true }
        });
      }
      return Promise.resolve({ success: true, messageId: 'msg-123' });
    });
    
    // Executar com retry
    const result = await sendWithRetry(
      mockSend,
      { userId: 'u1' },
      { maxRetries: 2, baseDelay: 100 }
    );
    
    // Registrar métricas (como faria tasks.js)
    if (result.success) {
      if (result.retried) {
        recordRetry(result.attempts);
      }
      recordSuccess();
    }
    
    // Verificar métricas
    const metrics = getMetrics(5);
    expect(result.success).toBe(true);
    expect(result.retried).toBe(true);
    expect(metrics.summary.successful).toBe(1);
    expect(metrics.summary.retried).toBe(1);
  });

  it('should record metrics for DLQ after max retries', async () => {
    const { sendWithRetry } = await import('../../server/bot/retryManager.js');
    const { recordFailure, getMetrics } = await import(
      '../../server/services/notificationMetrics.js'
    );
    const { enqueue } = await import('../../server/services/deadLetterQueue.js');
    
    vi.mocked(enqueue).mockResolvedValue({ success: true, id: 'dlq-123' });
    
    const mockSend = vi.fn().mockResolvedValue({
      success: false,
      error: { code: 'ETIMEDOUT', retryable: true }
    });
    
    const result = await sendWithRetry(
      mockSend,
      { userId: 'u1' },
      { maxRetries: 2 }
    );
    
    // Simular envio para DLQ e registro de falha
    recordFailure('network_error', true);
    
    const metrics = getMetrics(5);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(metrics.summary.failed).toBe(1);
    expect(metrics.errorBreakdown['network_error_retryable']).toBe(1);
  });
});
```

---

## Summary

This specification provides:

1. **Metrics Collection** with in-memory store and automatic cleanup
2. **Health Check Endpoint** with status levels and thresholds
3. **Alerting System** with webhook integration and configurable rules
4. **Dashboard Widget** for real-time visibility
5. **Database schema** for historical metrics (optional)
6. **Complete testing** with unit and integration tests
7. **Git workflow** with filled PR template

The P2 implementation builds on P1 to provide observability into the notification system's health and performance.

---

## Dependencies Between P1 and P2

| P1 Component | Used by P2 | Impact if P1 missing |
|--------------|------------|---------------------|
| `sendWithRetry()` | Metrics recording | Cannot track retry metrics |
| `DLQ Service` | DLQ size metrics | Cannot track DLQ metrics |
| `Error Categories` | Error breakdown | Generic error tracking only |
| `Correlation ID` | Full tracing | Partial traceability |

**Recommended Order:**
1. Merge P1 first (retry/dlq foundation)
2. Wait for P1 to stabilize in production
3. Implement P2 on top of stable P1
4. P2 can be implemented incrementally (metrics → health → alerting → widget)
