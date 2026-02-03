import { useState } from 'react'
import { useOnboarding } from './OnboardingProvider'
import { protocolCreateSchema } from '../../schemas/protocolSchema'
import { cachedProtocolService } from '../../services/api/cachedServices'
import Button from '../ui/Button'
import './FirstProtocolStep.css'

const FREQUENCIES = [
  { value: 'daily', label: 'Todos os dias' },
  { value: 'alternate', label: 'Dias alternados' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'as_needed', label: 'Quando necessário' }
]

export default function FirstProtocolStep() {
  const { onboardingData, updateOnboardingData, nextStep } = useOnboarding()
  const medicine = onboardingData.medicine
  
  const [formData, setFormData] = useState({
    medicine_id: medicine?.id || '',
    name: onboardingData.protocol?.name || (medicine ? `${medicine.name} - Protocolo` : ''),
    frequency: onboardingData.protocol?.frequency || 'daily',
    time_schedule: onboardingData.protocol?.time_schedule || [],
    dosage_per_intake: onboardingData.protocol?.dosage_per_intake || '',
    notes: onboardingData.protocol?.notes || ''
  })
  
  const [timeInput, setTimeInput] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    if (saveSuccess) setSaveSuccess(false)
  }

  const addTime = () => {
    if (!timeInput) {
      setErrors(prev => ({ ...prev, time_schedule: 'Selecione um horário' }))
      return
    }
    
    if (formData.time_schedule.includes(timeInput)) {
      setErrors(prev => ({ ...prev, time_schedule: 'Horário já adicionado' }))
      return
    }
    
    setFormData(prev => ({
      ...prev,
      time_schedule: [...prev.time_schedule, timeInput].sort()
    }))
    setTimeInput('')
    setErrors(prev => ({ ...prev, time_schedule: '' }))
    if (saveSuccess) setSaveSuccess(false)
  }

  const removeTime = (time) => {
    setFormData(prev => ({
      ...prev,
      time_schedule: prev.time_schedule.filter(t => t !== time)
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

  const validate = () => {
    try {
      const dataToValidate = {
        ...formData,
        medicine_id: formData.medicine_id,
        dosage_per_intake: formData.dosage_per_intake ? parseFloat(formData.dosage_per_intake) : undefined,
        time_schedule: formData.time_schedule
      }
      
      protocolCreateSchema.parse(dataToValidate)
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
      const dataToSave = {
        medicine_id: formData.medicine_id,
        name: formData.name.trim(),
        frequency: formData.frequency,
        time_schedule: formData.time_schedule,
        dosage_per_intake: parseFloat(formData.dosage_per_intake),
        notes: formData.notes.trim() || null,
        titration_status: 'estável',
        active: true
      }
      
      const savedProtocol = await cachedProtocolService.create(dataToSave)
      
      updateOnboardingData('protocol', savedProtocol)
      setSaveSuccess(true)
      
      setTimeout(() => {
        nextStep()
      }, 800)
    } catch (error) {
      console.error('Erro ao salvar protocolo:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar protocolo'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Gera opções de horário a cada 30 minutos
  const generateTimeOptions = () => {
    const options = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of ['00', '30']) {
        const time = `${hour.toString().padStart(2, '0')}:${minute}`
        options.push(time)
      }
    }
    return options
  }

  const timeOptions = generateTimeOptions()

  if (!medicine) {
    return (
      <div className="first-protocol-step">
        <div className="error-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Medicamento não encontrado</h3>
          <p>Por favor, cadastre um medicamento primeiro.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="first-protocol-step">
      <div className="step-header">
        <div className="step-icon protocol-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h3 className="step-title">Crie seu primeiro protocolo</h3>
        <p className="step-description">
          Defina quando e como tomar <strong>{medicine.name}</strong>
        </p>
      </div>

      {saveSuccess && (
        <div className="success-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Protocolo criado com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="protocol-form-onboarding">
        <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="name">Nome do Protocolo *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ex: Tratamento Diário"
            disabled={isSubmitting}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-row two-columns">
          <div className={`form-group ${errors.frequency ? 'has-error' : ''}`}>
            <label htmlFor="frequency">Frequência *</label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              disabled={isSubmitting}
            >
              {FREQUENCIES.map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
            {errors.frequency && <span className="error-message">{errors.frequency}</span>}
          </div>

          <div className={`form-group ${errors.dosage_per_intake ? 'has-error' : ''}`}>
            <label htmlFor="dosage_per_intake">Dosagem por tomada *</label>
            <input
              type="number"
              id="dosage_per_intake"
              name="dosage_per_intake"
              value={formData.dosage_per_intake}
              onChange={handleChange}
              placeholder={`Em ${medicine.dosage_unit || 'mg'}`}
              step="0.01"
              min="0"
              disabled={isSubmitting}
            />
            {errors.dosage_per_intake && <span className="error-message">{errors.dosage_per_intake}</span>}
          </div>
        </div>

        <div className={`form-group ${errors.time_schedule ? 'has-error' : ''}`}>
          <label>Horários *</label>
          <div className="time-input-group">
            <select
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              disabled={isSubmitting}
              className="time-select"
            >
              <option value="">Selecione um horário</option>
              {timeOptions.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              onClick={addTime}
              disabled={isSubmitting}
              className="btn-add-time"
            >
              Adicionar
            </Button>
          </div>
          {errors.time_schedule && <span className="error-message">{errors.time_schedule}</span>}
          
          {formData.time_schedule.length > 0 && (
            <div className="time-tags">
              {formData.time_schedule.map(time => (
                <span key={time} className="time-tag">
                  {time}
                  <button
                    type="button"
                    onClick={() => removeTime(time)}
                    disabled={isSubmitting}
                    className="btn-remove-time"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={`form-group ${errors.notes ? 'has-error' : ''}`}>
          <label htmlFor="notes">Observações (opcional)</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Ex: Tomar após as refeições"
            rows={3}
            disabled={isSubmitting}
          />
          {errors.notes && <span className="error-message">{errors.notes}</span>}
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
                Criando...
              </>
            ) : (
              <>
                Criar Protocolo
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