import Button from '@shared/components/ui/Button'
import { FREQUENCY_LABELS } from '@schemas/protocolSchema'
import { formatActiveIngredientHint } from '@dosiq/core'

export default function TreatmentWizardStep4({
  result,
  medicineData,
  protocolData,
  stockData,
  onComplete,
  resetWizard,
}) {
  if (!result) return null

  return (
    <div className="wizard__step wizard__step--complete">
      <div className="wizard__complete-icon">✅</div>
      <h3 className="wizard__title">Pronto!</h3>
      <p className="wizard__complete-summary">
        <strong>{result.medicine?.name || medicineData.name}</strong> cadastrado
        {result.protocol && ` com tratamento ${FREQUENCY_LABELS[protocolData.frequency]}`}
        {stockData.quantity && ` e ${formatActiveIngredientHint(stockData.quantity, result.medicine?.dosage_per_pill, result.medicine?.dosage_unit) || `${stockData.quantity} un.`} em estoque`}.
      </p>
      <div className="wizard__actions wizard__actions--center">
        <Button variant="primary" onClick={() => onComplete(result)}>
          Ir para Hoje
        </Button>
        <Button variant="ghost" onClick={resetWizard}>
          Cadastrar outro
        </Button>
      </div>
    </div>
  )
}
