import { useOnboarding } from './useOnboarding'
import ProtocolForm from '@protocols/components/ProtocolForm'
import { cachedProtocolService } from '@services/api/cachedServices'
import './FirstProtocolStep.css'

export default function FirstProtocolStep() {
  const { onboardingData, updateOnboardingData, nextStep } = useOnboarding()
  const medicine = onboardingData.medicine

  if (!medicine) {
    return (
      <div className="first-protocol-step">
        <div className="error-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Medicamento não encontrado</h3>
          <p>Por favor, cadastre um medicamento primeiro.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="first-protocol-step">
      <div className="step-header">
        <div className="step-icon protocol-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 className="step-title">Crie seu primeiro protocolo</h3>
        <p className="step-description">
          Defina quando e como tomar <strong>{medicine.name}</strong>
        </p>
      </div>

      <ProtocolForm
        medicines={[medicine]}
        preselectedMedicine={medicine}
        initialValues={onboardingData.protocol}
        onSave={async (data) => {
          const saved = await cachedProtocolService.create({
            ...data,
            titration_status: 'estável',
            active: true,
          })
          updateOnboardingData('protocol', saved)
          return saved
        }}
        onSuccess={() => nextStep()}
        mode="simple"
        autoAdvance={true}
        title={`Crie seu primeiro protocolo para ${medicine.name}`}
        showTitration={false}
        showTreatmentPlan={false}
      />
    </div>
  )
}
