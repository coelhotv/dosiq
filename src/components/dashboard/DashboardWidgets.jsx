import { useState, useEffect } from 'react'
import StockAlertsWidget from './StockAlertsWidget'
import QuickActionsWidget from './QuickActionsWidget'
import NotificationStatsWidget from './NotificationStatsWidget'
import './DashboardWidgets.css'

/**
 * DashboardWidgets - Container dos Widgets de Engajamento
 *
 * Integra os widgets de engajamento do dashboard:
 * 1. QuickActionsWidget - Ações rápidas (topo)
 * 2. StockAlertsWidget - Alertas de estoque
 *
 * Nota: O AdherenceWidget agora é renderizado diretamente em Dashboard.jsx
 * via components/adherence/AdherenceWidget (única fonte de verdade)
 *
 * Responsável por:
 * - Buscar dados necessários para os widgets
 * - Gerenciar estado de carregamento
 * - Orquestrar navegação entre as ações
 * - Layout responsivo (grid desktop, 1 col mobile)
 */
export default function DashboardWidgets({
  // Dados do dashboard
  stockSummary = [],
  // Callbacks de navegação
  onNavigate,
  onOpenLogModal,
}) {
  const [lowStockItems, setLowStockItems] = useState([])
  const [outOfStockItems, setOutOfStockItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Processar dados de estoque
  useEffect(() => {
    const processStockData = () => {
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

      setLowStockItems(lowStock)
      setOutOfStockItems(outOfStock)
      setIsLoading(false)
    }

    processStockData()
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

  if (isLoading) {
    return (
      <div className="dashboard-widgets dashboard-widgets--loading">
        <div className="dashboard-widgets__spinner">⟳</div>
        <span>Carregando widgets...</span>
      </div>
    )
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

      {/* Notification Stats Widget */}
      <div className="dashboard-widgets__row dashboard-widgets__row--grid">
        <div className="dashboard-widgets__col dashboard-widgets__col--full">
          <NotificationStatsWidget />
        </div>
      </div>
    </div>
  )
}
