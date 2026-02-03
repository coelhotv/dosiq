import { useState } from 'react'
import './StockAlertsWidget.css'

/**
 * StockAlertsWidget - Widget de Alertas de Estoque
 * 
 * Exibe medicamentos com estoque baixo ou zerado,
 * permitindo ação rápida de reposição.
 * 
 * Props:
 * - lowStockItems: [{ medicineId, name, currentStock, minStock, unit }]
 * - outOfStockItems: [{ medicineId, name, unit }]
 * - onAddStock: (medicineId) => void
 * - onViewAll: () => void
 */
export default function StockAlertsWidget({ 
  lowStockItems = [], 
  outOfStockItems = [],
  onAddStock,
  onViewAll
}) {
  const [expanded, setExpanded] = useState(false)
  
  const totalAlerts = lowStockItems.length + outOfStockItems.length
  const hasAlerts = totalAlerts > 0
  
  // Mostrar apenas os 3 primeiros itens quando não expandido
  const displayLimit = expanded ? Infinity : 3
  const allItems = [
    ...outOfStockItems.map(item => ({ ...item, type: 'out' })),
    ...lowStockItems.map(item => ({ ...item, type: 'low' }))
  ]
  const displayItems = allItems.slice(0, displayLimit)
  const hasMore = allItems.length > displayLimit

  if (!hasAlerts) {
    return (
      <div className="stock-alerts-widget stock-alerts--empty">
        <div className="stock-alerts__header">
          <div className="stock-alerts__icon">📦</div>
          <h3 className="stock-alerts__title">Estoque</h3>
        </div>
        <div className="stock-alerts__content">
          <div className="stock-alerts__empty-state">
            <span className="stock-alerts__empty-icon">✅</span>
            <p className="stock-alerts__empty-text">
              Todos os medicamentos com estoque adequado
            </p>
          </div>
        </div>
        <button className="stock-alerts__view-all" onClick={onViewAll}>
          Ver gerenciamento de estoque →
        </button>
      </div>
    )
  }

  return (
    <div className={`stock-alerts-widget ${hasAlerts ? 'stock-alerts--has-alerts' : ''}`}>
      <div className="stock-alerts__header">
        <div className="stock-alerts__icon-wrapper">
          <span className="stock-alerts__icon">⚠️</span>
          {totalAlerts > 0 && (
            <span className="stock-alerts__badge">{totalAlerts}</span>
          )}
        </div>
        <div className="stock-alerts__title-group">
          <h3 className="stock-alerts__title">Alertas de Estoque</h3>
          <span className="stock-alerts__subtitle">
            {outOfStockItems.length > 0 && (
              <span className="stock-alerts__urgent">
                {outOfStockItems.length} zerado{outOfStockItems.length > 1 ? 's' : ''}
              </span>
            )}
            {outOfStockItems.length > 0 && lowStockItems.length > 0 && ' • '}
            {lowStockItems.length > 0 && (
              <span className="stock-alerts__warning">
                {lowStockItems.length} baixo{lowStockItems.length > 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="stock-alerts__content">
        <div className="stock-alerts__list">
          {displayItems.map((item) => (
            <div 
              key={item.medicineId} 
              className={`stock-alerts__item stock-alerts__item--${item.type}`}
            >
              <div className="stock-alerts__item-status">
                {item.type === 'out' ? (
                  <span className="stock-alerts__status-badge stock-alerts__status--out">
                    ZERADO
                  </span>
                ) : (
                  <span className="stock-alerts__status-badge stock-alerts__status--low">
                    BAIXO
                  </span>
                )}
              </div>
              
              <div className="stock-alerts__item-info">
                <span className="stock-alerts__item-name">{item.name}</span>
                <span className="stock-alerts__item-stock">
                  {item.type === 'out' 
                    ? 'Sem estoque disponível'
                    : `${item.currentStock} ${item.unit || 'un'} restantes (mín: ${item.minStock})`
                  }
                </span>
              </div>

              <button 
                className="stock-alerts__add-btn"
                onClick={() => onAddStock?.(item.medicineId)}
                title="Adicionar estoque"
              >
                + Estoque
              </button>
            </div>
          ))}
        </div>

        {hasMore && (
          <button 
            className="stock-alerts__expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Ver menos ↑' : `Ver mais (${allItems.length - displayLimit}) ↓`}
          </button>
        )}
      </div>

      <button className="stock-alerts__view-all" onClick={onViewAll}>
        Gerenciar todos os estoques →
      </button>
    </div>
  )
}