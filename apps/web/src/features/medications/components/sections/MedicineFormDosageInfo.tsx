import React from 'react'
import {
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  MEDICINE_TYPES,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
  PRESENTATIONS,
  PRESENTATION_LABELS,
  LIQUID_PRESENTATIONS,
  coerceDecimal,
  cleanFloat,
  formatNumberPtBR,
} from '@dosiq/core'
import { isLiquidUnit } from '@features/medications/components/_medicineFormUtils'
import { getFieldDescribedBy } from '@utils/formUtils'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import LaboratoryAutocomplete from '@features/medications/components/LaboratoryAutocomplete'

// Ordem dos campos espelha o form mobile (012 Fase B3): Dosagem (prioritária) no
// topo, depois Classificação (tipo, apresentação, validade, classe, categoria,
// laboratório). Tipo e Classe Terapêutica migraram da seção Identificação p/ cá.
function DosageSection({
  liquid,
  formData,
  errors,
  isSubmitting,
  shakeFields,
  handleChange,
}) {
  return (
    <>
      {/* ──────────────── Dosagem (prioritária) ──────────────── */}
      <h4 className="medicine-form__section-title">Dosagem</h4>

      <div className="form-group">
        <label htmlFor="dosage_per_pill">
          Concentração <strong>(igual ao rótulo)</strong>
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
              aria-describedby={getFieldDescribedBy('dosage_per_pill', errors, 'dosage_per_pill-hint')}
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
          Preencha com a dosagem escrita no rótulo do seu medicamento.
        </small>
        {errors.dosage_per_pill && (
          <span id="dosage_per_pill-error" className="error-message">
            {errors.dosage_per_pill}
          </span>
        )}

        {/* FR-031 (ADR-066): denominador do rótulo. Default 1 mL; muda só p/ Mounjaro etc.
            Armazena a razão normalizada em dosage_per_pill + o volume em concentration_volume_ml. */}
        {liquid && (
          <div style={{ marginTop: 8 }}>
            <label htmlFor="concentration_volume_ml" style={{ fontSize: 13 }}>
              Medida do volume (número junto do mL no rótulo)
            </label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              id="concentration_volume_ml"
              name="concentration_volume_ml"
              value={formData.concentration_volume_ml}
              onChange={handleChange}
              className={errors.concentration_volume_ml ? 'error' : ''}
              placeholder="1"
              disabled={isSubmitting}
            />
            <small className="field-hint" style={{ display: 'block' }}>
              Padrão é 1 mL (ou só mL). Mude se o rótulo trouxer outro volume, ex.: &quot;Mounjaro 2,5mg / 0,5mL&quot; — preencha 0,5.
              {(() => {
                const a = coerceDecimal(formData.dosage_per_pill)
                const d = coerceDecimal(formData.concentration_volume_ml)
                if (!(a > 0) || !(d > 0) || d === 1) return null
                const baseUnit = (formData.dosage_unit || 'mg/ml').split('/')[0]
                const baseLabel = DOSAGE_UNIT_LABELS[baseUnit] || baseUnit
                return ` → razão armazenada ${formatNumberPtBR(cleanFloat(a / d))} ${baseLabel}/mL`
              })()}
            </small>
            {errors.concentration_volume_ml && (
              <span className="error-message">{errors.concentration_volume_ml}</span>
            )}
          </div>
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

function AnvisaFields({ formData, handleChange, isSubmitting, medicine }) {
  return (
    <>
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
          Preenchido via busca na base da ANVISA.
        </small>
      </div>
    </>
  )
}

function ClassificationSection({
  formData,
  handleChange,
  isSubmitting,
  effectivePresentation,
  handlePresentationChange,
  presentationOptions,
  errors,
  medicine,
  setFormData,
  saveSuccess,
  setSaveSuccess,
  handleLaboratorySelect,
}) {
  return (
    <>
      {/* ──────────────── Classificação ──────────────── */}
      <h4 className="medicine-form__section-title">Classificação</h4>

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
          {isLiquidUnit(formData.dosage_unit)
            ? 'Escolha Líquido ou Injetável (injetável possui validade após aberto).'
            : 'Forma de apresentação do seu medicamento (comprimido, injeção, pomada etc.).'}
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

      <AnvisaFields
        formData={formData}
        handleChange={handleChange}
        isSubmitting={isSubmitting}
        medicine={medicine}
      />

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
          Opcional. Fonte: Busca na base da ANVISA
        </small>
      </div>
    </>
  )
}


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
      <DosageSection
        liquid={liquid}
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        shakeFields={shakeFields}
        handleChange={handleChange}
      />
      <ClassificationSection
        formData={formData}
        handleChange={handleChange}
        isSubmitting={isSubmitting}
        effectivePresentation={effectivePresentation}
        handlePresentationChange={handlePresentationChange}
        presentationOptions={presentationOptions}
        errors={errors}
        medicine={medicine}
        setFormData={setFormData}
        saveSuccess={saveSuccess}
        setSaveSuccess={setSaveSuccess}
        handleLaboratorySelect={handleLaboratorySelect}
      />
    </>
  )
}
