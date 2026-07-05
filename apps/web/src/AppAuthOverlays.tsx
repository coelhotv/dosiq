/**
 * AppAuthOverlays — FABs, modais e wizard de onboarding para usuários autenticados.
 */
import { Suspense, lazy } from 'react'
import { BotMessageSquare } from 'lucide-react'
import { OnboardingWizard } from '@shared/components/onboarding'
import RegisterSpeedDial from '@shared/components/ui/RegisterSpeedDial'
import appStyles from './App.module.css'

const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))
const GlobalDoseModal = lazy(() => import('@shared/components/ui/GlobalDoseModal'))

export default function AppAuthOverlays({
  isChatOpen,
  setIsChatOpen,
  isDoseModalOpen,
  setIsDoseModalOpen,
  doseModalInitialValues,
  setDoseModalInitialValues,
  onRegisterMeasure,
}) {
  return (
    <>
      {/* Chatbot IA */}
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

      {/* FAB móvel — speed-dial (dose + medida), 012 Fase C / FR-010b. Posição do antigo "+ Dose". */}
      <RegisterSpeedDial
        variant="floating"
        onRegisterDose={() => setIsDoseModalOpen(true)}
        onRegisterMeasure={onRegisterMeasure}
      />

      {/* Modal global de registro de dose */}
      {isDoseModalOpen && (
        <Suspense fallback={null}>
          <GlobalDoseModal
            isOpen={isDoseModalOpen}
            initialValues={doseModalInitialValues}
            onClose={() => { setIsDoseModalOpen(false); setDoseModalInitialValues(null) }}
          />
        </Suspense>
      )}

      {/* Onboarding Wizard */}
      <OnboardingWizard />
    </>
  )
}
