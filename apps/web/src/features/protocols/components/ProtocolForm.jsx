import Button from '@shared/components/ui/Button'
import { useProtocolFormState } from '@protocols/hooks/useProtocolFormState'
import ProtocolFormBasicSection from '@protocols/components/sections/ProtocolFormBasicSection'
import ProtocolFormDosesSection from '@protocols/components/sections/ProtocolFormDosesSection'
import ProtocolFormAdvancedSection from '@protocols/components/sections/ProtocolFormAdvancedSection'
import '@protocols/components/ProtocolForm.css'

const _getSuccessMessage = (isSimpleMode) =>
  isSimpleMode ? 'Tratamento criado com sucesso!' : 'Tratamento salvo com sucesso!'

const SuccessMessage = ({ isSimpleMode }) => (
  <div className="success-message">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{_getSuccessMessage(isSimpleMode)}</span>
  </div>
)

const _renderErrorContent = (error, isSimpleMode) =>
  isSimpleMode ? (
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
  )

const ErrorBanner = ({ error, isSimpleMode }) => (
  <div className={`error-banner ${isSimpleMode ? 'error-alert' : ''}`}>
    {_renderErrorContent(error, isSimpleMode)}
  </div>
)

const _getSubmitButtonLabel = (isSubmitting, isSimpleMode, hasProtocol) => {
  if (isSubmitting) return isSimpleMode ? 'Criando...' : 'Salvando...'
  if (isSimpleMode) return 'Criar Protocolo'
  return hasProtocol ? 'Atualizar' : 'Criar Tratamento'
}

const _shouldShowSubmitSpinner = (isSubmitting, isSimpleMode) => isSubmitting && isSimpleMode

const _shouldShowArrowIcon = (isSubmitting, isSimpleMode) => !isSubmitting && isSimpleMode

const SubmitButton = ({ isSubmitting, isSimpleMode, hasProtocol }) => {
  const label = _getSubmitButtonLabel(isSubmitting, isSimpleMode, hasProtocol)
  if (_shouldShowSubmitSpinner(isSubmitting, isSimpleMode)) {
    return (
      <>
        <span className="spinner"></span>
        {label}
      </>
    )
  }
  if (_shouldShowArrowIcon(isSubmitting, isSimpleMode)) {
    return (
      <>
        {label}
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
  return label
}

function _getFormTitle(protocol, title) {
  if (title) return title
  return protocol ? 'Editar Tratamento' : 'Novo Tratamento'
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

  const formTitle = _getFormTitle(protocol, title)
  const formClass = isSimpleMode ? 'protocol-form-simple' : ''
  const formPaddingBottom = isSimpleMode ? '0' : '80px'
  const showCancelBtn = !isSimpleMode && onCancel
  const showTopSuccess = saveSuccess && !isSimpleMode
  const showBottomSuccess = saveSuccess && isSimpleMode

  return (
    <form
      className={`protocol-form ${formClass}`}
      onSubmit={handleSubmit}
      style={{ paddingBottom: formPaddingBottom }}
    >
      <h3>{formTitle}</h3>

      {showTopSuccess && <SuccessMessage isSimpleMode={false} />}

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

      {showBottomSuccess && <SuccessMessage isSimpleMode={true} />}

      {errors.submit && <ErrorBanner error={errors.submit} isSimpleMode={isSimpleMode} />}

      <div className={`form-actions ${isSimpleMode ? 'form-actions-simple' : ''}`}>
        {showCancelBtn && (
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
