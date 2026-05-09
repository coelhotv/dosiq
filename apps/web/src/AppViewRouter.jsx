/**
 * AppViewRouter — Roteador de views da aplicação.
 * Renderiza a view correta baseado em currentView e session.
 */
import { lazy, Suspense } from 'react'
import Auth from './views/Auth'

const Landing = lazy(() => import('./views/Landing'))
const Medicines = lazy(() => import('./views/redesign/Medicines'))
const Stock = lazy(() => import('./views/redesign/Stock'))
const Protocols = lazy(() => import('./views/Protocols'))
const HealthHistory = lazy(() => import('./views/redesign/HealthHistory'))
const Settings = lazy(() => import('./views/redesign/Settings'))
const Emergency = lazy(() => import('./views/redesign/Emergency'))
const Treatment = lazy(() => import('./views/redesign/Treatments'))
const Profile = lazy(() => import('./views/redesign/Profile'))
const Consultation = lazy(() => import('./views/redesign/Consultation'))
const DLQAdmin = lazy(() => import('./views/admin/DLQAdmin'))
const Dashboard = lazy(() => import('./views/redesign/Dashboard'))
const NotificationInbox = lazy(() => import('./views/redesign/NotificationInbox'))
const ResetPassword = lazy(() => import('./views/ResetPasswordView'))

const SKELETON = (
  <div
    role="status"
    style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: '14px' }}
    aria-busy="true"
    aria-label="Carregando view..."
  >
    <span className="sr-only">Carregando...</span>
  </div>
)

const W = (children) => <Suspense fallback={SKELETON}>{children}</Suspense>

export default function AppViewRouter({
  session,
  currentView,
  showAuth,
  initialProtocolParams,
  initialStockParams,
  initialTreatmentMedicineId,
  setShowAuth,
  setCurrentView,
  setInitialStockParams,
  setInitialProtocolParams,
  setInitialTreatmentMedicineId,
  setIsDoseModalOpen,
  setDoseModalInitialValues,
  isPasswordRecovery,
  onResetComplete,
}) {
  if (isPasswordRecovery) {
    return W(<ResetPassword onComplete={onResetComplete} />)
  }

  if (!session) {
    return showAuth ? (
      <Auth
        onAuthSuccess={() => { setShowAuth(false); setCurrentView('dashboard') }}
        onClose={() => setShowAuth(false)}
      />
    ) : W(<Landing isAuthenticated={false} onOpenAuth={() => setShowAuth(true)} />)
  }

  const navigateToProtocol = (medicineId) => { setInitialTreatmentMedicineId(medicineId); setCurrentView('treatment') }
  const navigateToStock = (medicineId) => { setInitialStockParams({ medicineId }); setCurrentView('stock') }

  switch (currentView) {
    case 'landing':
      return W(<Landing isAuthenticated={true} onOpenAuth={() => setShowAuth(true)} onContinue={() => setCurrentView('dashboard')} />)
    case 'medicines':
      return W(<Medicines onNavigateToProtocol={navigateToProtocol} />)
    case 'stock':
      return W(<Stock initialParams={initialStockParams} onClearParams={() => setInitialStockParams(null)} />)
    case 'protocols':
      return W(<Protocols initialParams={initialProtocolParams} onClearParams={() => setInitialProtocolParams(null)} onNavigateToStock={navigateToStock} />)
    case 'treatment':
      return W(<Treatment onNavigateToProtocol={() => setCurrentView('treatment')} onNavigate={setCurrentView} initialMedicineId={initialTreatmentMedicineId} onClearInitialMedicine={() => setInitialTreatmentMedicineId(null)} />)
    case 'profile':
      return W(<Profile onNavigate={setCurrentView} />)
    case 'health-history':
      return W(<HealthHistory key="health-history" onNavigate={setCurrentView} />)
    case 'history':
      return W(<HealthHistory key="history" onNavigate={setCurrentView} />)
    case 'consultation':
      return W(<Consultation onBack={() => setCurrentView('profile')} />)
    case 'settings':
      return W(<Settings onNavigate={setCurrentView} mode="notifications" />)
    case 'account-settings':
      return W(<Settings onNavigate={setCurrentView} mode="account" />)
    case 'emergency':
      return W(<Emergency onNavigate={setCurrentView} />)
    case 'admin-dlq':
      return W(<DLQAdmin />)
    case 'notifications':
      return W(
        <NotificationInbox
          userId={session?.id}
          onNavigate={setCurrentView}
          onBack={() => setCurrentView('dashboard')}
          onOpenDoseModal={(initialValues) => { setDoseModalInitialValues(initialValues); setIsDoseModalOpen(true) }}
        />
      )
    case 'dashboard':
    default: {
      const dashboardNavigate = (view, params) => {
        if (view === 'stock' && params?.medicineId) setInitialStockParams({ medicineId: params.medicineId })
        else if (view === 'protocols' && params?.medicineId) setInitialProtocolParams({ medicineId: params.medicineId })
        setCurrentView(view)
      }
      return W(<Dashboard onNavigate={dashboardNavigate} />)
    }
  }
}
