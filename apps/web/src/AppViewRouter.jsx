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
const FeedbackAdmin = lazy(() => import('./views/admin/FeedbackAdmin'))
const NudgesAdmin = lazy(() => import('./views/admin/NudgesAdmin'))
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

const VIEW_MAP = {
  landing: (props) => <Landing isAuthenticated={true} onOpenAuth={() => props.setShowAuth(true)} onContinue={() => props.setCurrentView('dashboard')} />,
  medicines: (props) => <Medicines onNavigateToProtocol={props.navigateToProtocol} />,
  stock: (props) => <Stock initialParams={props.initialStockParams} onClearParams={() => props.setInitialStockParams(null)} />,
  protocols: (props) => <Protocols initialParams={props.initialProtocolParams} onClearParams={() => props.setInitialProtocolParams(null)} onNavigateToStock={props.navigateToStock} />,
  treatment: (props) => <Treatment onNavigateToProtocol={() => props.setCurrentView('treatment')} onNavigate={props.setCurrentView} initialMedicineId={props.initialTreatmentMedicineId} onClearInitialMedicine={() => props.setInitialTreatmentMedicineId(null)} />,
  profile: (props) => <Profile onNavigate={props.setCurrentView} />,
  'health-history': (props) => <HealthHistory key="health-history" onNavigate={props.setCurrentView} />,
  history: (props) => <HealthHistory key="history" onNavigate={props.setCurrentView} />,
  consultation: (props) => <Consultation onBack={() => props.setCurrentView('profile')} />,
  settings: (props) => <Settings onNavigate={props.setCurrentView} mode="notifications" />,
  'account-settings': (props) => <Settings onNavigate={props.setCurrentView} mode="account" />,
  emergency: (props) => <Emergency onNavigate={props.setCurrentView} />,
  'admin-dlq': () => <DLQAdmin />,
  'admin-feedbacks': (props) => <FeedbackAdmin onBack={() => props.setCurrentView('account-settings')} />,
  'admin-nudges': (props) => <NudgesAdmin onBack={() => props.setCurrentView('account-settings')} />,
  notifications: (props) => (
    <NotificationInbox
      userId={props.session?.id}
      onNavigate={props.setCurrentView}
      onBack={() => props.setCurrentView('dashboard')}
      onOpenDoseModal={(initialValues) => { props.setDoseModalInitialValues(initialValues); props.setIsDoseModalOpen(true) }}
    />
  ),
};

function _renderViewContent(currentView, props) {
  const renderer = VIEW_MAP[currentView];
  if (renderer) {
    return renderer(props);
  }

  const dashboardNavigate = (view, params) => {
    if (view === 'stock' && params?.medicineId) props.setInitialStockParams({ medicineId: params.medicineId });
    else if (view === 'protocols' && params?.medicineId) props.setInitialProtocolParams({ medicineId: params.medicineId });
    props.setCurrentView(view);
  };
  return <Dashboard onNavigate={dashboardNavigate} />;
}

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
        defaultLogin={false}
        onAuthSuccess={() => { setShowAuth(false); setCurrentView('dashboard') }}
        onClose={() => setShowAuth(false)}
      />
    ) : W(<Landing isAuthenticated={false} onOpenAuth={() => setShowAuth(true)} />)
  }

  const navigateToProtocol = (medicineId) => { setInitialTreatmentMedicineId(medicineId); setCurrentView('treatment') }
  const navigateToStock = (medicineId) => { setInitialStockParams({ medicineId }); setCurrentView('stock') }

  const viewProps = {
    session,
    setShowAuth,
    setCurrentView,
    initialStockParams,
    setInitialStockParams,
    initialProtocolParams,
    setInitialProtocolParams,
    initialTreatmentMedicineId,
    setInitialTreatmentMedicineId,
    setDoseModalInitialValues,
    setIsDoseModalOpen,
    navigateToProtocol,
    navigateToStock
  };

  return W(_renderViewContent(currentView, viewProps));
}
