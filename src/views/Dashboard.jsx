import { useState, useEffect, useCallback } from 'react'
// CACHE SWR v1.5: Usando cachedServices para reduzir latência
// - Primeiro load: busca da API e cacheia
// - Visitas subsequentes (< 30s): retorna do cache imediatamente
// - Revalidação em background mantém dados atualizados
import { 
  cachedProtocolService as protocolService, 
  cachedLogService as logService, 
  cachedStockService as stockService, 
  cachedMedicineService as medicineService, 
  cachedTreatmentPlanService as treatmentPlanService 
} from '../services/api'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import Modal from '../components/ui/Modal'
import LogForm from '../components/log/LogForm'
import { calculateTitrationData } from '../utils/titrationUtils'
import './Dashboard.css'

import CalendarWithMonthCache from '../components/ui/CalendarWithMonthCache'
import ProtocolChecklistItem from '../components/protocol/ProtocolChecklistItem'
import AdherenceWidget from '../components/adherence/AdherenceWidget'

import { getCurrentUser } from '../lib/supabase'

export default function Dashboard({ onNavigate }) {
  const [userName, setUserName] = useState('')
  const [activeProtocols, setActiveProtocols] = useState([])
  const [treatmentPlans, setTreatmentPlans] = useState([])
  const [stockSummary, setStockSummary] = useState([])
  const [nextDose, setNextDose] = useState(null)
  const [activeTitration, setActiveTitration] = useState(null)
  // recentLogs state removed as it was unused
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)
  
  // Month cache for calendar
  const [currentMonthLogs, setCurrentMonthLogs] = useState([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Data Loading Logic
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [user, protocols, plans, medicines, logsResponse] = await Promise.all([
        getCurrentUser(),
        protocolService.getActive(),
        treatmentPlanService.getAll(),
        medicineService.getAll(),
        logService.getAllPaginated(100, 0)
      ])
      
      if (user) {
        const name = user.user_metadata?.full_name || user.email.split('@')[0]
        setUserName(name.charAt(0).toUpperCase() + name.slice(1))
      }

      const logs = logsResponse.data || []
      
      const enrichedProtocols = protocols.map(p => ({
        ...p,
        titration_scheduler_data: calculateTitrationData(p)
      }))

      setActiveProtocols(enrichedProtocols)
      setTreatmentPlans(plans)
      // setRecentLogs removed

      if (logs.length > 0) {
        // Use functional update to check current state without adding dependency
        setSelectedCalendarDate(prev => prev || new Date(logs[0].taken_at))
      }

      // Calculate Stock
      const dailyIntakeMap = {}
      enrichedProtocols.forEach(p => {
        if (p.active) {
          const daily = (p.dosage_per_intake || 0) * (p.time_schedule?.length || 0)
          dailyIntakeMap[p.medicine_id] = (dailyIntakeMap[p.medicine_id] || 0) + daily
        }
      })
      
      const stockPromises = medicines.map(async (medicine) => {
        const entries = await stockService.getByMedicine(medicine.id)
        const total = entries.reduce((sum, entry) => sum + entry.quantity, 0)
        // Find cheapest/first price for display (simple logic)
        const price = entries.length > 0 ? entries[0].price : 0
        const lot = entries.length > 0 ? entries[0].batch_number : ''

        const dailyIntake = dailyIntakeMap[medicine.id] || 0
        const daysRemaining = dailyIntake > 0 ? total / dailyIntake : Infinity
        const isLow = dailyIntake > 0 && daysRemaining < 7 // Changed to 7 days for visibility

        return { medicine, total, price, lot, isLow, daysRemaining }
      })
      
      const stockData = await Promise.all(stockPromises)
      // Filter for items that are low or have any stock
      const criticalStock = stockData.filter(item => item.isLow || item.total > 0)
      setStockSummary(criticalStock)

      // Calculate Next Dose
      calculateNextDose(enrichedProtocols)

      // Find Active Titration
      const titration = enrichedProtocols.find(p => p.titration_scheduler_data?.hasTitration)
      setActiveTitration(titration)

    } catch (err) {
      console.error(err)
      setError('Erro ao carregar dados.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const calculateNextDose = (protocols) => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    let next = null
    let minDiff = Infinity

    protocols.forEach(p => {
      if (!p.time_schedule) return
      p.time_schedule.forEach(time => {
        const [h, m] = time.split(':').map(Number)
        let diff = (h * 60 + m) - currentMinutes
        
        // If time passed today, assume tomorrow (add 24h)
        if (diff <= 0) diff += 24 * 60

        if (diff < minDiff) {
          minDiff = diff
          next = {
            time: time,
            medicine: p.medicine?.name,
            dosage: `${p.dosage_per_intake} ${p.dosage_unit || 'cp'}`
          }
        }
      })
    })
    setNextDose(next)
  }

  const handleRegisterDose = async () => {
    setIsModalOpen(true)
  }

  const handleSaveLog = async (logData) => {
    try {
      if (Array.isArray(logData)) {
        await logService.createBulk(logData)
        showSuccess('Lote registrado com sucesso!')
      } else {
        await logService.create(logData)
        showSuccess('Dose registrada com sucesso!')
      }
      setIsModalOpen(false)
      loadDashboardData()
    } catch (err) {
      console.error(err)
      alert('Erro ao registrar dose')
    }
  }

  const [expandedPlans, setExpandedPlans] = useState({})
  const [selectedProtocols, setSelectedProtocols] = useState({})
  const [successMessage, setSuccessMessage] = useState('')

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const togglePlanExpand = (planId) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }))
  }

  const toggleProtocolSelection = (planId, protocolId) => {
    setSelectedProtocols(prev => {
      const currentSelection = prev[planId] || []
      const isSelected = currentSelection.includes(protocolId)
      
      const newSelection = isSelected 
        ? currentSelection.filter(id => id !== protocolId)
        : [...currentSelection, protocolId]
        
      return {
        ...prev,
        [planId]: newSelection
      }
    })
  }

  const handleTakeSelectedFromPlan = async (e, plan) => {
    e.stopPropagation()
    const selection = selectedProtocols[plan.id] || []
    const protocolsToTake = plan.protocols?.filter(p => p.active && selection.includes(p.id)) || []
    
    if (protocolsToTake.length === 0) return

    const logs = protocolsToTake.map(p => ({
      protocol_id: p.id,
      medicine_id: p.medicine_id,
      quantity_taken: p.dosage_per_intake,
      notes: `[Ação Rápida: ${plan.name}]`
    }))

    await handleSaveLog(logs)
  }

  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours >= 0 && hours < 6) return 'BOA MADRUGADA,'
    if (hours >= 6 && hours < 12) return 'BOM DIA,'
    if (hours >= 12 && hours < 18) return 'BOA TARDE,'
    return 'BOA NOITE,'
  }
  
  const handleCalendarLoadMonth = useCallback(async (year, month) => {
    const result = await logService.getByMonth(year, month)
    
    // Update current month logs for display
    if (year === new Date().getFullYear() && month === new Date().getMonth()) {
      setCurrentMonthLogs(result.data || [])
    }
    
    return result
  }, [])

  const displayDate = selectedCalendarDate || new Date()
  const logsForSelectedDate = currentMonthLogs.filter(log => {
    const d = new Date(log.taken_at)
    return d.getFullYear() === displayDate.getFullYear() &&
           d.getMonth() === displayDate.getMonth() &&
           d.getDate() === displayDate.getDate()
  })

  if (isLoading) return <Loading text="Carregando..." />

  return (
    <div className="dashboard-container-v2">
      {/* Header */}
      <header className="dash-header">
        <div>
          <span className="greeting-label">{getGreeting()}</span>
          <h1 className="user-name">{userName} <span className="dot">.</span></h1>
        </div>
        <div 
          className="profile-indicator" 
          onClick={() => onNavigate('settings')}
          style={{ cursor: 'pointer' }}
        >
          <img src="/logo-new.svg" className="avatar-logo" alt="Logo" />
        </div>
      </header>

      {error && (
        <div style={{ color: 'var(--accent-error)', marginBottom: '16px', padding: '12px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Top Cards Grid */}
      <div className="top-cards-grid">
        <div className="info-card next-dose-card">
          <span className="card-label">PRÓXIMA DOSE</span>
          <div className="card-value-group">
            <span className="highlight-value white">{nextDose ? nextDose.time : '--:--'}</span>
            <span className="sub-value">{nextDose ? nextDose.medicine : 'Nenhuma dose prevista'}</span>
          </div>
        </div>

        <div className="info-card critical-stock-card">
          <span className="card-label">ESTOQUE CRÍTICO</span>
          <div className="card-value-group">
            <span className="highlight-value magenta">{stockSummary.filter(s => s.isLow).length.toString().padStart(2, '0')}</span>
            <span className="sub-value">Medicamentos baixo</span>
          </div>
        </div>
      </div>

      {/* Adherence Score Widget */}
      <AdherenceWidget defaultPeriod="30d" />

      {/* Titration Protocol Card - Only if active */}
      {activeTitration && (
        <div className="titration-card">
          <div className="titration-header">
            <div>
              <h3>Protocolo: {activeTitration.name || 'Titulação'}</h3>
              <span className="titration-phase">
                Fase {activeTitration.current_stage_index + 1} de {activeTitration.titration_scheduler_data?.totalSteps} • Estabilização
              </span>
            </div>
            
             {/* Progress Bar */}
             <div className="progress-container">
               <div 
                 className="progress-bar" 
                 style={{ 
                   width: `${((activeTitration.current_stage_index + 1) / activeTitration.titration_scheduler_data?.totalSteps) * 100}%` 
                 }}
               ></div>
             </div>
          </div>

          <div className="titration-details">
            <div className="current-dose-info">
              <div className="icon-circle">✓</div>
              <div>
                <strong>Dose Atual: {activeTitration.dosage_per_intake} {activeTitration.dosage_unit || 'cp'}</strong>
                <p>Próximo ajuste em {activeTitration.titration_scheduler_data?.daysRemaining} dias</p>
              </div>
            </div>
          </div>

          <Button className="action-button-full" onClick={handleRegisterDose}>
            REGISTRAR DOSE AGORA
          </Button>
        </div>
      )}
       
       {/* Explicitly show register button if no titration card acts as main CTA */}
       {!activeTitration && (
          <div className="cta-container">
             <Button className="action-button-full" onClick={handleRegisterDose}>
              REGISTRAR DOSE AGORA
            </Button>
          </div>
       )}

      {/* Success Message Banner */}
      {successMessage && (
        <div className="success-banner fade-in" style={{ 
          background: 'rgba(0, 255, 136, 0.15)', 
          border: '1px solid var(--neon-green)', 
          color: '#fff', 
          padding: '12px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          textAlign: 'center',
          fontWeight: 600
        }}>
          ✨ {successMessage}
        </div>
      )}

      {/* Treatment Plans Interactive List */}
      {treatmentPlans.length > 0 && (
        <div className="treatment-plans-section">
          <h3 className="section-title">SEUS TRATAMENTOS</h3>
          <div className="treatment-plans-list-interactive">
            {treatmentPlans.map(plan => {
               const isExpanded = expandedPlans[plan.id];
               const currentSelection = selectedProtocols[plan.id] ?? plan.protocols?.filter(p => p.active).map(p => p.id) ?? [];
               const hasSelection = currentSelection.length > 0;

               return (
                <div key={plan.id} className={`treatment-plan-card ${isExpanded ? 'expanded' : ''}`}>
                  <div className="plan-card-header" onClick={() => togglePlanExpand(plan.id)}>
                    <div className="plan-info-group">
                       <span className="plan-icon-large">💊</span>
                       <div>
                         <h4 className="plan-title">{plan.name}</h4>
                         <span className="plan-subtitle">{plan.objective || 'Em tratamento'}</span>
                       </div>
                    </div>
                    <div className="plan-actions-group">
                       <Button 
                         variant="primary" 
                         className="btn-take-bundle"
                         disabled={!hasSelection}
                         onClick={(e) => handleTakeSelectedFromPlan(e, plan)}
                       >
                         {hasSelection ? `TOMAR (${currentSelection.length})` : 'TOMAR'}
                       </Button>
                       <button className={`expand-btn ${isExpanded ? 'rotated' : ''}`}>▼</button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="plan-checklist-container fade-in">
                      {plan.protocols?.filter(p => p.active).map(p => (
                        <ProtocolChecklistItem
                          key={p.id}
                          protocol={p}
                          isSelected={currentSelection.includes(p.id)}
                          onToggle={(pid) => toggleProtocolSelection(plan.id, pid)}
                        />
                      ))}
                    </div>
                  )}
                </div>
               )
            })}
          </div>
        </div>
      )}

      {/* Inventory Alerts */}
      <div className="inventory-section">
        <h3 className="section-title">ALERTAS DE INVENTÁRIO</h3>
        
        <div className="inventory-list">
          {stockSummary.filter(s => s.isLow).length === 0 ? (
             <div className="empty-inventory">Tudo certo com seu estoque!</div>
          ) : (
            stockSummary.filter(s => s.isLow).map((item, idx) => (
              <div key={idx} className="inventory-item">
                <div className="item-status-indicator"></div>
                <div className="item-details">
                  <span className="item-name">{item.medicine.name} {item.medicine.dosage_per_pill}</span>
                  <span className="item-meta">
                    {item.lot && `Lote #${item.lot} • `} 
                    {item.price > 0 && `R$ ${item.price}/un`}
                  </span>
                </div>
                <div className="item-qty">
                  {item.total} uni.
                </div>
              </div>
            ))
          )}
        </div>
      </div>

     {/* History Calendar */}
     <div className="history-section">
        <h3 className="section-title">HISTÓRICO DE DOSES</h3>
        <div className="calendar-card">
           <CalendarWithMonthCache
              onLoadMonth={handleCalendarLoadMonth}
              markedDates={currentMonthLogs.map(log => log.taken_at)}
              selectedDate={selectedCalendarDate}
              onDayClick={(date) => setSelectedCalendarDate(date)}
            />
            
            <div className="calendar-logs-list">
              <h4 className="date-header">{displayDate.toLocaleDateString('pt-BR')}</h4>
              {logsForSelectedDate.length === 0 ? (
                <p className="no-logs">Nenhum registro</p>
              ) : (
                logsForSelectedDate.map(log => (
                  <div key={log.id} className="log-mini-item">
                    <span>{log.medicine?.name}</span>
                    <span className="log-time">
                      {new Date(log.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}
                    </span>
                  </div>
                ))
              )}
            </div>
        </div>
     </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        <LogForm
          protocols={activeProtocols}
          treatmentPlans={treatmentPlans}
          onSave={handleSaveLog}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  )
}