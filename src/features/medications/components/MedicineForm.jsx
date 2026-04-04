import { useState } from 'react'
import Button from '@shared/components/ui/Button'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import MedicineAutocomplete from './MedicineAutocomplete'
import LaboratoryAutocomplete from './LaboratoryAutocomplete'
import {
  MEDICINE_TYPES,
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
} from '@schemas/medicineSchema'
import { toTitleCase, toSentenceCase } from '@utils/stringUtils'
import './MedicineForm.css'

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
  const [formData, setFormData] = useState({
    name: medicine?.name || '',
    laboratory: medicine?.laboratory || '',
    active_ingredient: medicine?.active_ingredient || '',
    dosage_per_pill: medicine?.dosage_per_pill || '',
    type: medicine?.type || 'medicamento',
    dosage_unit: medicine?.dosage_unit || 'mg',
    therapeutic_class: medicine?.therapeutic_class || null,
    regulatory_category: medicine?.regulatory_category || null,
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shakeFields, setShakeFields] = useState({})
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Limpa erro do campo quando usuário começa a digitar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    // Limpa mensagem de sucesso ao editar
    if (saveSuccess) {
      setSaveSuccess(false)
    }
  }

  /**
   * Ao selecionar medicamento do autocomplete ANVISA
   */
  const handleMedicineSelect = (medicine) => {
    setFormData((prev) => ({
      ...prev,
      name: medicine.name,
      active_ingredient: toTitleCase(medicine.activeIngredient),
      therapeutic_class: toSentenceCase(medicine.therapeuticClass) || null,
      regulatory_category: medicine.regulatoryCategory || null,
      laboratory: medicine.laboratory || '',
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

  /**
   * Ao selecionar laboratório do autocomplete ANVISA
   */
  const handleLaboratorySelect = (laboratory) => {
    setFormData((prev) => ({
      ...prev,
      laboratory: laboratory.laboratory,
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    // Dosage is optional for supplements, but must be active number if provided
    if (formData.dosage_per_pill && isNaN(formData.dosage_per_pill)) {
      newErrors.dosage_per_pill = 'Deve ser um número'
    }

    setErrors(newErrors)

    // Extrair campos com erro para shake effect
    if (Object.keys(newErrors).length > 0) {
      const fieldsWithError = Object.keys(newErrors)
      setShakeFields(fieldsWithError.reduce((acc, field) => ({ ...acc, [field]: true }), {}))

      // Limpar shake após animação
      setTimeout(() => setShakeFields({}), 500)
    }

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)

    try {
      // Converte strings vazias para null e números para o tipo correto
      const dataToSave = {
        name: formData.name.trim(),
        laboratory: formData.laboratory.trim() || null,
        active_ingredient: formData.active_ingredient.trim() || null,
        dosage_per_pill: formData.dosage_per_pill ? parseFloat(formData.dosage_per_pill) : null,
        type: formData.type,
        dosage_unit: formData.dosage_unit,
        therapeutic_class: formData.therapeutic_class || null,
        regulatory_category: formData.regulatory_category || null,
      }

      const savedMedicine = await onSave(dataToSave)

      if (showSuccessMessage) {
        setSaveSuccess(true)
      }

      if (autoAdvance && onSuccess) {
        setTimeout(() => {
          onSuccess(savedMedicine)
        }, 800)
      }
    } catch (error) {
      console.error('Erro ao salvar medicamento:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar medicamento'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determina o título do formulário
  const formTitle = title || (medicine ? 'Editar Medicamento' : 'Novo Medicamento')

  return (
    <form className="medicine-form" onSubmit={handleSubmit}>
      <h3>{formTitle}</h3>

      {saveSuccess && showSuccessMessage && (
        <div className="success-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Medicamento salvo com sucesso!</span>
        </div>
      )}

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
            placeholder="Ex: Paracetamol ou digite para buscar..."
            disabled={isSubmitting}
          />
        </ShakeEffect>
        {errors.name && <span className="error-message">{errors.name}</span>}
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
        />
        <small className="field-hint">Preenchido automaticamente ao selecionar medicamento</small>
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

      <div className="form-group">
        <label htmlFor="laboratory">Marca / Laboratório</label>
        <LaboratoryAutocomplete
          value={formData.laboratory}
          onChange={(value) => {
            setFormData((prev) => ({ ...prev, laboratory: value }))
            if (saveSuccess) setSaveSuccess(false)
          }}
          onSelect={handleLaboratorySelect}
          placeholder="Ex: EMS, Medley ou digite para buscar..."
          disabled={isSubmitting}
        />
        <small className="field-hint">Opcional. Base ANVISA com 278 laboratórios registrados</small>
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
        >
          <option value="">Selecione (opcional)</option>
          {REGULATORY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {REGULATORY_CATEGORY_LABELS[category] || category}
            </option>
          ))}
        </select>
        <small className="field-hint">
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
        <small className="field-hint">Preencha com a dosagem prescrita pelo seu médico</small>
        {errors.dosage_per_pill && <span className="error-message">{errors.dosage_per_pill}</span>}
      </div>

      {errors.submit && <div className="error-banner">❌ {errors.submit}</div>}

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
