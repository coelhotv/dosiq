import Button from '@shared/components/ui/Button'
import { useLogFormState } from './_useLogFormState.js'
import LogFormTimeSection from './sections/LogFormTimeSection'
import LogFormMedicineSection from './sections/LogFormMedicineSection'
import './LogForm.css'

export default function LogForm({
  protocols,
  treatmentPlans = [],
  initialValues,
  onSave,
  onCancel,
}) {
  const {
    formData,
    setFormData,
    errors,
    isSubmitting,
    selectedProtocol,
    selectedPlan,
    selectedPlanProtocols,
    handleChange,
    toggleProtocol,
    handleSubmit,
  } = useLogFormState({ protocols, treatmentPlans, initialValues, onSave })

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      <h3>Registrar Medicamento Tomado</h3>

      <LogFormMedicineSection
        formData={formData}
        setFormData={setFormData}
        protocols={protocols}
        treatmentPlans={treatmentPlans}
        errors={errors}
        handleChange={handleChange}
        selectedProtocol={selectedProtocol}
        selectedPlan={selectedPlan}
        selectedPlanProtocols={selectedPlanProtocols}
        toggleProtocol={toggleProtocol}
      />

      <LogFormTimeSection formData={formData} handleChange={handleChange} />

      <div className="form-group">
        <label htmlFor="notes">Observações (opcional)</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Ex: Tomei com água, após café da manhã..."
          rows="3"
        />
      </div>

      {errors.submit && <div className="error-banner">❌ {errors.submit}</div>}

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            isSubmitting ||
            (formData.type === 'protocol'
              ? !formData.protocol_id
              : !formData.treatment_plan_id || selectedPlanProtocols.length === 0)
          }
        >
          {isSubmitting
            ? 'Salvando...'
            : formData.id
              ? 'Atualizar Registro'
              : formData.type === 'plan' && selectedPlanProtocols.length > 0
                ? `Registrar (${selectedPlanProtocols.length})`
                : 'Registrar Dose'}
        </Button>
      </div>
    </form>
  )
}
