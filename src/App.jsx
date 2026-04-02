import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCurrentUser, onAuthStateChange } from '@shared/utils/supabase'
import '@shared/styles/index.css'
import appStyles from './App.module.css'
import Auth from './views/Auth'
import Dashboard from './views/Dashboard'
import Loading from '@shared/components/ui/Loading'

// Lazy imports — carregam apenas quando a view é acessada
const Medicines = lazy(() => import('./views/Medicines'))
const MedicinesRedesign = lazy(() => import('./views/redesign/MedicinesRedesign'))
const Stock = lazy(() => import('./views/Stock'))
const Protocols = lazy(() => import('./views/Protocols'))
const History = lazy(() => import('./views/History'))
const Settings = lazy(() => import('./views/Settings'))
const Calendar = lazy(() => import('./views/Calendar'))
const Emergency = lazy(() => import('./views/Emergency'))
const Treatment = lazy(() => import('./views/Treatment'))
const Profile = lazy(() => import('./views/Profile'))
const HealthHistory = lazy(() => import('./views/HealthHistory'))
const DLQAdmin = lazy(() => import('./views/admin/DLQAdmin'))
const Consultation = lazy(() => import('./views/Consultation'))
const Landing = lazy(() => import('./views/Landing'))
const DashboardRedesign = lazy(() => import('./views/redesign/DashboardRedesign'))
const TreatmentsRedesign = lazy(() => import('./views/redesign/TreatmentsRedesign'))
const StockRedesign = lazy(() => import('./views/redesign/StockRedesign'))
const ProfileRedesign = lazy(() => import('./views/redesign/ProfileRedesign'))
const HealthHistoryRedesign = lazy(() => import('./views/redesign/HealthHistoryRedesign'))
const SettingsRedesign = lazy(() => import('./views/redesign/SettingsRedesign'))
const EmergencyRedesign = lazy(() => import('./views/redesign/EmergencyRedesign'))
const ConsultationRedesign = lazy(() => import('./views/redesign/ConsultationRedesign'))
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))
const BottomNavRedesign = lazy(() => import('@shared/components/ui/BottomNavRedesign'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))
const GlobalDoseModal = lazy(() => import('@shared/components/ui/GlobalDoseModal'))
import TestConnection from '@shared/components/TestConnection'
import BottomNav from '@shared/components/ui/BottomNav'
import { OnboardingProvider, OnboardingWizard } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'
import { RedesignProvider } from '@shared/contexts/RedesignContext.jsx'
import { useRedesign } from '@shared/hooks/useRedesign'
import InstallPrompt from '@shared/components/pwa/InstallPrompt'
import { OfflineBanner } from '@shared/components/ui/OfflineBanner'

/**
 * Placeholder exibido enquanto chunk de view carrega
 */
function ViewSkeleton() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '14px',
      }}
      aria-busy="true"
      aria-label="Carregando..."
    >
      Carregando...
    </div>
  )
}

function AppInner() {
  const { isRedesignEnabled, enableRedesign } = useRedesign()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isDoseModalOpen, setIsDoseModalOpen] = useState(false)
  const [initialProtocolParams, setInitialProtocolParams] = useState(null)
  const [initialStockParams, setInitialStockParams] = useState(null)
  const [initialTreatmentMedicineId, setInitialTreatmentMedicineId] = useState(null)
  const [showAuth, setShowAuth] = useState(false) // toggles auth UI for unauthenticated visitors

  useEffect(() => {
    // Check initial session
    getCurrentUser()
      .then((user) => {
        setSession(user)
        setIsLoading(false)
      })
      .catch(() => {
        setSession(null)
        setIsLoading(false)
      })

    // Listen for changes
    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      setSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const navigateToProtocol = (medicineId) => {
    if (isRedesignEnabled) {
      setInitialTreatmentMedicineId(medicineId)
      setCurrentView('treatment')
    } else {
      setInitialProtocolParams({ medicineId })
      setCurrentView('protocols')
    }
  }

  const navigateToStock = (medicineId) => {
    setInitialStockParams({ medicineId })
    setCurrentView('stock')
  }

  if (isLoading) {
    return (
      <div
        className="app-container"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Loading text="Carregando..." />
      </div>
    )
  }

  const isAuthenticated = !!session

  const renderCurrentView = () => {
    if (!session) {
      return showAuth ? (
        <Auth
          onAuthSuccess={() => {
            enableRedesign()
            setShowAuth(false)
            setCurrentView('dashboard')
          }}
          onClose={() => setShowAuth(false)}
        />
      ) : (
        <Suspense fallback={<ViewSkeleton />}>
          <Landing isAuthenticated={false} onOpenAuth={() => setShowAuth(true)} />
        </Suspense>
      )
    }

    switch (currentView) {
      case 'landing':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Landing
              isAuthenticated={isAuthenticated}
              onOpenAuth={() => setShowAuth(true)}
              onContinue={() => setCurrentView('dashboard')}
            />
          </Suspense>
        )
      case 'medicines':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <MedicinesRedesign onNavigateToProtocol={navigateToProtocol} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Medicines onNavigateToProtocol={navigateToProtocol} />
          </Suspense>
        )
      case 'stock':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <StockRedesign
              initialParams={initialStockParams}
              onClearParams={() => setInitialStockParams(null)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Stock
              initialParams={initialStockParams}
              onClearParams={() => setInitialStockParams(null)}
            />
          </Suspense>
        )
      case 'protocols':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Protocols
              initialParams={initialProtocolParams}
              onClearParams={() => setInitialProtocolParams(null)}
              onNavigateToStock={navigateToStock}
            />
          </Suspense>
        )
      case 'treatment':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <TreatmentsRedesign
              onNavigateToProtocol={() => setCurrentView('treatment')}
              onNavigate={setCurrentView}
              initialMedicineId={initialTreatmentMedicineId}
              onClearInitialMedicine={() => setInitialTreatmentMedicineId(null)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Treatment
              onNavigate={(view, params) => {
                if (view === 'protocols' && params?.medicineId) {
                  setInitialProtocolParams({ medicineId: params.medicineId })
                }
                setCurrentView(view)
              }}
            />
          </Suspense>
        )
      case 'profile':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <ProfileRedesign onNavigate={setCurrentView} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Profile onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'health-history':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistoryRedesign key="health-history" onNavigate={setCurrentView} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistory key="health-history" onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'history':
        // W3-06: historico agora vive em HealthHistory
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistoryRedesign key="history" onNavigate={setCurrentView} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistory key="history" onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'consultation':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <ConsultationRedesign onBack={() => setCurrentView('profile')} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Consultation onBack={() => setCurrentView('profile')} />
          </Suspense>
        )
      case 'settings':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <SettingsRedesign onNavigate={setCurrentView} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Settings onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'emergency':
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <EmergencyRedesign onNavigate={setCurrentView} />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <Emergency onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'admin-dlq':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <DLQAdmin />
          </Suspense>
        )
      case 'calendar':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Calendar onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'dashboard':
      default: {
        const dashboardNavigate = (view, params) => {
          if (view === 'stock' && params?.medicineId) {
            setInitialStockParams({ medicineId: params.medicineId })
          } else if (view === 'protocols' && params?.medicineId) {
            setInitialProtocolParams({ medicineId: params.medicineId })
          }
          setCurrentView(view)
        }
        return isRedesignEnabled ? (
          <Suspense fallback={<ViewSkeleton />}>
            <DashboardRedesign onNavigate={dashboardNavigate} />
          </Suspense>
        ) : (
          <Dashboard onNavigate={dashboardNavigate} />
        )
      }
    }
  }

  return (
    <OnboardingProvider>
      <DashboardProvider>
        <div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
          {/* Sidebar — desktop, apenas usuários com flag ativo */}
          {isAuthenticated && isRedesignEnabled && (
            <Suspense fallback={null}>
              <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                onNewDose={() => setIsDoseModalOpen(true)}
              />
            </Suspense>
          )}

          <main
            className={
              isAuthenticated && isRedesignEnabled ? 'app-main main-with-sidebar' : 'app-main'
            }
            style={{ paddingBottom: isRedesignEnabled ? undefined : '80px' }}
          >
            {isRedesignEnabled ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentView}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {renderCurrentView()}
                </motion.div>
              </AnimatePresence>
            ) : (
              renderCurrentView()
            )}
            <footer
              style={{
                textAlign: 'center',
                marginTop: 'var(--space-8)',
                paddingBottom: 'var(--space-8)',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {' '}
            </footer>
          </main>

          <OfflineBanner />

          {/* BottomNav: redesign para flag users, original para outros */}
          {isAuthenticated &&
            (isRedesignEnabled ? (
              <Suspense fallback={null}>
                <BottomNavRedesign currentView={currentView} setCurrentView={setCurrentView} />
              </Suspense>
            ) : (
              <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
            ))}

          {/* Chatbot IA — lazy-loaded, disponivel para usuarios autenticados */}
          {isAuthenticated && (
            <>
              <button
                onClick={() => setIsChatOpen(true)}
                aria-label="Abrir assistente IA"
                className={appStyles.chatFab}
              >
                🤖
              </button>
              {isChatOpen && (
                <Suspense fallback={null}>
                  <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                </Suspense>
              )}
            </>
          )}

          {/* FAB móvel "Registrar Dose" — visível apenas mobile, apenas redesign */}
          {isAuthenticated && isRedesignEnabled && (
            <button
              onClick={() => setIsDoseModalOpen(true)}
              aria-label="Registrar dose"
              className={appStyles.doseFab}
            >
              + Dose
            </button>
          )}

          {/* Modal global de registro de dose */}
          {isAuthenticated && isRedesignEnabled && isDoseModalOpen && (
            <Suspense fallback={null}>
              <GlobalDoseModal isOpen={isDoseModalOpen} onClose={() => setIsDoseModalOpen(false)} />
            </Suspense>
          )}

          {/* Onboarding Wizard - apenas para usuários autenticados */}
          {isAuthenticated && <OnboardingWizard />}

          {/* PWA Install Prompt - para todos os usuários */}
          <InstallPrompt />
        </div>
      </DashboardProvider>
    </OnboardingProvider>
  )
}

function App() {
  return (
    <RedesignProvider>
      <AppInner />
    </RedesignProvider>
  )
}

export default App
