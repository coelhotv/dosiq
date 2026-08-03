import React from 'react'
import { getFieldDescribedBy } from '@utils/formUtils'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import MedicineAutocomplete from '@features/medications/components/MedicineAutocomplete'

// Ordem dos campos espelha o form mobile (012 Fase B3): Identificação no topo
// (nome + princípio ativo), prioritários primeiro. Tipo/Classe migraram p/ a
// seção "Classificação" (MedicineFormDosageInfo).
export default function MedicineFormBasicInfo({
  formData,
  errors,
  isSubmitting,
  shakeFields,
  saveSuccess,
  setFormData,
  setErrors,
  setSaveSuccess,
  handleChange,
  handleMedicineSelect,
  medicine,
}: any) {
  return (
    <>
      <h4 className="medicine-form__section-title">Identificação</h4>

      <div className="form-group">
        <label htmlFor="name">
          Nome {formData.type === 'suplemento' ? '(Comercial)' : 'do Remédio'}{' '}
          <span className="required">*</span>
          {formData.name && !medicine?.name && (
            <span className="autocomplete-badge" title="Preenchido via Base ANVISA">
              Fonte: ANVISA
            </span>
          )}
        </label>
        <ShakeEffect trigger={shakeFields.name}>
          <MedicineAutocomplete
            value={formData.name}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, name: value }))
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
              if (saveSuccess) setSaveSuccess(false)
            }}
            onSelect={handleMedicineSelect}
            inputId="name"
            placeholder="Ex: Paracetamol ou digite para buscar..."
            disabled={isSubmitting}
            ariaDescribedBy={getFieldDescribedBy('name', errors)}
            ariaInvalid={Boolean(errors.name)}
          />
        </ShakeEffect>
        {errors.name && (
          <span id="name-error" className="error-message">
            {errors.name}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="active_ingredient">
          Princípio Ativo
          {formData.active_ingredient && !medicine?.active_ingredient && (
            <span className="autocomplete-badge" title="Preenchido via Base ANVISA">
              Fonte: ANVISA
            </span>
          )}
        </label>
        <input
          type="text"
          id="active_ingredient"
          name="active_ingredient"
          value={formData.active_ingredient}
          onChange={handleChange}
          placeholder="Ex: Paracetamol"
          disabled={isSubmitting}
          readOnly={formData.active_ingredient && !medicine?.active_ingredient}
          aria-describedby="active_ingredient-hint"
        />
        <small id="active_ingredient-hint" className="field-hint">
          Preenchido automaticamente ao selecionar medicamento
        </small>
      </div>
    </>
  )
}
