/**
 * AppAuthOverlays — FABs, modais e wizard de onboarding para usuários autenticados.
 */
import { Suspense } from 'react'
import { lazy } from 'react'
import { BotMessageSquare } from 'lucide-react'
import { OnboardingWizard } from '@shared/components/onboarding'
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

      {/* FAB móvel "Registrar Dose" */}
      <button
        onClick={() => setIsDoseModalOpen(true)}
        aria-label="Registrar dose"
        className={appStyles.doseFab}
      >
        + Dose
      </button>

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
