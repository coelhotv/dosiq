// src/components/dashboard/NotificationStatsWidget.jsx
import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import Loading from '../ui/Loading'
import './NotificationStatsWidget.css'

/**
 * Formata número com separador de milhares
 * @param {number} num - Número a formatar
 * @returns {string} Número formatado
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '-'
  return num.toLocaleString('pt-BR')
}

/**
 * Formata tempo em ms para display
 * @param {number} ms - Tempo em milissegundos
 * @returns {string} Tempo formatado
 */
function formatDuration(ms) {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Determina cor do status baseado na taxa de erro
 * @param {number} rate - Taxa de erro
 * @returns {string} Classe CSS
 */
function getErrorRateColor(rate) {
  if (rate < 1) return 'var(--color-success)'
  if (rate < 5) return 'var(--color-warning)'
  return 'var(--color-error)'
}

/**
 * Mensagem de status baseada no status da API
 * @param {string} status - Status geral da API ('healthy' | 'warning' | 'critical')
 * @param {object} checks - Checks individuais da API
 * @returns {string} Mensagem de status
 */
function getStatusMessage(status, checks) {
  if (status === 'critical') {
    const criticalCheck = Object.values(checks).find(c => c.status === 'critical')
    return criticalCheck?.message || '⚠️ Problema crítico detectado'
  }
  if (status === 'warning') {
    const warningCheck = Object.values(checks).find(c => c.status === 'warning')
    return warningCheck?.message || '⚡ Sistema operando com ressalvas'
  }
  return '✅ Sistema operando normalmente'
}

/**
 * Widget de estatísticas de notificações para o Dashboard
 */
export default function NotificationStatsWidget() {
  const [metrics, setMetrics] = useState(null)
  const [healthStatus, setHealthStatus] = useState('healthy')
  const [healthChecks, setHealthChecks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadMetrics()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      
      // Busca métricas do endpoint de health
      const response = await fetch('/api/health/notifications')
      if (!response.ok) {
        throw new Error('Falha ao carregar métricas')
      }
      
      const healthData = await response.json()
      
      // Transforma dados de health em formato do widget
      const data = {
        sentToday: healthData.metrics?.successful || 0,
        failed: healthData.metrics?.failed || 0,
        errorRate: healthData.metrics?.errorRate || 0,
        inDlq: healthData.checks?.dlqSize?.value || 0,
        avgDeliveryTime: healthData.metrics?.avgDeliveryTime || 0,
        lastSuccessfulSend: healthData.checks?.lastSuccessfulSend?.value
      }
      
      setMetrics(data)
      setHealthStatus(healthData.status || 'healthy')
      setHealthChecks(healthData.checks || {})
      setError(null)
    } catch (err) {
      console.error('Erro ao carregar métricas', err)
      setError('Falha ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !metrics) {
    return (
      <Card title="📊 Notificações" className="notification-stats-widget">
        <Loading size="small" message="Carregando..." />
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="📊 Notificações" className="notification-stats-widget">
        <div className="notification-stats__error">
          <span className="notification-stats__error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={loadMetrics} className="notification-stats__retry-btn">
            Tentar novamente
          </button>
        </div>
      </Card>
    )
  }

  const {
    sentToday = 0,
    failed = 0,
    errorRate = 0,
    inDlq = 0,
    avgDeliveryTime = 0,
    lastSuccessfulSend
  } = metrics || {}

  // Calcular tempo desde último envio
  const timeSinceLastSend = lastSuccessfulSend 
    ? Math.round((Date.now() - new Date(lastSuccessfulSend)) / (1000 * 60))
    : null

  return (
    <Card title="📊 Notificações" className="notification-stats-widget">
      <div className="notification-stats__grid">
        {/* Enviadas com sucesso */}
        <div className="notification-stats__item notification-stats__item--success">
          <div 
            className="notification-stats__value" 
            style={{ color: 'var(--color-success)' }}
          >
            {formatNumber(sentToday)}
          </div>
          <div className="notification-stats__label">Enviadas (hoje)</div>
        </div>

        {/* Falhas */}
        <div className="notification-stats__item notification-stats__item--error">
          <div 
            className="notification-stats__value" 
            style={{ color: 'var(--color-error)' }}
          >
            {formatNumber(failed)}
          </div>
          <div className="notification-stats__label">Falhas</div>
        </div>

        {/* Taxa de erro */}
        <div className="notification-stats__item">
          <div 
            className="notification-stats__value" 
            style={{ color: getErrorRateColor(errorRate) }}
          >
            {errorRate.toFixed(1)}%
          </div>
          <div className="notification-stats__label">Taxa de erro</div>
        </div>

        {/* DLQ */}
        <div className="notification-stats__item notification-stats__item--warning">
          <div 
            className="notification-stats__value"
            style={{ 
              color: inDlq > 50 ? 'var(--color-error)' 
                   : inDlq > 10 ? 'var(--color-warning)' 
                   : 'var(--color-success)' 
            }}
          >
            {formatNumber(inDlq)}
          </div>
          <div className="notification-stats__label">Na fila de retry</div>
        </div>

        {/* Tempo médio de entrega */}
        <div className="notification-stats__item">
          <div className="notification-stats__value">
            {formatDuration(avgDeliveryTime)}
          </div>
          <div className="notification-stats__label">Tempo médio</div>
        </div>

        {/* Último envio */}
        <div className="notification-stats__item">
          <div className="notification-stats__value">
            {timeSinceLastSend !== null 
              ? `${timeSinceLastSend}min` 
              : '-'}
          </div>
          <div className="notification-stats__label">Último envio</div>
        </div>
      </div>

      {/* Status geral */}
      <div className={`notification-stats__overall notification-stats__overall--${healthStatus}`}>
        {getStatusMessage(healthStatus, healthChecks)}
      </div>
    </Card>
  )
}
