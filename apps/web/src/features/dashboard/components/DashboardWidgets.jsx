import { useMemo } from 'react'
import StockAlertsWidget from './StockAlertsWidget'
import QuickActionsWidget from './QuickActionsWidget'
import './DashboardWidgets.css'

/**
 * DashboardWidgets - Container dos Widgets de Engajamento
 */
export default function DashboardWidgets({
  // Dados do dashboard
  stockSummary = [],
  // Callbacks de navegação
  onNavigate,
  onOpenLogModal,
}) {
  // Processar dados de estoque em memória (Onda 2: useMemo em vez de useEffect + useState)
  const { lowStockItems, outOfStockItems } = useMemo(() => {
    const lowStock = []
    const outOfStock = []

    stockSummary.forEach((item) => {
      const stockInfo = {
        medicineId: item.medicine.id,
        name: item.medicine.name,
        currentStock: item.total,
        minStock: Math.ceil((item.dailyIntake || 1) * 7), // 7 dias de estoque mínimo
        unit: item.medicine.dosage_unit || 'un',
        daysRemaining: item.daysRemaining,
      }

      if (item.total === 0) {
        outOfStock.push(stockInfo)
      } else if (item.isLow) {
        lowStock.push(stockInfo)
      }
    })

    // Ordenar: primeiro zerados, depois por dias restantes
    outOfStock.sort((a, b) => a.name.localeCompare(b.name))
    lowStock.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))

    return { lowStockItems: lowStock, outOfStockItems: outOfStock }
  }, [stockSummary])

  // Handlers de navegação
  const handleAddStock = (medicineId) => {
    if (medicineId) {
      onNavigate?.('stock', { medicineId })
    } else {
      onNavigate?.('stock')
    }
  }

  const handleViewStock = () => {
    onNavigate?.('stock')
  }

  const handleViewHistory = () => {
    onNavigate?.('history')
  }

  const handleViewProtocols = () => {
    onNavigate?.('protocols')
  }

  return (
    <div className="dashboard-widgets">
      {/* Quick Actions - Topo, largura total */}
      <div className="dashboard-widgets__row dashboard-widgets__row--full">
        <QuickActionsWidget
          onRegisterDose={onOpenLogModal}
          onAddStock={() => handleAddStock()}
          onViewHistory={handleViewHistory}
          onViewProtocols={handleViewProtocols}
        />
      </div>

      {/* Stock Alerts Widget */}
      <div className="dashboard-widgets__row dashboard-widgets__row--grid">
        <div className="dashboard-widgets__col dashboard-widgets__col--full">
          <StockAlertsWidget
            lowStockItems={lowStockItems}
            outOfStockItems={outOfStockItems}
            onAddStock={handleAddStock}
            onViewAll={handleViewStock}
          />
        </div>
      </div>
    </div>
  )
}
