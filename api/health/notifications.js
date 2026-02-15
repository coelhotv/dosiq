// api/health/notifications.js
import { createLogger } from '../../server/bot/logger.js';
import { getMetrics } from '../../server/services/notificationMetrics.js';
import { getDLQStats } from '../../server/services/deadLetterQueue.js';

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
  const dlqStats = await getDLQStats();
  
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
  if (checks.dlqSize.value > HEALTH_THRESHOLDS.maxDlqSize) {
    checks.dlqSize.status = 'critical';
    checks.dlqSize.message = `DLQ com ${checks.dlqSize.value} notificações pendentes`;
  } else if (checks.dlqSize.value > HEALTH_THRESHOLDS.maxDlqSize / 2) {
    checks.dlqSize.status = 'warning';
    checks.dlqSize.message = `DLQ com ${checks.dlqSize.value} notificações`;
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
