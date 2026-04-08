import { useState, useMemo } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import './SmartAlertsRedesign.css'

/**
 * SmartAlertsRedesign — Componente redesenhado de alertas inteligentes (Wave 15.1)
 * Exibe alertas com severidade (critical/warning/info) em ordem de prioridade
 * Suporta modo simple (max 2 visíveis) e complex (max 5 visíveis)
 *
 * @param {Object} props
 * @param {Array} props.alerts - Array de alertas: [{ id, severity, title, message, actions?, protocol_id? }]
 * @param {Function} props.onAction - Callback ao clicar em ação: (alert, action) => void
 * @param {Boolean} props.isComplex - Se true, exibe até 5 alertas; se false, máximo 2
 * @param {Function} props.onSnooze - Callback ao silenciar: (alertId) => void
 */
export default function SmartAlertsRedesign({
  alerts = [],
  onAction,
  isComplex = false,
  onSnooze,
}) {
  const [showAll, setShowAll] = useState(false)

  // States
  const maxVisible = isComplex ? 5 : 2

  // Memos — ordenação e filtragem
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  const sorted = useMemo(
    () => [...alerts].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]),
    [alerts]
  )
  const displayed = useMemo(
    () => (showAll ? sorted : sorted.slice(0, maxVisible)),
    [showAll, sorted, maxVisible]
  )
  const hasMore = sorted.length > maxVisible

  // Effects — nenhum necessário neste componente

  // Handlers
  const handleSnooze = (alertId) => {
    if (onSnooze) {
      onSnooze(alertId)
    }
  }

  const handleAction = (alert, action) => {
    if (onAction) {
      onAction(alert, action)
    }
  }

  // Render
  if (alerts.length === 0) {
    return null
  }

  const getIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle size={16} aria-hidden="true" />
      case 'warning':
        return <AlertCircle size={16} aria-hidden="true" />
      case 'info':
      default:
        return <Info size={16} aria-hidden="true" />
    }
  }

  return (
    <div className="smart-alerts-redesign" id="smart-alerts-list">
      {displayed.map((alert) => (
        <div
          key={alert.id}
          className={`smart-alert smart-alert--${alert.severity}`}
          role={alert.severity === 'critical' ? 'alert' : 'status'}
          aria-live={alert.severity === 'critical' ? 'assertive' : 'polite'}
        >
          <div className="smart-alert__header">
            {getIcon(alert.severity)}
            <span className="smart-alert__title">{alert.title}</span>
            {onSnooze && (
              <button
                className="smart-alert__snooze"
                onClick={() => handleSnooze(alert.id)}
                aria-label="Silenciar alerta"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="smart-alert__message">{alert.message}</p>
          {alert.actions && alert.actions.length > 0 && (
            <div className="smart-alert__actions">
              {alert.actions.map((action) => (
                <button
                  key={action.label}
                  className={`smart-alert__action smart-alert__action--${action.type || 'primary'}`}
                  onClick={() => handleAction(alert, action)}
                >
                  {action.label} →
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {hasMore && !showAll && (
        <button
          className="smart-alerts-redesign__expand"
          onClick={() => setShowAll(true)}
          aria-expanded="false"
          aria-controls="smart-alerts-list"
        >
          Ver todos ({sorted.length})
        </button>
      )}

      {hasMore && showAll && (
        <button
          className="smart-alerts-redesign__expand"
          onClick={() => setShowAll(false)}
          aria-expanded="true"
          aria-controls="smart-alerts-list"
        >
          Recolher
        </button>
      )}
    </div>
  )
}
