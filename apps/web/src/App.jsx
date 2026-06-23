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
import MobileAppBanner from '@shared/components/MobileAppBanner'
import { SpeedInsights } from '@vercel/speed-insights/react'
import MeasureLogModal from '@features/measures/components/MeasureLogModal'
import { measuresRepo } from '@features/measures/services/measuresRepo'

const BottomNav = lazy(() => import('@shared/components/ui/BottomNav'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))

function AppLoading() {
  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Loading text="Carregando..." />
    </div>
  )
}

function AppShell({
  isAuthenticated,
  isPasswordRecovery,
  currentView,
  setCurrentView,
  unreadCount,
  setIsDoseModalOpen,
  setIsMeasureModalOpen,
  session,
  showAuth,
  setShowAuth,
  onResetComplete,
  initialStockParams,
  initialTreatmentMedicineId,
  setInitialStockParams,
  setInitialTreatmentMedicineId,
  isDoseModalOpen,
  doseModalInitialValues,
  setDoseModalInitialValues,
  isMeasureModalOpen,
  handleSaveMeasure,
  isChatOpen,
  setIsChatOpen,
  shouldReduceMotion
}) {
  return (
    <OnboardingProvider>
      <DashboardProvider>
        <a href="#main-content" className="skip-to-content">Ir para conteúdo principal</a>

        <div className="app-container">
          <MobileAppBanner />

          {isAuthenticated && (
            <Suspense fallback={null}>
              <Sidebar currentView={currentView} setCurrentView={setCurrentView} onRegisterDose={() => setIsDoseModalOpen(true)} onRegisterMeasure={() => setIsMeasureModalOpen(true)} unreadCount={unreadCount} />
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
                  isPasswordRecovery={isPasswordRecovery}
                  onResetComplete={onResetComplete}
                  initialStockParams={initialStockParams}
                  initialTreatmentMedicineId={initialTreatmentMedicineId}
                  setShowAuth={setShowAuth}
                  setCurrentView={setCurrentView}
                  setInitialStockParams={setInitialStockParams}
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

          {isAuthenticated && !isPasswordRecovery && (
            <Suspense fallback={null}>
              <BottomNav currentView={currentView} setCurrentView={setCurrentView} unreadCount={unreadCount} />
            </Suspense>
          )}

          {isMeasureModalOpen && (
            <MeasureLogModal
              isOpen={isMeasureModalOpen}
              onClose={() => setIsMeasureModalOpen(false)}
              onSaved={handleSaveMeasure}
            />
          )}

          {isAuthenticated && !isPasswordRecovery && (
            <AppAuthOverlays
              isChatOpen={isChatOpen}
              setIsChatOpen={setIsChatOpen}
              isDoseModalOpen={isDoseModalOpen}
              setIsDoseModalOpen={setIsDoseModalOpen}
              doseModalInitialValues={doseModalInitialValues}
              setDoseModalInitialValues={setDoseModalInitialValues}
              onRegisterMeasure={() => setIsMeasureModalOpen(true)}
            />
          )}

          <InstallPrompt />
          {import.meta.env.PROD && <SpeedInsights />}
        </div>
      </DashboardProvider>
    </OnboardingProvider>
  )
}

function AppInner() {
  const shouldReduceMotion = useReducedMotion()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isDoseModalOpen, setIsDoseModalOpen] = useState(false)
  const [doseModalInitialValues, setDoseModalInitialValues] = useState(null)
  const [isMeasureModalOpen, setIsMeasureModalOpen] = useState(false)
  const [initialStockParams, setInitialStockParams] = useState(null)
  const [initialTreatmentMedicineId, setInitialTreatmentMedicineId] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // 012 Fase C / FR-010: registro de medida pelo speed-dial global. Salva e avisa as
  // superfícies (dashboard/histórico) via evento — mesmo padrão de 'mr:dose-saved'.
  const handleSaveMeasure = async (payload) => {
    const saved = await measuresRepo.create(payload)
    window.dispatchEvent(new CustomEvent('mr:measure-saved'))
    return saved
  }

  // Nudge "Registre a primeira" (card vazio do dashboard) abre o modal global de medida.
  useEffect(() => {
    const open = () => setIsMeasureModalOpen(true)
    window.addEventListener('mr:open-measure-log', open)
    return () => window.removeEventListener('mr:open-measure-log', open)
  }, [])

  const { data: notifData } = useNotificationLog({ userId: session?.id, limit: 30, enabled: !!session?.id })
  const { unreadCount } = useUnreadNotificationCount(notifData)

  useEffect(() => {
    getCurrentUser()
      .then((user) => { setSession(user); setIsLoading(false) })
      .catch(() => { setSession(null); setIsLoading(false) })

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      const isRecoveryFlow = localStorage.getItem('@dosiq/recovery-flow')
      if (event === 'PASSWORD_RECOVERY' || isRecoveryFlow === 'true') {
        localStorage.removeItem('@dosiq/recovery-flow')
        setIsPasswordRecovery(true)
        setSession(session?.user ?? null)

        // Limpar o hash da URL para evitar re-gatilhos do fluxo de recuperação em reloads/signouts
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, null, window.location.pathname + window.location.search)
        }
        return
      }

      try {
        const isRecoveryFlow = localStorage.getItem('@dosiq/recovery-flow')
        if (isRecoveryFlow === 'true') {
          localStorage.removeItem('@dosiq/recovery-flow')
          setIsPasswordRecovery(true)
          setSession(session?.user ?? null)

          // Limpar o hash da URL para evitar re-gatilhos do fluxo de recuperação em reloads/signouts
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, null, window.location.pathname + window.location.search)
          }
          return
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao acessar localStorage no fluxo de recuperação:', error)
        }
      }

      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
        // Verificar race condition (PWA + aba concorrente) antes de deslogar
        const { data: { session: latestSession } } = await supabase.auth.getSession()
        setSession(latestSession?.user ?? null)
        return
      }
      setSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Tratar navegação profunda via URL (clique em push notificações PWA)
  // Justificativa: Precisamos de setState no useEffect para ler queries da URL no mount/auth e navegar a view
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!session?.id) return

    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)

    if (path === '/stock') {
      setCurrentView('stock')
    } else if (path === '/history' || path === '/health-history') {
      setCurrentView('history')
    } else if (path === '/settings') {
      setCurrentView('settings')
    } else if (path === '/notifications') {
      setCurrentView('notifications')
    } else if (path === '/admin-dlq') {
      setCurrentView('admin-dlq')
    } else if (path === '/admin-nudges') {
      setCurrentView('admin-nudges')
    } else if (path === '/today' || path === '/') {
      setCurrentView('dashboard')

      const protocolId = params.get('protocolId')
      if (protocolId) {
        setDoseModalInitialValues({ protocol_id: protocolId, type: 'protocol' })
        setIsDoseModalOpen(true)
      } else if (params.get('bulkMode') === 'plan') {
        const planId = params.get('planId')
        if (planId) {
          setDoseModalInitialValues({ treatment_plan_id: planId, type: 'plan' })
          setIsDoseModalOpen(true)
        }
      } else if (params.get('bulkMode') === 'misc') {
        const pids = params.get('protocolIds')
        const protocolIds = pids ? pids.split(',') : []
        if (protocolIds.length > 0) {
          setDoseModalInitialValues({ protocol_id: protocolIds[0], type: 'protocol' })
          setIsDoseModalOpen(true)
        }
      }
    }

    // Limpar o caminho e query params da URL para evitar reprocessamento ou inconsistências de estado
    if (path !== '/' || params.toString() !== '') {
      window.history.replaceState({}, document.title, '/')
    }
    // Gatear por session?.id (não pelo objeto session): token refresh no refocus cria
    // novo objeto com o MESMO user.id, que re-disparava o effect e resetava a view (AP-192).
    // Login/confirmação de email/reset de senha são transições null→id → seguem disparando.
  }, [session?.id])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (isLoading) {
    return <AppLoading />
  }

  return (
    <AppShell
      isAuthenticated={!!session}
      isPasswordRecovery={isPasswordRecovery}
      currentView={currentView}
      setCurrentView={setCurrentView}
      unreadCount={unreadCount}
      setIsDoseModalOpen={setIsDoseModalOpen}
      setIsMeasureModalOpen={setIsMeasureModalOpen}
      session={session}
      showAuth={showAuth}
      setShowAuth={setShowAuth}
      onResetComplete={() => { setIsPasswordRecovery(false); setCurrentView('dashboard') }}
      initialStockParams={initialStockParams}
      initialTreatmentMedicineId={initialTreatmentMedicineId}
      setInitialStockParams={setInitialStockParams}
      setInitialTreatmentMedicineId={setInitialTreatmentMedicineId}
      isDoseModalOpen={isDoseModalOpen}
      doseModalInitialValues={doseModalInitialValues}
      setDoseModalInitialValues={setDoseModalInitialValues}
      isMeasureModalOpen={isMeasureModalOpen}
      handleSaveMeasure={handleSaveMeasure}
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
      shouldReduceMotion={shouldReduceMotion}
    />
  )
}

function App() {
  return <AppInner />
}

export default App
