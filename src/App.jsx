import { useState, useEffect, lazy, Suspense } from 'react'
import { getCurrentUser, onAuthStateChange } from '@shared/utils/supabase'
import '@shared/styles/index.css'
import appStyles from './App.module.css'
import Auth from './views/Auth'
import Dashboard from './views/Dashboard'
import Loading from '@shared/components/ui/Loading'

// Lazy imports — carregam apenas quando a view é acessada
const Medicines = lazy(() => import('./views/Medicines'))
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
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))
import TestConnection from '@shared/components/TestConnection'
import BottomNav from '@shared/components/ui/BottomNav'
import { OnboardingProvider, OnboardingWizard } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'
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

function App() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [initialProtocolParams, setInitialProtocolParams] = useState(null)
  const [initialStockParams, setInitialStockParams] = useState(null)
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
    setInitialProtocolParams({ medicineId })
    setCurrentView('protocols')
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
            setCurrentView('landing')
          }}
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
            <Consultation onBack={() => setCurrentView('dashboard')} />
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
      default:
        return (
          <Dashboard
            onNavigate={(view, params) => {
              if (view === 'stock' && params?.medicineId) {
                setInitialStockParams({ medicineId: params.medicineId })
              } else if (view === 'protocols' && params?.medicineId) {
                setInitialProtocolParams({ medicineId: params.medicineId })
              }
              setCurrentView(view)
            }}
          />
        )
    }
  }

  return (
    <OnboardingProvider>
      <DashboardProvider>
        <div className="app-container">
          <main style={{ paddingBottom: '80px', minHeight: '100vh', position: 'relative' }}>
            {renderCurrentView()}

            <footer
              style={{
                textAlign: 'center',
                marginTop: 'var(--space-8)',
                paddingBottom: 'var(--space-8)',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {/*           <span 
              onClick={() => setShowDebug(!showDebug)} 
              style={{ 
                cursor: 'pointer', 
                opacity: 0.1, 
                fontSize: '10px',
                display: 'block',
                margin: '4px 0'
              }}
            >
              {showDebug ? '[-] hide debug' : '[+] check system'}
            </span>
    */}{' '}
            </footer>
          </main>

          <OfflineBanner />

          {isAuthenticated && (
            <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
          )}

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

          {/* Onboarding Wizard - apenas para usuários autenticados */}
          {isAuthenticated && <OnboardingWizard />}

          {/* PWA Install Prompt - para todos os usuários */}
          <InstallPrompt />
        </div>
      </DashboardProvider>
    </OnboardingProvider>
  )
}

export default App
