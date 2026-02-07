import { useState, useEffect, useMemo } from 'react'
import {
  cachedLogService as logService,
  cachedTreatmentPlanService as treatmentPlanService
} from '../services/api'
import Loading from '../components/ui/Loading'
import Modal from '../components/ui/Modal'
import LogForm from '../components/log/LogForm'
import { useDashboard } from '../hooks/useDashboardContext.jsx'
import HealthScoreCard from '../components/dashboard/HealthScoreCard'
import HealthScoreDetails from '../components/dashboard/HealthScoreDetails'
import SmartAlerts from '../components/dashboard/SmartAlerts'
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget'
import TreatmentAccordion from '../components/dashboard/TreatmentAccordion'
import SwipeRegisterItem from '../components/dashboard/SwipeRegisterItem'
import { getCurrentUser } from '../lib/supabase'
import './Dashboard.css'

/**
 * Dashboard "Health Command Center"
 * Implementação da Onda 2.5 com UI Cyberpunk/Neo-Glass.
 */
export default function Dashboard({ onNavigate }) {
  const {
    stats,
    protocols: rawProtocols,
    logs,
    stockSummary,
    refresh,
    isDoseInToleranceWindow,
    isLoading: contextLoading
  } = useDashboard();
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [_error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prefillData, setPrefillData] = useState(null)
  const [rawTreatmentPlans, setRawTreatmentPlans] = useState([])
  
  const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState(false)
  
  // Rastreamentos de alertas silenciados (snoozed) pelo usuário - declarado antes do useMemo que o utiliza
  const [snoozedAlertIds, setSnoozedAlertIds] = useState(new Set())
  
  // 1. Carregar Nome do Usuário e Planos de Tratamento
  
  // 1. Carregar Nome do Usuário e Planos de Tratamento
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [user, plans] = await Promise.all([
          getCurrentUser(),
          treatmentPlanService.getAll()
        ]);
        
        if (user) {
          const name = user.user_metadata?.full_name || user.email.split('@')[0]
          setUserName(name.charAt(0).toUpperCase() + name.slice(1))
        }
        setRawTreatmentPlans(plans)
      } catch (err) {
        console.error(err)
        setError('Erro ao carregar perfil.')
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // Injetar dados de próxima dose nos planos de tratamento
  const treatmentPlans = useMemo(() => {
    return rawTreatmentPlans.map(plan => ({
      ...plan,
      protocols: plan.protocols?.map(p => {
        const liveProtocol = rawProtocols.find(rp => rp.id === p.id);
        return liveProtocol || p;
      })
    }));
  }, [rawTreatmentPlans, rawProtocols]);

  // 2. Saudação Dinâmica baseada no horário
  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours >= 0 && hours < 6) return 'BOA MADRUGADA,'
    if (hours >= 6 && hours < 12) return 'BOM DIA,'
    if (hours >= 12 && hours < 18) return 'BOA TARDE,'
    return 'BOA NOITE,'
  }

  // 3. Orquestração de Alertas Inteligentes
  const smartAlerts = useMemo(() => {
    const alerts = [];
    
    // Alerta de Estoque Crítico e Baixo
    // Agregação consolidada: stockSummary já contém um item por medicamento.
    // Garantimos que cada medicine_id tenha apenas UM alerta, priorizando o crítico.
    const processedMedicineIds = new Set();

    stockSummary.forEach(item => {
      const medId = item.medicine.id;
      if (processedMedicineIds.has(medId)) return;

      // Priorização rígida utilizando flags do stockSummary consolidado
      if (item.isZero || item.isLow) {
        const severity = item.isZero ? 'critical' : 'warning';
        const title = item.isZero ? 'Estoque Zerado' : 'Estoque Baixo';
        
        let daysLabel = '';
        if (item.isZero || item.daysRemaining === 0) {
          daysLabel = 'hoje';
        } else if (item.daysRemaining === Infinity) {
          daysLabel = 'em breve';
        } else {
          daysLabel = `em ${item.daysRemaining} dias`;
        }

        const message = item.isZero
          ? `O estoque total de ${item.medicine.name} acabou.`
          : `${item.medicine.name} acabará ${daysLabel} (Total: ${item.total} restantes).`;

        alerts.push({
          id: `stock-${item.medicine.id}`,
          severity,
          title,
          message,
          type: 'stock',
          medicine_id: item.medicine.id,
          actions: [
            { label: 'COMPRAR', type: 'placeholder', title: 'Em breve: integração com farmácias para compra direta' },
            { label: 'ESTOQUE', type: 'secondary' }
          ]
        });
        processedMedicineIds.add(medId);
      }
    });

    // Alerta de Doses Atrasadas (Mock funcional)
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    rawProtocols.forEach(p => {
      p.time_schedule?.forEach(time => {
        const [h, m] = time.split(':').map(Number);
        const doseMinutes = h * 60 + m;
        const delay = currentMinutes - doseMinutes;

        // Uma dose é considerada atrasada apenas se passaram mais de 120 minutos (2 horas) do horário previsto
        // E ela deve ser de hoje (delay < 1440)
        const isPastTolerance = delay > 120;

        if (delay > 0 && delay < 1440) {
          // Verificar se já foi tomada dentro da janela de tolerância
          const alreadyTaken = logs.some(l =>
            l.protocol_id === p.id &&
            isDoseInToleranceWindow(time, l.taken_at)
          );

          if (!alreadyTaken && isPastTolerance) {
            alerts.push({
              id: `delay-${p.id}-${time}`,
              severity: delay > 240 ? 'critical' : 'warning', // Mais de 4h de atraso vira crítico
              title: delay > 240 ? 'Atraso Crítico' : 'Dose Atrasada',
              message: `${p.medicine?.name} era às ${time} (${Math.floor(delay/60)}h ${delay%60}min atrás)`,
              protocol_id: p.id,
              actions: [
                { label: 'TOMAR', type: 'primary' },
                { label: 'ADIAR', type: 'secondary' }
              ]
            });
          }
        }
      });
    });

    return alerts
      .filter(alert => !snoozedAlertIds.has(alert.id))
      .sort((a) => (a.severity === 'critical' ? -1 : 1));
  }, [rawProtocols, logs, stockSummary, isDoseInToleranceWindow, snoozedAlertIds]);

  const handleRegisterDose = async (medicineId, protocolId) => {
    try {
      await logService.create({
        medicine_id: medicineId,
        protocol_id: protocolId,
        quantity_taken: 1, // Default para swipe
        taken_at: new Date().toISOString()
      });
      refresh(); // Atualiza dashboard context
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar dose. Tente novamente.');
    }
  };

  const [selectedMedicines, setSelectedMedicines] = useState({});
  

  const toggleMedicineSelection = (planId, protocolId) => {
    setSelectedMedicines(prev => {
      const planSelections = prev[planId] || [];
      const isSelected = planSelections.includes(protocolId);
      
      const newSelections = isSelected
        ? planSelections.filter(id => id !== protocolId)
        : [...planSelections, protocolId];
        
      return {
        ...prev,
        [planId]: newSelections
      };
    });
  };

  const handleBatchRegister = async (plan, selectedProtocolIds) => {
    try {
      // Se nada selecionado, registra todos por padrão
      const protocolsToLog = selectedProtocolIds && selectedProtocolIds.length > 0
        ? plan.protocols.filter(p => selectedProtocolIds.includes(p.id))
        : plan.protocols.filter(p => p.active);

      if (protocolsToLog.length === 0) return;

      const logsToSave = protocolsToLog.map(p => ({
        protocol_id: p.id,
        medicine_id: p.medicine_id,
        quantity_taken: p.dosage_per_intake || 1,
        taken_at: new Date().toISOString(),
        notes: `[Lote Dashboard] Plano: ${plan.name}`
      }));

      await logService.createBulk(logsToSave);
      
      // Limpar seleção do plano após sucesso
      setSelectedMedicines(prev => ({
        ...prev,
        [plan.id]: []
      }));
      
      refresh();
    } catch (err) {
      console.error('Erro no registro em lote:', err);
      alert('Erro ao registrar lote. Tente novamente.');
    }
  };

  if (isLoading || contextLoading) return <Loading text="Sincronizando Command Center..." />

  return (
    <div className="dashboard-container-v2">
      {/* 1. Header & Score Hero */}
      <header className="dash-header">
        <div className="dash-header__welcome">
          <span className="greeting-label">{getGreeting()}</span>
          <button className="user-name-link" onClick={() => onNavigate?.('settings')} title="Configurações">{userName} <span className="dot">.</span></button>
        </div>
        <HealthScoreCard
          score={stats.score}
          streak={stats.currentStreak}
          trend="up"
          onClick={() => setIsHealthDetailsOpen(true)}
        />
      </header>

      <HealthScoreDetails
        isOpen={isHealthDetailsOpen}
        onClose={() => setIsHealthDetailsOpen(false)}
        stats={stats}
        stockSummary={stockSummary}
      />

      {/* 2. Smart Alerts Section */}
      <SmartAlerts
        alerts={smartAlerts}
        onAction={(alert, action) => {
          if (action.label === 'TOMAR') {
            if (alert.protocol_id) {
              setPrefillData({ protocol_id: alert.protocol_id, type: 'protocol' });
            } else if (alert.treatment_plan_id) {
              setPrefillData({ treatment_plan_id: alert.treatment_plan_id, type: 'plan' });
            }
            setIsModalOpen(true);
          } else if (action.label === 'COMPRAR') {
            // Placeholder - tooltip informa integração futura
          } else if (action.label === 'ESTOQUE') {
            onNavigate('stock', { medicineId: alert.medicine_id });
          } else if (action.label === 'ADIAR') {
            setSnoozedAlertIds(prev => {
              const newSet = new Set(prev);
              newSet.add(alert.id);
              return newSet;
            });
          }
        }}
      />

      {/* 3. Quick Actions */}
      <QuickActionsWidget
        onRegisterDose={() => {
          setPrefillData(null);
          setIsModalOpen(true);
        }}
        onAddStock={() => onNavigate('stock')}
        onViewHistory={() => onNavigate('history')}
      />

      {/* 4. Tratamento - Parte Superior: Planos Completos */}
      <section className="treatment-plans-section">
        <div className="section-header">
          <h2 className="section-title">TRATAMENTO</h2>
          <span className="section-subtitle">{treatmentPlans.length} {treatmentPlans.length === 1 ? 'Plano' : 'Planos'}</span>
        </div>

        <div className="treatment-plans-list">
          {treatmentPlans.map(plan => (
            <TreatmentAccordion
              key={plan.id}
              protocol={{
                id: plan.id,
                name: plan.name,
                medicines_count: plan.protocols?.length || 0,
                next_dose: plan.protocols?.[0]?.next_dose || '--:--'
              }}
              selectedMedicines={selectedMedicines[plan.id] || []}
              onBatchRegister={(p, selectedIds) => handleBatchRegister(plan, selectedIds)}
            >
              {plan.protocols?.filter(p => p.active).map(p => (
                <SwipeRegisterItem
                  key={p.id}
                  medicine={p.medicine}
                  time={p.next_dose || '--:--'}
                  isSelected={(selectedMedicines[plan.id] || []).includes(p.id)}
                  onToggleSelection={() => toggleMedicineSelection(plan.id, p.id)}
                  onRegister={() => handleRegisterDose(p.medicine_id, p.id)}
                />
              ))}
            </TreatmentAccordion>
          ))}
        </div>
      </section>

      {/* 4. Tratamento - Parte Inferior: Protocolos Avulsos */}
      <section className="treatment-standalone-section">
        <div className="section-header">
          <h2 className="section-title">PRÓXIMAS</h2>
        </div>

        <div className="treatment-standalone-list">
          {rawProtocols.filter(p => !p.treatment_plan_id).map(p => (
            <SwipeRegisterItem 
              key={p.id}
              medicine={p.medicine}
              time={p.next_dose || '--:--'}
              onRegister={() => handleRegisterDose(p.medicine_id, p.id)}
            />
          ))}
          
          {/* Se não houver protocolos avulsos, mostrar protocolo do primeiro plano */}
          {rawProtocols.filter(p => !p.treatment_plan_id).length === 0 && treatmentPlans.length > 0 && (
            treatmentPlans[0].protocols?.filter(p => p.active).slice(0, 3).map(p => (
              <SwipeRegisterItem 
                key={p.id}
                medicine={p.medicine}
                time={p.next_dose || '--:--'}
                onRegister={() => handleRegisterDose(p.medicine_id, p.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* 5. Floating Action Button */}
      <div className="dash-footer-actions">
        <button className="btn-add-manual" onClick={() => {
          setPrefillData(null);
          setIsModalOpen(true);
        }}>
          + REGISTRO MANUAL
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPrefillData(null);
        }}
      >
        <LogForm
          protocols={rawProtocols}
          treatmentPlans={treatmentPlans}
          initialValues={prefillData}
          onSave={async (data) => {
            if (Array.isArray(data)) {
              await logService.createBulk(data);
            } else {
              await logService.create(data);
            }
            setIsModalOpen(false);
            refresh();
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
