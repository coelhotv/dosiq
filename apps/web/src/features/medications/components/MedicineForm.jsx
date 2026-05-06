import React from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Button from '@shared/components/ui/Button.jsx'
import './MedicineForm.css'

// Custom Hook e Seções
import { useMedicineFormState } from '@features/medications/components/_useMedicineFormState.js'
import MedicineFormBasicInfo from '@features/medications/components/sections/MedicineFormBasicInfo.jsx'
import MedicineFormDosageInfo from '@features/medications/components/sections/MedicineFormDosageInfo.jsx'

/**
 * @typedef {Object} MedicineFormProps
 * @property {Object} [medicine] - Dados para edição (modo edição)
 * @property {Function} onSave - Callback ao salvar (recebe dados validados)
 * @property {Function} [onCancel] - Callback ao cancelar
 * @property {Function} [onSuccess] - Callback após sucesso (para onboarding)
 * @property {boolean} [autoAdvance=false] - Se true, chama onSuccess após delay
 * @property {boolean} [showSuccessMessage=true] - Mostrar mensagem de sucesso
 * @property {boolean} [showCancelButton=true] - Mostrar botão cancelar
 * @property {string} [submitButtonLabel] - Label customizado do botão submit
 * @property {string} [title] - Título customizado do formulário
 */

export default function MedicineForm({
  medicine,
  onSave,
  onCancel,
  onSuccess,
  autoAdvance = false,
  showSuccessMessage = true,
  showCancelButton = true,
  submitButtonLabel,
  title,
}) {
  const {
    formData,
    setFormData,
    errors,
    setErrors,
    isSubmitting,
    shakeFields,
    saveSuccess,
    setSaveSuccess,
    handleChange,
    handleMedicineSelect,
    handleLaboratorySelect,
    handleSubmit,
  } = useMedicineFormState({
    medicine,
    onSave,
    onSuccess,
    autoAdvance,
    showSuccessMessage,
  })

  // Determina o título do formulário
  const formTitle = title || (medicine ? 'Editar Medicamento' : 'Novo Medicamento')

  return (
    <form className="medicine-form" onSubmit={handleSubmit}>
      <h3>{formTitle}</h3>

      {saveSuccess && showSuccessMessage && (
        <div className="success-message">
          <CheckCircle2 size={18} />
          <span>Medicamento salvo com sucesso!</span>
        </div>
      )}

      <MedicineFormBasicInfo
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        shakeFields={shakeFields}
        saveSuccess={saveSuccess}
        setFormData={setFormData}
        setErrors={setErrors}
        setSaveSuccess={setSaveSuccess}
        handleChange={handleChange}
        handleMedicineSelect={handleMedicineSelect}
        medicine={medicine}
      />

      <MedicineFormDosageInfo
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        shakeFields={shakeFields}
        saveSuccess={saveSuccess}
        setFormData={setFormData}
        setSaveSuccess={setSaveSuccess}
        handleChange={handleChange}
        handleLaboratorySelect={handleLaboratorySelect}
        medicine={medicine}
      />

      {errors.submit && (
        <div className="error-banner">
          <AlertCircle size={18} /> {errors.submit}
        </div>
      )}

      <div className="form-actions">
        {showCancelButton && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'Salvando...'
            : submitButtonLabel || (medicine ? 'Atualizar' : 'Cadastrar')}
        </Button>
      </div>
    </form>
  )
}
