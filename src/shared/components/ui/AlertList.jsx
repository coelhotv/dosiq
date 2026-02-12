import { useState } from 'react'
import './AlertList.css'

/**
 * AlertList - Componente base reutilizável para listas de alertas
 * 
 * Usado por SmartAlerts e StockAlertsWidget para padronizar UX.
 * 
 * @param {Object} props
 * @param {Array} props.alerts - Lista de alertas [{ id, severity, title, message, actions }]
 * @param {Function} props.onAction - Callback quando uma ação é clicada (alert, action)
 * @param {string} props.variant - Variante visual: 'default' | 'smart' | 'stock' | 'dose'
 * @param {boolean} props.showExpandButton - Mostrar botão expandir/colapsar
 * @param {number} props.maxVisible - Número máximo de alertas visíveis quando não expandido
 * @param {string} props.emptyIcon - Ícone para estado vazio
 * @param {string} props.emptyMessage - Mensagem para estado vazio
 * @param {string} props.title - Título opcional do alert list
 * @param {React.ReactNode} props.headerAction - Ação extra no header (ex: botão "Ver todos")
 */
export default function AlertList({
  alerts = [],
  onAction,
  variant = 'default',
  showExpandButton = true,
  maxVisible = 3,
  emptyIcon = '✅',
  emptyMessage = 'Nenhum alerta',
  title,
  headerAction
}) {
  const [expanded, setExpanded] = useState(false)
  
  const totalAlerts = alerts.length
  const hasAlerts = totalAlerts > 0
  const displayLimit = expanded ? Infinity : maxVisible
  const displayItems = alerts.slice(0, displayLimit)
  const hasMore = alerts.length > displayLimit

  // Estado vazio
  if (!hasAlerts) {
    return (
      <div className={`alert-list alert-list--empty alert-list--${variant}`}>
        {title && (
          <div className="alert-list__header">
            <h3 className="alert-list__title">{title}</h3>
            {headerAction}
          </div>
        )}
        <div className="alert-list__empty">
          <span className="alert-list__empty-icon">{emptyIcon}</span>
          <p className="alert-list__empty-message">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`alert-list alert-list--${variant}`}>
      {title && (
        <div className="alert-list__header">
          <div className="alert-list__title-group">
            <h3 className="alert-list__title">{title}</h3>
            {totalAlerts > 0 && (
              <span className="alert-list__badge">{totalAlerts}</span>
            )}
          </div>
          {headerAction}
        </div>
      )}

      <div className="alert-list__content">
        {displayItems.map((alert) => (
          <div 
            key={alert.id} 
            className={`alert-list__item alert-list__item--${alert.severity}`}
          >
            <div className="alert-list__item-icon">
              {alert.severity === 'critical' ? '⚠️' : 
               alert.severity === 'warning' ? '⚡' : 'ℹ️'}
            </div>
            
            <div className="alert-list__item-content">
              <h4 className="alert-list__item-title">{alert.title}</h4>
              <p className="alert-list__item-message">{alert.message}</p>
            </div>

            {alert.actions?.length > 0 && (
              <div className="alert-list__item-actions">
                {alert.actions.map((action) => (
                  <button
                    key={action.actionId || action.label}
                    className={`alert-list__btn alert-list__btn--${action.type}`}
                    title={action.title}
                    onClick={() => onAction?.(alert, action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showExpandButton && hasMore && (
        <button 
          className="alert-list__expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ver menos ↑' : `Ver mais (${alerts.length - displayLimit}) ↓`}
        </button>
      )}
    </div>
  )
}
