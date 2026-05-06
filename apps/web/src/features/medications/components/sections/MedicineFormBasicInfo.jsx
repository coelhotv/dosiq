import React from 'react'
import { MEDICINE_TYPES } from '@schemas/medicineSchema.js'
import { getFieldDescribedBy } from '@utils/formUtils.js'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect.jsx'
import MedicineAutocomplete from '@features/medications/components/MedicineAutocomplete.jsx'

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
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="type">Tipo</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          disabled={isSubmitting}
        >
          {MEDICINE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === 'medicamento' ? 'Medicamento' : 'Suplemento'}
            </option>
          ))}
        </select>
      </div>

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
            ariaDescribedBy={getFieldDescribedBy('name')}
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

      <div className="form-group">
        <label htmlFor="therapeutic_class">
          Classe Terapêutica
          {formData.therapeutic_class && !medicine?.therapeutic_class && (
            <span className="autocomplete-badge" title="Preenchido via Base ANVISA">
              Fonte: ANVISA
            </span>
          )}
        </label>
        <input
          type="text"
          id="therapeutic_class"
          name="therapeutic_class"
          value={formData.therapeutic_class || ''}
          onChange={handleChange}
          placeholder="Ex: Analgésicos não narcóticos"
          disabled={isSubmitting}
          maxLength={100}
        />
      </div>
    </>
  )
}
