import { useState } from 'react'
import { useOnboarding } from './useOnboarding'
import { medicineCreateSchema, MEDICINE_TYPES } from '../../schemas/medicineSchema'
import { cachedMedicineService } from '../../services/api/cachedServices'
import Button from '../ui/Button'
import './FirstMedicineStep.css'

const DOSAGE_UNITS = ['mg', 'mcg', 'ml', 'g', 'UI', 'gotas', 'comprimido', 'cápsula']

export default function FirstMedicineStep() {
  const { onboardingData, updateOnboardingData, nextStep } = useOnboarding()
  
  const [formData, setFormData] = useState({
    name: onboardingData.medicine?.name || '',
    laboratory: onboardingData.medicine?.laboratory || '',
    active_ingredient: onboardingData.medicine?.active_ingredient || '',
    dosage_per_pill: onboardingData.medicine?.dosage_per_pill || '',
    dosage_unit: onboardingData.medicine?.dosage_unit || 'mg',
    type: onboardingData.medicine?.type || 'medicamento'
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Limpa erro do campo quando usuário começa a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    // Limpa mensagem de sucesso ao editar
    if (saveSuccess) {
      setSaveSuccess(false)
    }
  }

  const validate = () => {
    try {
      const dataToValidate = {
        ...formData,
        dosage_per_pill: formData.dosage_per_pill ? parseFloat(formData.dosage_per_pill) : undefined
      }
      
      medicineCreateSchema.parse(dataToValidate)
      setErrors({})
      return true
    } catch (error) {
      if (error.errors) {
        const formattedErrors = {}
        error.errors.forEach(err => {
          const field = err.path[0]
          formattedErrors[field] = err.message
        })
        setErrors(formattedErrors)
      }
      return false
    }
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
        dosage_unit: formData.dosage_unit
      }
      
      const savedMedicine = await cachedMedicineService.create(dataToSave)
      
      // Salva no contexto do onboarding
      updateOnboardingData('medicine', savedMedicine)
      setSaveSuccess(true)
      
      // Aguarda um momento para mostrar o sucesso antes de avançar
      setTimeout(() => {
        nextStep()
      }, 800)
    } catch (error) {
      console.error('Erro ao salvar medicamento:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar medicamento'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="first-medicine-step">
      <div className="step-header">
        <div className="step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
          </svg>
        </div>
        <h3 className="step-title">Cadastre seu primeiro medicamento</h3>
        <p className="step-description">
          Vamos começar cadastrando um medicamento. Você pode adicionar mais depois.
        </p>
      </div>

      {saveSuccess && (
        <div className="success-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Medicamento salvo com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="medicine-form-onboarding">
        <div className="form-row">
          <div className={`form-group ${errors.type ? 'has-error' : ''}`}>
            <label htmlFor="type">Tipo</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={isSubmitting}
            >
              {MEDICINE_TYPES.map(type => (
                <option key={type} value={type}>{type === 'medicamento' ? 'Medicamento' : 'Suplemento'}</option>
              ))}
            </select>
            {errors.type && <span className="error-message">{errors.type}</span>}
          </div>
        </div>

        <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="name">
            Nome {formData.type === 'suplemento' ? '(Comercial)' : 'do Remédio'} *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={formData.type === 'suplemento' ? 'Ex: Vitamina D3' : 'Ex: Paracetamol'}
            disabled={isSubmitting}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-row two-columns">
          <div className={`form-group ${errors.dosage_per_pill ? 'has-error' : ''}`}>
            <label htmlFor="dosage_per_pill">Dosagem por comprimido</label>
            <input
              type="number"
              id="dosage_per_pill"
              name="dosage_per_pill"
              value={formData.dosage_per_pill}
              onChange={handleChange}
              placeholder="Ex: 500"
              step="0.01"
              min="0"
              disabled={isSubmitting}
            />
            {errors.dosage_per_pill && <span className="error-message">{errors.dosage_per_pill}</span>}
          </div>

          <div className={`form-group ${errors.dosage_unit ? 'has-error' : ''}`}>
            <label htmlFor="dosage_unit">Unidade</label>
            <select
              id="dosage_unit"
              name="dosage_unit"
              value={formData.dosage_unit}
              onChange={handleChange}
              disabled={isSubmitting}
            >
              {DOSAGE_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            {errors.dosage_unit && <span className="error-message">{errors.dosage_unit}</span>}
          </div>
        </div>

        <div className={`form-group ${errors.laboratory ? 'has-error' : ''}`}>
          <label htmlFor="laboratory">Laboratório (opcional)</label>
          <input
            type="text"
            id="laboratory"
            name="laboratory"
            value={formData.laboratory}
            onChange={handleChange}
            placeholder="Ex: Medley"
            disabled={isSubmitting}
          />
          {errors.laboratory && <span className="error-message">{errors.laboratory}</span>}
        </div>

        <div className={`form-group ${errors.active_ingredient ? 'has-error' : ''}`}>
          <label htmlFor="active_ingredient">Princípio Ativo (opcional)</label>
          <input
            type="text"
            id="active_ingredient"
            name="active_ingredient"
            value={formData.active_ingredient}
            onChange={handleChange}
            placeholder="Ex: Paracetamol"
            disabled={isSubmitting}
          />
          {errors.active_ingredient && <span className="error-message">{errors.active_ingredient}</span>}
        </div>

        {errors.submit && (
          <div className="error-alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{errors.submit}</span>
          </div>
        )}

        <div className="form-actions">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="btn-save"
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Salvando...
              </>
            ) : (
              <>
                Salvar e Continuar
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-right">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </>
            )}
          </Button>
        </div>

        <p className="form-hint">
          * Campos obrigatórios
        </p>
      </form>
    </div>
  )
}