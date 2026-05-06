import React from 'react'
import {
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
} from '@schemas/medicineSchema.js'
import { getFieldDescribedBy } from '@utils/formUtils.js'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect.jsx'
import LaboratoryAutocomplete from '@features/medications/components/LaboratoryAutocomplete.jsx'

export default function MedicineFormDosageInfo({
  formData,
  errors,
  isSubmitting,
  shakeFields,
  saveSuccess,
  setFormData,
  setSaveSuccess,
  handleChange,
  handleLaboratorySelect,
  medicine,
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="laboratory">Marca / Laboratório</label>
        <LaboratoryAutocomplete
          value={formData.laboratory}
          onChange={(value) => {
            setFormData((prev) => ({ ...prev, laboratory: value }))
            if (saveSuccess) setSaveSuccess(false)
          }}
          onSelect={handleLaboratorySelect}
          inputId="laboratory"
          placeholder="Ex: EMS, Medley ou digite para buscar..."
          disabled={isSubmitting}
          ariaDescribedBy="laboratory-hint"
        />
        <small id="laboratory-hint" className="field-hint">
          Opcional. Base ANVISA com 278 laboratórios registrados
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="regulatory_category">
          Categoria Regulatória
          {formData.regulatory_category && !medicine?.regulatory_category && (
            <span className="autocomplete-badge" title="Preenchido via Base ANVISA">
              Fonte: ANVISA
            </span>
          )}
        </label>
        <select
          id="regulatory_category"
          name="regulatory_category"
          value={formData.regulatory_category || ''}
          onChange={handleChange}
          disabled={isSubmitting}
          aria-describedby="regulatory_category-hint"
        >
          <option value="">Selecione (opcional)</option>
          {REGULATORY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {REGULATORY_CATEGORY_LABELS[category] || category}
            </option>
          ))}
        </select>
        <small id="regulatory_category-hint" className="field-hint">
          Preenchido via ANVISA e usado no fluxo de compras do estoque redesign.
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="dosage_per_pill">
          Dosagem <strong>(Específica da sua prescrição)</strong>
        </label>
        <div
          className="dosage-input-group"
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}
        >
          <ShakeEffect trigger={shakeFields.dosage_per_pill}>
            <input
              type="number"
              id="dosage_per_pill"
              name="dosage_per_pill"
              value={formData.dosage_per_pill}
              onChange={handleChange}
              className={errors.dosage_per_pill ? 'error' : ''}
              placeholder={formData.type === 'suplemento' ? 'Opcional' : '500'}
              step="0.01"
              disabled={isSubmitting}
              aria-describedby={getFieldDescribedBy('dosage_per_pill', 'dosage_per_pill-hint')}
              aria-invalid={Boolean(errors.dosage_per_pill)}
            />
          </ShakeEffect>
          <select
            name="dosage_unit"
            value={formData.dosage_unit}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            {DOSAGE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {DOSAGE_UNIT_LABELS[unit] || unit}
              </option>
            ))}
          </select>
        </div>
        <small id="dosage_per_pill-hint" className="field-hint">
          Preencha com a dosagem prescrita pelo seu médico
        </small>
        {errors.dosage_per_pill && (
          <span id="dosage_per_pill-error" className="error-message">
            {errors.dosage_per_pill}
          </span>
        )}
      </div>
    </>
  )
}
