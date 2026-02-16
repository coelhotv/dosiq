import AlertList from '../ui/AlertList'
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
  onViewAll,
}) {
  // Converter items para formato de alerta
  const alerts = [
    ...outOfStockItems.map((item) => ({
      id: `out-${item.medicineId}`,
      severity: 'critical',
      title: item.name,
      message: 'Sem estoque disponível',
      actions: [
        {
          label: '+ Estoque',
          type: 'primary',
          actionId: 'add-stock',
        },
      ],
      medicineId: item.medicineId,
    })),
    ...lowStockItems.map((item) => ({
      id: `low-${item.medicineId}`,
      severity: 'warning',
      title: item.name,
      message: `${item.currentStock} ${item.unit || 'un'} restantes (mín: ${item.minStock})`,
      actions: [
        {
          label: '+ Estoque',
          type: 'secondary',
          actionId: 'add-stock',
        },
      ],
      medicineId: item.medicineId,
    })),
  ]

  const handleAction = (alert, action) => {
    if (action.actionId === 'add-stock') {
      onAddStock?.(alert.medicineId)
    }
  }

  return (
    <AlertList
      alerts={alerts}
      onAction={handleAction}
      variant="stock"
      title="Alertas de Estoque"
      emptyIcon="📦"
      emptyMessage="Todos os medicamentos com estoque adequado"
      headerAction={
        <button className="stock-alerts__view-all" onClick={onViewAll}>
          Gerenciar estoques →
        </button>
      }
      showExpandButton={true}
      maxVisible={3}
    />
  )
}
