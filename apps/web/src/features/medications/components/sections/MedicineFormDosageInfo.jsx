import React from 'react'
import {
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
  PRESENTATIONS,
  PRESENTATION_LABELS,
  LIQUID_PRESENTATIONS,
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
  // Apresentação efetiva: unidade /ml exige apresentação líquida, mas NÃO pode engolir
  // 'injetavel' (GLP-1/insulina são líquidos injetáveis → TTL/container). Se o usuário
  // já escolheu uma apresentação líquido-compatível, preserva; senão default 'liquido'.
  const effectivePresentation = liquid
    ? (LIQUID_PRESENTATIONS.includes(formData.presentation) ? formData.presentation : 'liquido')
    : (formData.presentation || 'comprimido')
  // Opções do select: /ml restringe a líquido-compatíveis (sólido não faz sentido);
  // caso contrário, todas. Restringir (não travar) deixa escolher líquido ↔ injetável.
  const presentationOptions = liquid
    ? PRESENTATIONS.filter((p) => LIQUID_PRESENTATIONS.includes(p))
    : PRESENTATIONS

  // Prefill/limpeza no próprio onChange (espelha handlePresentationChange do mobile;
  // review Gemini #658): injetavel → prefill 28 se vazio; outra apresentação → limpa
  // shelf_life_days (campo oculto não pode persistir valor obsoleto no banco).
  const handlePresentationChange = (e) => {
    const presentation = e.target.value
    setFormData((prev) => ({
      ...prev,
      presentation,
      shelf_life_days:
        presentation === 'injetavel'
          ? (prev.shelf_life_days === '' || prev.shelf_life_days == null ? 28 : prev.shelf_life_days)
          : '',
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

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
          onChange={handlePresentationChange}
          disabled={isSubmitting}
          aria-describedby="presentation-hint"
        >
          {presentationOptions.map((p) => (
            <option key={p} value={p}>
              {PRESENTATION_LABELS[p] || p}
            </option>
          ))}
        </select>
        <small id="presentation-hint" className="field-hint">
          {liquid
            ? 'Unidade /ml: escolha Líquido ou Injetável (injetável habilita validade após aberto).'
            : 'Forma farmacêutica do medicamento (comprimido, injeção, pomada etc.).'}
        </small>
      </div>

      {/* ── Validade após aberto — apenas para injetavel (012 Fase A) ── */}
      {effectivePresentation === 'injetavel' && (
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
              type="text"
              inputMode="decimal"
              id="dosage_per_pill"
              name="dosage_per_pill"
              value={formData.dosage_per_pill}
              onChange={handleChange}
              className={errors.dosage_per_pill ? 'error' : ''}
              placeholder={formData.type === 'suplemento' ? 'Opcional' : '500'}
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
