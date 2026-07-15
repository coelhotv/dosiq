/**
 * AppViewRouter — Roteador de views da aplicação.
 * Renderiza a view correta baseado em currentView e session.
 */
import { lazy, Suspense, useEffect } from 'react'
import Auth from './views/Auth'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { useConsentGate, isConsentAllowedView } from '@shared/hooks/useConsentGate'
import ConsentPrompt from '@features/consent/components/ConsentPrompt'

const Landing = lazy(() => import('./views/landing/Landing'))
const Medicines = lazy(() => import('./views/Medicines'))
const Stock = lazy(() => import('./views/Stock'))
const HealthHistory = lazy(() => import('./views/HealthHistory'))
const Settings = lazy(() => import('./views/Settings'))
const Emergency = lazy(() => import('./views/Emergency'))
const Treatment = lazy(() => import('./views/Treatments'))
const Profile = lazy(() => import('./views/Profile'))
const Consultation = lazy(() => import('./views/Consultation'))
const DLQAdmin = lazy(() => import('./views/admin/DLQAdmin'))
const FeedbackAdmin = lazy(() => import('./views/admin/FeedbackAdmin'))
const NudgesAdmin = lazy(() => import('./views/admin/NudgesAdmin'))
const Dashboard = lazy(() => import('./views/Dashboard'))
const NotificationInbox = lazy(() => import('./views/NotificationInbox'))
const ResetPassword = lazy(() => import('./views/ResetPasswordView'))
const ConsentResolution = lazy(() => import('./views/ConsentResolution'))

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
  medicines: (props) => <Medicines onNavigateToProtocol={props.navigateToProtocol} onBack={() => props.setCurrentView('treatment')} />,
  stock: (props) => <Stock initialParams={props.initialStockParams} onClearParams={() => props.setInitialStockParams(null)} />,
  treatment: (props) => {
    const TreatmentAny = Treatment as any
    return <TreatmentAny onNavigateToProtocol={props.navigateToProtocol} onNavigate={props.setCurrentView} initialMedicineId={props.initialTreatmentMedicineId} onClearInitialMedicine={() => props.setInitialTreatmentMedicineId(null)} />
  },
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
  // Alcançável pela allowlist mesmo com o app travado (é a saída da revogação, não um beco).
  'consent-resolution': (props) => (
    <ConsentResolution onNavigate={props.setCurrentView} onReconsented={props.onReconsented} />
  ),
};

function _renderViewContent(currentView, props) {
  // Spec 044 F3: bloqueia o render de /stock no MESMO frame em que ela deixou de ser
  // válida (o redirect via useEffect só corrige o estado no próximo tick) — sem isso
  // a tela de estoque pisca antes do redirect silencioso pro dashboard.
  if (currentView === 'stock' && props.stockTrackingReady && !props.stockTrackingEnabled) {
    return <Dashboard onNavigate={props.setCurrentView} />;
  }

  const renderer = VIEW_MAP[currentView];
  if (renderer) {
    return renderer(props);
  }

  const dashboardNavigate = (view, params) => {
    if (view === 'stock' && params?.medicineId) props.setInitialStockParams({ medicineId: params.medicineId });
    props.setCurrentView(view);
  };
  return <Dashboard onNavigate={dashboardNavigate} />;
}

export default function AppViewRouter({
  session,
  currentView,
  showAuth,
  initialStockParams,
  initialTreatmentMedicineId,
  setShowAuth,
  setCurrentView,
  setInitialStockParams,
  setInitialTreatmentMedicineId,
  setIsDoseModalOpen,
  setDoseModalInitialValues,
  isPasswordRecovery,
  onResetComplete,
}) {
  // Spec 044 F3: rota /stock não existe quando o controle de estoque está desligado —
  // redirect SILENCIOSO pro dashboard (decisão do PO, sem tela de erro/toast).
  // Hook sempre no topo (ordem R-010) — mesmo nos early-returns abaixo.
  const { enabled: stockTrackingEnabled, ready: stockTrackingReady } = useStockTracking()
  const consent = useConsentGate()

  useEffect(() => {
    if (stockTrackingReady && !stockTrackingEnabled && currentView === 'stock') {
      setCurrentView('dashboard')
    }
  }, [stockTrackingReady, stockTrackingEnabled, currentView, setCurrentView])

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

  // ── Gate de consentimento (046, T009) ────────────────────────────────────────────────────────
  // Ordem deliberada: carregando → indeterminado → travado → prompt. Cada ramo abaixo depende de o
  // anterior ter sido descartado.

  // 1. Bootstrap do gate ainda rodando: não dá para decidir nada sem o estado.
  if (!consent.ready) {
    return SKELETON
  }

  // 2. INDETERMINADO — não conseguimos LER a trilha. NÃO libera e NÃO bloqueia por conta própria:
  //    é falha de carregamento, não um fato sobre a vontade do titular. Tratar isto como `missing`
  //    (liberando com prompt) ressuscitaria, na materialização, um consentimento REVOGADO numa
  //    simples oscilação de rede — o furo HIGH do review do Slice A. Nada é escrito, nenhuma sessão
  //    de prompt é contada: só uma tela de erro com retry.
  if (consent.mode === 'indeterminate') {
    return (
      <div className="consent-gate-error" role="alert" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '360px' }}>
          Não foi possível verificar suas preferências de privacidade. Verifique sua conexão e tente de novo.
        </p>
        <button type="button" onClick={() => { consent.refresh() }} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
          Tentar de novo
        </button>
      </div>
    )
  }

  // 3. REVOGADO — app travado na tela de resolução. A trava respeita a ALLOWLIST (R2/F8): as rotas
  //    de export, conta e a própria resolução seguem alcançáveis. Allowlist, nunca denylist — uma
  //    denylist esquece uma rota e prende o titular numa tela sem export e sem exclusão, que são
  //    justamente os direitos que a revogação deveria tornar MAIS acessíveis.
  if (consent.mode === 'blocked_revoked' && !isConsentAllowedView(currentView)) {
    return W(<ConsentResolution onNavigate={setCurrentView} onReconsented={() => { consent.refresh(); setCurrentView('dashboard') }} />)
  }

  const navigateToProtocol = (medicineId) => { setInitialTreatmentMedicineId(medicineId); setCurrentView('treatment') }

  const viewProps = {
    session,
    setShowAuth,
    setCurrentView,
    initialStockParams,
    setInitialStockParams,
    initialTreatmentMedicineId,
    setInitialTreatmentMedicineId,
    setDoseModalInitialValues,
    setIsDoseModalOpen,
    navigateToProtocol,
    stockTrackingEnabled,
    stockTrackingReady,
    onReconsented: () => { consent.refresh(); setCurrentView('dashboard') },
  };

  const content = W(_renderViewContent(currentView, viewProps));

  // 4. NUNCA SE MANIFESTOU — prompt. Dispensável até a 3ª sessão (overlay POR CIMA do app, dá para
  //    fechar), bloqueante da 4ª em diante (substitui o app; a cortesia acabou). Nas rotas da
  //    allowlist o prompt não aparece: quem quer só exportar ou mexer na conta não é interrogado.
  const showPrompt =
    consent.mode === 'prompt_blocking' ||
    (consent.mode === 'prompt_dismissible' && !consent.dismissed)

  if (showPrompt && !isConsentAllowedView(currentView)) {
    const blocking = consent.mode === 'prompt_blocking'
    return (
      <>
        {!blocking && content}
        <ConsentPrompt
          blocking={blocking}
          onGrant={consent.grant}
          onDismiss={consent.dismiss}
          onGranted={() => { consent.refresh() }}
        />
      </>
    )
  }

  return content;
}
