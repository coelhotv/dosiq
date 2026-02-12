import { useState, useEffect } from 'react'
import { getCurrentUser, onAuthStateChange } from '@shared/utils/supabase'
import '@shared/styles/index.css'
import Auth from './views/Auth'
import Medicines from './views/Medicines'
import Stock from './views/Stock'
import Protocols from './views/Protocols'
import Dashboard from './views/Dashboard'
import History from './views/History'
import Settings from './views/Settings'
import TestConnection from '@shared/components/TestConnection'
import BottomNav from '@shared/components/ui/BottomNav'
import Loading from '@shared/components/ui/Loading'
import Landing from './views/Landing'
import { OnboardingProvider, OnboardingWizard } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'

function App() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [initialProtocolParams, setInitialProtocolParams] = useState(null)
  const [initialStockParams, setInitialStockParams] = useState(null)
  const [showAuth, setShowAuth] = useState(false) // toggles auth UI for unauthenticated visitors

  useEffect(() => {
    // Check initial session
    getCurrentUser().then(user => {
      setSession(user)
      setIsLoading(false)
    }).catch(() => {
      setSession(null)
      setIsLoading(false)
    })

    // Listen for changes
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
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
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loading text="Carregando..." />
      </div>
    )
  }

  const isAuthenticated = !!session;

  const renderCurrentView = () => {
    if (!session) {
      return showAuth ? (
        <Auth onAuthSuccess={() => { setShowAuth(false); setCurrentView('landing') }} />
      ) : (
        <Landing
          isAuthenticated={false}
          onOpenAuth={() => setShowAuth(true)}
        />
      )
    }

    switch (currentView) {
      case 'landing':
        return (
          <Landing
            isAuthenticated={isAuthenticated}
            onOpenAuth={() => setShowAuth(true)}
            onContinue={() => setCurrentView('dashboard')}
          />
        )
      case 'medicines':
        return <Medicines onNavigateToProtocol={navigateToProtocol} />
      case 'stock':
        return (
          <Stock 
            initialParams={initialStockParams}
            onClearParams={() => setInitialStockParams(null)}
          />
        )
      case 'protocols':
        return (
          <Protocols 
            initialParams={initialProtocolParams} 
            onClearParams={() => setInitialProtocolParams(null)}
            onNavigateToStock={navigateToStock}
          />
        )
      case 'history':
        return <History />
      case 'settings':
        return <Settings />
      case 'dashboard':
      default:
        return (
          <Dashboard onNavigate={(view, params) => {
            if (view === 'stock' && params?.medicineId) {
              setInitialStockParams({ medicineId: params.medicineId })
            } else if (view === 'protocols' && params?.medicineId) {
              setInitialProtocolParams({ medicineId: params.medicineId })
            }
            setCurrentView(view)
          }} />
        )
    }
  }

  return (
    <OnboardingProvider>
      <DashboardProvider>
        <div className="app-container">
          <main style={{ paddingBottom: '80px', minHeight: '100vh', position: 'relative' }}>
            {renderCurrentView()}

            <footer style={{
            textAlign: 'center',
            marginTop: 'var(--space-8)',
            paddingBottom: 'var(--space-8)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--font-size-sm)'
          }}>
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
    */}        </footer>
        </main>

        {isAuthenticated && <BottomNav currentView={currentView} setCurrentView={setCurrentView} />}
        
        {/* Onboarding Wizard - apenas para usuários autenticados */}
          {isAuthenticated && <OnboardingWizard />}
        </div>
      </DashboardProvider>
    </OnboardingProvider>
  )
}

export default App
