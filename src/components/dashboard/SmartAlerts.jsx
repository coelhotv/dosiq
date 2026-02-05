import React from 'react';
import './SmartAlerts.css';

/**
 * SmartAlerts - Lista de alertas inteligentes com CTAs contextuais.
 * 
 * @param {Object} props
 * @param {Array} props.alerts - Lista de alertas
 * @param {Function} props.onAction - Callback para ações (TOMAR, ADIAR, COMPRAR)
 */
export default function SmartAlerts({ alerts = [], onAction }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="smart-alerts">
      {alerts.map((alert) => (
        <div 
          key={alert.id} 
          className={`smart-alert smart-alert--${alert.severity}`}
        >
          <div className="smart-alert__icon">
            {alert.severity === 'critical' ? '⚠️' : 'ℹ️'}
          </div>
          <div className="smart-alert__content">
            <h4 className="smart-alert__title">{alert.title}</h4>
            <p className="smart-alert__message">{alert.message}</p>
          </div>
          <div className="smart-alert__actions">
            {alert.actions?.map((action) => (
              <button
                key={action.label}
                className={`smart-alert__btn smart-alert__btn--${action.type}`}
                onClick={() => onAction?.(alert, action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
