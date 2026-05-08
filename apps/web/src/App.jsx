import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { getCurrentUser, onAuthStateChange, supabase } from '@shared/utils/supabase'
import { useNotificationLog } from '@shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '@shared/hooks/useUnreadNotificationCount'
import '@shared/styles/index.css'
import Loading from '@shared/components/ui/Loading'
import AppViewRouter from './AppViewRouter'
import AppAuthOverlays from './AppAuthOverlays'
import TestConnection from '@shared/components/TestConnection'
import { OnboardingProvider } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'
import InstallPrompt from '@shared/components/pwa/InstallPrompt'
import { OfflineBanner } from '@shared/components/ui/OfflineBanner'

const BottomNavRedesign = lazy(() => import('@shared/components/ui/BottomNavRedesign'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))

function AppInner() {
  const shouldReduceMotion = useReducedMotion()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isDoseModalOpen, setIsDoseModalOpen] = useState(false)
  const [doseModalInitialValues, setDoseModalInitialValues] = useState(null)
  const [initialProtocolParams, setInitialProtocolParams] = useState(null)
  const [initialStockParams, setInitialStockParams] = useState(null)
  const [initialTreatmentMedicineId, setInitialTreatmentMedicineId] = useState(null)
  const [showAuth, setShowAuth] = useState(false)

  const { data: notifData } = useNotificationLog({ userId: session?.id, limit: 30, enabled: !!session?.id })
  const { unreadCount } = useUnreadNotificationCount(notifData)

  useEffect(() => {
    getCurrentUser()
      .then((user) => { setSession(user); setIsLoading(false) })
      .catch(() => { setSession(null); setIsLoading(false) })

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Verificar race condition (PWA + aba concorrente) antes de deslogar
        const { data: { session: latestSession } } = await supabase.auth.getSession()
        setSession(latestSession?.user ?? null)
        return
      }
      setSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loading text="Carregando..." />
      </div>
    )
  }

  const isAuthenticated = !!session

  return (
    <OnboardingProvider>
      <DashboardProvider>
        <a href="#main-content" className="skip-to-content">Ir para conteúdo principal</a>

        <div className="app-container">
          {isAuthenticated && (
            <Suspense fallback={null}>
              <Sidebar currentView={currentView} setCurrentView={setCurrentView} onNewDose={() => setIsDoseModalOpen(true)} unreadCount={unreadCount} />
            </Suspense>
          )}

          <main id="main-content" className={isAuthenticated ? 'app-main main-with-sidebar' : 'app-main'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentView}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              >
                <AppViewRouter
                  session={session}
                  currentView={currentView}
                  showAuth={showAuth}
                  initialProtocolParams={initialProtocolParams}
                  initialStockParams={initialStockParams}
                  initialTreatmentMedicineId={initialTreatmentMedicineId}
                  setShowAuth={setShowAuth}
                  setCurrentView={setCurrentView}
                  setInitialStockParams={setInitialStockParams}
                  setInitialProtocolParams={setInitialProtocolParams}
                  setInitialTreatmentMedicineId={setInitialTreatmentMedicineId}
                  setIsDoseModalOpen={setIsDoseModalOpen}
                  setDoseModalInitialValues={setDoseModalInitialValues}
                />
              </motion.div>
            </AnimatePresence>
            <footer style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingBottom: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
              {' '}
            </footer>
          </main>

          <OfflineBanner />

          {isAuthenticated && (
            <Suspense fallback={null}>
              <BottomNavRedesign currentView={currentView} setCurrentView={setCurrentView} unreadCount={unreadCount} />
            </Suspense>
          )}

          {isAuthenticated && (
            <AppAuthOverlays
              isChatOpen={isChatOpen}
              setIsChatOpen={setIsChatOpen}
              isDoseModalOpen={isDoseModalOpen}
              setIsDoseModalOpen={setIsDoseModalOpen}
              doseModalInitialValues={doseModalInitialValues}
              setDoseModalInitialValues={setDoseModalInitialValues}
            />
          )}

          <InstallPrompt />
        </div>
      </DashboardProvider>
    </OnboardingProvider>
  )
}

function App() {
  return <AppInner />
}

export default App
