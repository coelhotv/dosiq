import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BotMessageSquare } from 'lucide-react'
import { getCurrentUser, onAuthStateChange } from '@shared/utils/supabase'
import '@shared/styles/index.css'
import appStyles from './App.module.css'
import Auth from './views/Auth'
import Loading from '@shared/components/ui/Loading'

// Lazy imports — carregam apenas quando a view é acessada (versão consolidada — apenas redesign)
const Landing = lazy(() => import('./views/Landing'))
const Medicines = lazy(() => import('./views/redesign/MedicinesRedesign'))
const Stock = lazy(() => import('./views/redesign/StockRedesign'))
const Protocols = lazy(() => import('./views/Protocols'))
const HealthHistory = lazy(() => import('./views/redesign/HealthHistoryRedesign'))
const Settings = lazy(() => import('./views/redesign/SettingsRedesign'))
const Calendar = lazy(() => import('./views/Calendar'))
const Emergency = lazy(() => import('./views/redesign/EmergencyRedesign'))
const Treatment = lazy(() => import('./views/redesign/TreatmentsRedesign'))
const Profile = lazy(() => import('./views/redesign/ProfileRedesign'))
const Consultation = lazy(() => import('./views/redesign/ConsultationRedesign'))
const DLQAdmin = lazy(() => import('./views/admin/DLQAdmin'))
const Dashboard = lazy(() => import('./views/redesign/DashboardRedesign'))
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))
const BottomNavRedesign = lazy(() => import('@shared/components/ui/BottomNavRedesign'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))
const GlobalDoseModal = lazy(() => import('@shared/components/ui/GlobalDoseModal'))
import TestConnection from '@shared/components/TestConnection'
import { OnboardingProvider, OnboardingWizard } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'
import { RedesignProvider } from '@shared/contexts/RedesignContext.jsx'
import InstallPrompt from '@shared/components/pwa/InstallPrompt'
import { OfflineBanner } from '@shared/components/ui/OfflineBanner'

/**
 * Placeholder exibido enquanto chunk de view carrega
 */
function ViewSkeleton() {
  return (
    <div
      role="status"
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '14px',
      }}
      aria-busy="true"
      aria-label="Carregando view..."
    >
      <span className="sr-only">Carregando...</span>
    </div>
  )
}

function AppInner() {
  const shouldReduceMotion = useReducedMotion()
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
    setInitialTreatmentMedicineId(medicineId)
    setCurrentView('treatment')
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
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Medicines onNavigateToProtocol={navigateToProtocol} />
          </Suspense>
        )
      case 'stock':
        return (
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
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Treatment
              onNavigateToProtocol={() => setCurrentView('treatment')}
              onNavigate={setCurrentView}
              initialMedicineId={initialTreatmentMedicineId}
              onClearInitialMedicine={() => setInitialTreatmentMedicineId(null)}
            />
          </Suspense>
        )
      case 'profile':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Profile onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'health-history':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistory key="health-history" onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'history':
        // W3-06: historico agora vive em HealthHistory
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <HealthHistory key="history" onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'consultation':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Consultation onBack={() => setCurrentView('profile')} />
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Settings onNavigate={setCurrentView} />
          </Suspense>
        )
      case 'emergency':
        return (
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
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Dashboard onNavigate={dashboardNavigate} />
          </Suspense>
        )
      }
    }
  }

  return (
    <OnboardingProvider>
      <DashboardProvider>
        {/* Skip to main content — visível apenas no focus, para navegação por teclado */}
        <a href="#main-content" className="skip-to-content">
          Ir para conteúdo principal
        </a>

        <div className="app-container" data-redesign="true">
          {/* Sidebar — desktop, apenas usuários autenticados */}
          {isAuthenticated && (
            <Suspense fallback={null}>
              <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                onNewDose={() => setIsDoseModalOpen(true)}
              />
            </Suspense>
          )}

          <main
            id="main-content"
            className={isAuthenticated ? 'app-main main-with-sidebar' : 'app-main'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentView}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              >
                {renderCurrentView()}
              </motion.div>
            </AnimatePresence>
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

          {/* BottomNav — redesign version */}
          {isAuthenticated && (
            <Suspense fallback={null}>
              <BottomNavRedesign currentView={currentView} setCurrentView={setCurrentView} />
            </Suspense>
          )}

          {/* Chatbot IA — lazy-loaded, disponivel para usuarios autenticados */}
          {isAuthenticated && (
            <>
              <button
                onClick={() => setIsChatOpen(true)}
                aria-label="Abrir assistente IA"
                className={appStyles.chatFab}
              >
                <BotMessageSquare size={24} />
              </button>
              {isChatOpen && (
                <Suspense fallback={null}>
                  <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                </Suspense>
              )}
            </>
          )}

          {/* FAB móvel "Registrar Dose" — visível apenas mobile */}
          {isAuthenticated && (
            <button
              onClick={() => setIsDoseModalOpen(true)}
              aria-label="Registrar dose"
              className={appStyles.doseFab}
            >
              + Dose
            </button>
          )}

          {/* Modal global de registro de dose */}
          {isAuthenticated && isDoseModalOpen && (
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
