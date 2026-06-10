import React, { useEffect } from 'react'
import {
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
  PRESENTATIONS,
  PRESENTATION_LABELS,
} from '@dosiq/core'
import { isLiquidUnit } from '@features/medications/components/_medicineFormUtils.js'
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
  const liquid = isLiquidUnit(formData.dosage_unit)
  // Apresentação efetiva: líquido força 'liquido'; caso contrário usa formData.presentation
  const effectivePresentation = liquid ? 'liquido' : (formData.presentation || 'comprimido')

  // Prefill 28 dias ao selecionar injecao — apenas se campo estiver vazio (nunca sobrescreve)
  useEffect(() => {
    if (effectivePresentation === 'injecao' && (formData.shelf_life_days === '' || formData.shelf_life_days === null || formData.shelf_life_days === undefined)) {
      setFormData((prev) => ({ ...prev, shelf_life_days: 28 }))
    }
  }, [effectivePresentation]) // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* ── Apresentação farmacêutica (012 Fase A) ── */}
      <div className="form-group">
        <label htmlFor="presentation">Apresentação</label>
        <select
          id="presentation"
          name="presentation"
          value={effectivePresentation}
          onChange={handleChange}
          disabled={isSubmitting || liquid}
          aria-describedby="presentation-hint"
        >
          {PRESENTATIONS.map((p) => (
            <option key={p} value={p}>
              {PRESENTATION_LABELS[p] || p}
            </option>
          ))}
        </select>
        <small id="presentation-hint" className="field-hint">
          {liquid
            ? 'Definido automaticamente como Líquido para unidades /ml.'
            : 'Forma farmacêutica do medicamento (comprimido, injeção, pomada etc.).'}
        </small>
      </div>

      {/* ── Validade após aberto — apenas para injecao (012 Fase A) ── */}
      {effectivePresentation === 'injecao' && (
        <div className="form-group">
          <label htmlFor="shelf_life_days">Validade após aberto (dias)</label>
          <input
            type="number"
            id="shelf_life_days"
            name="shelf_life_days"
            value={formData.shelf_life_days ?? ''}
            onChange={handleChange}
            className={errors.shelf_life_days ? 'error' : ''}
            placeholder="28"
            min="1"
            step="1"
            disabled={isSubmitting}
            aria-describedby="shelf_life_days-hint"
            aria-invalid={Boolean(errors.shelf_life_days)}
          />
          <small id="shelf_life_days-hint" className="field-hint">
            Dias de uso após abrir o frasco/caneta — confira a bula.
          </small>
          {errors.shelf_life_days && (
            <span id="shelf_life_days-error" className="error-message">
              {errors.shelf_life_days}
            </span>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="dosage_per_pill">
          Concentração <strong>(Específica da sua prescrição)</strong>
          {liquid && (
            <span
              className="autocomplete-badge"
              title="Medicamento líquido (concentração por ml)"
            >
              💧 Líquido
            </span>
          )}
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
        {formData.dosage_unit === 'un' && Number(formData.dosage_per_pill) > 1 && (
          <div
            className="warning-message"
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning-light)',
              color: 'var(--color-warning)',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              marginTop: '8px'
            }}
          >
            ⚠️ Dica: Para a unidade genérica 'un.', a concentração deveria ser 1. Caso seu medicamento tenha dosagem química ativa (ex: 500 mg), altere a unidade ao lado para 'mg', 'ui', etc.
          </div>
        )}
      </div>
    </>
  )
}
