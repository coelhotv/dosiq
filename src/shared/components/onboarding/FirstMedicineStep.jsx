import { useOnboarding } from './useOnboarding'
import MedicineForm from '@medications/components/MedicineForm'
import { cachedMedicineService } from '@shared/services/cachedServices'
import './FirstMedicineStep.css'

export default function FirstMedicineStep() {
  const { updateOnboardingData, nextStep } = useOnboarding()

  const handleSave = async (data) => {
    const savedMedicine = await cachedMedicineService.create(data)
    // Salva no contexto do onboarding
    updateOnboardingData('medicine', savedMedicine)
    return savedMedicine
  }

  const handleSuccess = () => {
    nextStep()
  }

  return (
    <div className="first-medicine-step">
      <div className="step-header">
        <div className="step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h3 className="step-title">Cadastre seu primeiro medicamento</h3>
        <p className="step-description">
          Vamos começar cadastrando um medicamento. Você pode adicionar mais depois.
        </p>
      </div>

      <MedicineForm
        onSave={handleSave}
        onSuccess={handleSuccess}
        autoAdvance={true}
        showCancelButton={false}
        submitButtonLabel="Salvar e Continuar"
        title=""
      />
    </div>
  )
}
