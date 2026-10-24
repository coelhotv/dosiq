import React, { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useNotificationLog } from '@shared/hooks/useNotificationLog'
import { useUnreadNotificationCount } from '@shared/hooks/useUnreadNotificationCount'
import { StockTrackingProvider } from '@shared/hooks/useStockTracking'
import { ConsentGateProvider, useConsentGate } from '@shared/hooks/useConsentGate'
import AppViewRouter from './AppViewRouter'
import AppAuthOverlays from './AppAuthOverlays'
import { OnboardingProvider } from '@shared/components/onboarding'
import { DashboardProvider } from '@dashboard/hooks/useDashboardContext'
import InstallPrompt from '@shared/components/pwa/InstallPrompt'
import { OfflineBanner } from '@shared/components/ui/OfflineBanner'
import MobileAppBanner from '@shared/components/MobileAppBanner'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useDoseModalQueue } from '@shared/hooks/useDoseModalQueue'
import MeasureLogModal from '@features/measures/components/MeasureLogModal'
import { measuresRepo } from '@features/measures/services/measuresRepo'
import { registerPwa } from '@shared/components/pwa/pwaRegistration'

const BottomNav = lazy(() => import('@shared/components/ui/BottomNav'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))

export interface AuthenticatedShellProps {
  session: any
  isPasswordRecovery?: boolean
  onResetComplete?: () => void
}

/** Tratar navegação profunda via URL (clique em push notificações PWA) */
function useDeepLinkNavigation(
  userId: string | undefined,
  setCurrentView: (view: string) => void,
  setDoseModalInitialValues: (values: any) => void,
  setIsDoseModalOpen: (open: boolean) => void
) {
  useEffect(() => {
    if (!userId) return

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

    if (path !== '/' || params.toString() !== '') {
      window.history.replaceState({}, document.title, '/')
    }
  }, [userId, setCurrentView, setDoseModalInitialValues, setIsDoseModalOpen])
}

function AuthenticatedShellContent({
  session,
  isPasswordRecovery = false,
  onResetComplete = () => {},
}: AuthenticatedShellProps) {
  // 1. States & Refs (R-010)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isDoseModalOpen, setIsDoseModalOpen] = useState(false)
  const [doseModalInitialValues, setDoseModalInitialValues] = useState<any>(null)
  const [isMeasureModalOpen, setIsMeasureModalOpen] = useState(false)
  const [initialStockParams, setInitialStockParams] = useState<any>(null)
  const [initialTreatmentMedicineId, setInitialTreatmentMedicineId] = useState<string | null>(null)
  // 096: "Não concordo" no reconsentimento vive AQUI, não no AppViewRouter
  const [regularizationDeclined, setRegularizationDeclined] = useState(false)

  // 2. Context & Custom Hooks (R-010)
  const shouldReduceMotion = useReducedMotion()
  const { locked: consentLocked, needsRegularization } = useConsentGate()
  const { data: notifData } = useNotificationLog({ userId: session?.id, limit: 30, enabled: !!session?.id })
  const { unreadCount } = useUnreadNotificationCount(notifData)
  const closeDoseModal = useDoseModalQueue(setIsDoseModalOpen, setDoseModalInitialValues)

  // 3. Effects & Handlers (R-010)
  useDeepLinkNavigation(session?.id, setCurrentView, setDoseModalInitialValues, setIsDoseModalOpen)

  // 012 Fase C / FR-010: registro de medida pelo speed-dial global
  const handleSaveMeasure = async (payload: any) => {
    const saved = await measuresRepo.create(payload)
    window.dispatchEvent(new CustomEvent('mr:measure-saved'))
    return saved
  }

  // Nudge "Registre a primeira" (card vazio do dashboard) abre o modal global de medida
  useEffect(() => {
    const open = () => setIsMeasureModalOpen(true)
    window.addEventListener('mr:open-measure-log', open)
    return () => window.removeEventListener('mr:open-measure-log', open)
  }, [])

  // Dispara registro do service worker e manifesto estático com sessão (PO-110-7)
  useEffect(() => {
    registerPwa()
  }, [])

  return (
    <OnboardingProvider>
      <DashboardProvider>
        <a href="#main-content" className="skip-to-content">Ir para conteúdo principal</a>

        <div className="app-container">
          <MobileAppBanner />

          <Suspense fallback={null}>
            <Sidebar
              currentView={currentView}
              setCurrentView={setCurrentView}
              onRegisterDose={() => setIsDoseModalOpen(true)}
              onRegisterMeasure={() => setIsMeasureModalOpen(true)}
              unreadCount={unreadCount}
              consentLocked={consentLocked}
            />
          </Suspense>

          <main id="main-content" className="app-main main-with-sidebar">
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
                  showAuth={false}
                  isPasswordRecovery={isPasswordRecovery}
                  onResetComplete={onResetComplete}
                  initialStockParams={initialStockParams}
                  initialTreatmentMedicineId={initialTreatmentMedicineId}
                  setShowAuth={() => {}}
                  setCurrentView={setCurrentView}
                  setInitialStockParams={setInitialStockParams}
                  setInitialTreatmentMedicineId={setInitialTreatmentMedicineId}
                  setIsDoseModalOpen={setIsDoseModalOpen}
                  setDoseModalInitialValues={setDoseModalInitialValues}
                  regularizationDeclined={regularizationDeclined}
                  setRegularizationDeclined={setRegularizationDeclined}
                />
              </motion.div>
            </AnimatePresence>
            <footer style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingBottom: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
              {' '}
            </footer>
          </main>

          <OfflineBanner />

          {!isPasswordRecovery && !consentLocked && (
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

          {!isPasswordRecovery && !consentLocked && !needsRegularization && (
            <AppAuthOverlays
              isChatOpen={isChatOpen}
              setIsChatOpen={setIsChatOpen}
              isDoseModalOpen={isDoseModalOpen}
              setIsDoseModalOpen={setIsDoseModalOpen}
              doseModalInitialValues={doseModalInitialValues}
              setDoseModalInitialValues={setDoseModalInitialValues}
              closeDoseModal={closeDoseModal}
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

export default function AuthenticatedShell({
  session,
  isPasswordRecovery = false,
  onResetComplete = () => {},
}: AuthenticatedShellProps) {
  return (
    <ConsentGateProvider session={session}>
      <StockTrackingProvider session={session}>
        <AuthenticatedShellContent
          session={session}
          isPasswordRecovery={isPasswordRecovery}
          onResetComplete={onResetComplete}
        />
      </StockTrackingProvider>
    </ConsentGateProvider>
  )
}
