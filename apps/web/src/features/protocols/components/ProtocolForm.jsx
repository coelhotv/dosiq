import Button from '@shared/components/ui/Button'
import { useProtocolFormState } from '@protocols/hooks/useProtocolFormState'
import ProtocolFormBasicSection from '@protocols/components/sections/ProtocolFormBasicSection'
import ProtocolFormDosesSection from '@protocols/components/sections/ProtocolFormDosesSection'
import ProtocolFormAdvancedSection from '@protocols/components/sections/ProtocolFormAdvancedSection'
import '@protocols/components/ProtocolForm.css'

const SuccessMessage = ({ isSimpleMode }) => (
  <div className="success-message">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{isSimpleMode ? 'Tratamento criado com sucesso!' : 'Tratamento salvo com sucesso!'}</span>
  </div>
)

const ErrorBanner = ({ error, isSimpleMode }) => (
  <div className={`error-banner ${isSimpleMode ? 'error-alert' : ''}`}>
    {isSimpleMode ? (
      <>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{error}</span>
      </>
    ) : (
      <>❌ {error}</>
    )}
  </div>
)

const SubmitButton = ({ isSubmitting, isSimpleMode, hasProtocol }) => {
  if (isSubmitting) {
    if (isSimpleMode) {
      return (
        <>
          <span className="spinner"></span>
          Criando...
        </>
      )
    }
    return 'Salvando...'
  }
  
  if (isSimpleMode) {
    return (
      <>
        Criar Protocolo
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="icon-right"
          style={{ marginLeft: '8px', width: '16px', height: '16px' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </>
    )
  }
  
  return hasProtocol ? 'Atualizar' : 'Criar Tratamento'
}

export default function ProtocolForm({
  medicines,
  treatmentPlans = [],
  protocol,
  initialValues,
  onSave,
  onCancel,
  onSuccess,
  mode = 'full',
  autoAdvance = false,
  preselectedMedicine = null,
  title,
  showTitration = true,
  showTreatmentPlan = true,
}) {
  const isSimpleMode = mode === 'simple'

  const {
    formData,
    enableTitration,
    timeInput,
    errors,
    isSubmitting,
    shakeFields,
    saveSuccess,
    handleChange,
    setTimeInput,
    addTime,
    removeTime,
    handleSubmit,
    handleTitrationEnable,
    setTitrationSchedule,
  } = useProtocolFormState({
    protocol,
    initialValues,
    preselectedMedicine,
    isSimpleMode,
    onSave,
    onSuccess,
    autoAdvance,
  })

  const formTitle = title || (protocol ? 'Editar Tratamento' : 'Novo Tratamento')

  return (
    <form
      className={`protocol-form ${isSimpleMode ? 'protocol-form-simple' : ''}`}
      onSubmit={handleSubmit}
      style={{ paddingBottom: isSimpleMode ? '0' : '80px' }}
    >
      <h3>{formTitle}</h3>

      {saveSuccess && !isSimpleMode && <SuccessMessage isSimpleMode={false} />}

      <ProtocolFormBasicSection
        formData={formData}
        handleChange={handleChange}
        shakeFields={shakeFields}
        errors={errors}
        isSimpleMode={isSimpleMode}
        medicines={medicines}
        treatmentPlans={treatmentPlans}
        protocol={protocol}
        showTreatmentPlan={showTreatmentPlan}
      />

      <ProtocolFormDosesSection
        formData={formData}
        handleChange={handleChange}
        shakeFields={shakeFields}
        errors={errors}
        timeInput={timeInput}
        setTimeInput={setTimeInput}
        addTime={addTime}
        removeTime={removeTime}
      />

      <ProtocolFormAdvancedSection
        formData={formData}
        handleChange={handleChange}
        enableTitration={enableTitration}
        handleTitrationEnable={handleTitrationEnable}
        setTitrationSchedule={setTitrationSchedule}
        isSimpleMode={isSimpleMode}
        showTitration={showTitration}
      />

      {saveSuccess && isSimpleMode && <SuccessMessage isSimpleMode={true} />}

      {errors.submit && <ErrorBanner error={errors.submit} isSimpleMode={isSimpleMode} />}

      <div className={`form-actions ${isSimpleMode ? 'form-actions-simple' : ''}`}>
        {!isSimpleMode && onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className={isSimpleMode ? 'btn-save' : ''}
        >
          <SubmitButton 
            isSubmitting={isSubmitting} 
            isSimpleMode={isSimpleMode} 
            hasProtocol={!!protocol} 
          />
        </Button>
      </div>

      {isSimpleMode && <p className="form-hint">* Campos obrigatórios</p>}
    </form>
  )
}
