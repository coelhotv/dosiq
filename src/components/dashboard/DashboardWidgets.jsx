import { useState, useEffect } from 'react'
import AdherenceWidget from './AdherenceWidget'
import StockAlertsWidget from './StockAlertsWidget'
import QuickActionsWidget from './QuickActionsWidget'
import './DashboardWidgets.css'

/**
 * DashboardWidgets - Container dos Widgets de Engajamento
 * 
 * Integra os 3 widgets de engajamento do dashboard:
 * 1. QuickActionsWidget - Ações rápidas (topo)
 * 2. AdherenceWidget - Score de aderência (esquerda)
 * 3. StockAlertsWidget - Alertas de estoque (direita)
 * 
 * Responsável por:
 * - Buscar dados necessários para os widgets
 * - Gerenciar estado de carregamento
 * - Orquestrar navegação entre as ações
 * - Layout responsivo (grid 3 cols desktop, 1 col mobile)
 */
export default function DashboardWidgets({
  // Dados do dashboard
  protocols = [],
  stockSummary = [],
  logs = [],
  // Callbacks de navegação
  onNavigate,
  onOpenLogModal,
  // Dados de aderência (opcional - pode ser calculado internamente)
  adherenceData: externalAdherenceData
}) {
  const [adherenceData, setAdherenceData] = useState(null)
  const [lowStockItems, setLowStockItems] = useState([])
  const [outOfStockItems, setOutOfStockItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Processar dados de estoque
  useEffect(() => {
    const processStockData = () => {
      const lowStock = []
      const outOfStock = []

      stockSummary.forEach(item => {
        const stockInfo = {
          medicineId: item.medicine.id,
          name: item.medicine.name,
          currentStock: item.total,
          minStock: Math.ceil((item.dailyIntake || 1) * 7), // 7 dias de estoque mínimo
          unit: item.medicine.dosage_unit || 'un',
          daysRemaining: item.daysRemaining
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
    }

    processStockData()
  }, [stockSummary])

  // Calcular dados de aderência
  useEffect(() => {
    const calculateAdherence = () => {
      if (!protocols.length || !logs.length) {
        setAdherenceData({
          score: 0,
          streakDays: 0,
          bestStreak: 0,
          dosesTaken: 0,
          dosesScheduled: 0,
          periodLabel: 'Últimos 7 dias'
        })
        setIsLoading(false)
        return
      }

      // Período de análise: últimos 7 dias
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Calcular doses programadas nos últimos 7 dias
      let scheduledDoses = 0
      protocols.filter(p => p.active).forEach(protocol => {
        const timesPerDay = protocol.time_schedule?.length || 1
        scheduledDoses += timesPerDay * 7
      })

      // Contar doses tomadas no período
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.taken_at)
        return logDate >= sevenDaysAgo && logDate <= now
      })
      const takenDoses = recentLogs.length

      // Calcular score de aderência
      const score = scheduledDoses > 0 
        ? Math.round((takenDoses / scheduledDoses) * 100)
        : 0

      // Calcular streak atual
      let currentStreak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        const hasDoseOnDate = logs.some(log => {
          const logDate = new Date(log.taken_at)
          logDate.setHours(0, 0, 0, 0)
          return logDate.getTime() === checkDate.getTime()
        })

        if (hasDoseOnDate) {
          currentStreak++
        } else if (i > 0) {
          break
        }
      }

      // Calcular melhor streak
      let bestStreak = currentStreak
      let tempStreak = 0
      let lastDate = null

      const sortedLogs = [...logs].sort((a, b) => 
        new Date(a.taken_at) - new Date(b.taken_at)
      )

      sortedLogs.forEach(log => {
        const logDate = new Date(log.taken_at)
        logDate.setHours(0, 0, 0, 0)

        if (lastDate) {
          const diffDays = (logDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays === 1) {
            tempStreak++
          } else if (diffDays > 1) {
            bestStreak = Math.max(bestStreak, tempStreak)
            tempStreak = 1
          }
        } else {
          tempStreak = 1
        }
        lastDate = logDate
      })
      bestStreak = Math.max(bestStreak, tempStreak)

      setAdherenceData({
        score: Math.min(score, 100),
        streakDays: currentStreak,
        bestStreak: bestStreak,
        dosesTaken: takenDoses,
        dosesScheduled: scheduledDoses,
        periodLabel: 'Últimos 7 dias'
      })
      setIsLoading(false)
    }

    // Usar dados externos se fornecidos, senão calcular internamente
    if (externalAdherenceData) {
      setAdherenceData(externalAdherenceData)
      setIsLoading(false)
    } else {
      calculateAdherence()
    }
  }, [protocols, logs, externalAdherenceData])

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

  const handleViewAdherenceDetails = () => {
    onNavigate?.('adherence-report')
  }

  const handleImproveAdherence = () => {
    onNavigate?.('adherence-tips')
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

      {/* Grid de 2 colunas: Adherence | StockAlerts */}
      <div className="dashboard-widgets__row dashboard-widgets__row--grid">
        <div className="dashboard-widgets__col">
          <AdherenceWidget
            adherenceData={adherenceData}
            onViewDetails={handleViewAdherenceDetails}
            onImprove={handleImproveAdherence}
          />
        </div>
        <div className="dashboard-widgets__col">
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