import { useOnboarding } from './OnboardingProvider'
import WelcomeStep from './WelcomeStep'
import FirstMedicineStep from './FirstMedicineStep'
import FirstProtocolStep from './FirstProtocolStep'
import TelegramIntegrationStep from './TelegramIntegrationStep'
import Button from '../ui/Button'
import './OnboardingWizard.css'

export default function OnboardingWizard() {
  const {
    isOpen,
    isLoading,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding
  } = useOnboarding()

  if (isLoading || !isOpen) return null

  const steps = [
    { id: 0, name: 'Boas-vindas', component: WelcomeStep },
    { id: 1, name: 'Medicamento', component: FirstMedicineStep },
    { id: 2, name: 'Protocolo', component: FirstProtocolStep },
    { id: 3, name: 'Telegram', component: TelegramIntegrationStep }
  ]

  const CurrentStepComponent = steps[currentStep].component

  const handleSkip = async () => {
    await skipOnboarding()
  }

  const handleFinish = async () => {
    await completeOnboarding()
  }

  const isLastStep = currentStep === totalSteps - 1
  const isFirstStep = currentStep === 0

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {/* Progress Indicator */}
        <div className="onboarding-progress">
          <div className="progress-steps">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`progress-step ${
                  index < currentStep
                    ? 'completed'
                    : index === currentStep
                    ? 'active'
                    : ''
                }`}
              >
                <div className="step-number">
                  {index < currentStep ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="step-name">{step.name}</span>
                {index < steps.length - 1 && (
                  <div
                    className={`step-connector ${
                      index < currentStep ? 'completed' : ''
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="onboarding-content">
          <div className={`step-container step-${currentStep}`}>
            <CurrentStepComponent />
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="onboarding-navigation">
          <div className="nav-left">
            {!isFirstStep && (
              <Button
                variant="secondary"
                onClick={prevStep}
                className="btn-previous"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="icon-left"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Anterior
              </Button>
            )}
          </div>

          <div className="nav-center">
            <button
              onClick={handleSkip}
              className="btn-skip"
            >
              Pular tour
            </button>
          </div>

          <div className="nav-right">
            {isLastStep ? (
              <Button
                variant="primary"
                onClick={handleFinish}
                className="btn-finish"
              >
                Concluir
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="icon-right"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={nextStep}
                className="btn-next"
              >
                Próximo
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="icon-right"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}