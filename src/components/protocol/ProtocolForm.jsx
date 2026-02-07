import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import TitrationWizard from './TitrationWizard'
import { FREQUENCIES, FREQUENCY_LABELS } from '../../schemas/protocolSchema'
import './ProtocolForm.css'

export default function ProtocolForm({ medicines, treatmentPlans = [], protocol, initialValues, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    medicine_id: protocol?.medicine_id || initialValues?.medicine_id || '',
    treatment_plan_id: protocol?.treatment_plan_id || '',
    name: protocol?.name || '',
    frequency: protocol?.frequency || '',
    time_schedule: protocol?.time_schedule || [],
    dosage_per_intake: protocol?.dosage_per_intake || '',
    target_dosage: protocol?.target_dosage || '',
    titration_status: protocol?.titration_status || 'estável',
    titration_schedule: protocol?.titration_schedule || [],
    notes: protocol?.notes || '',
    active: protocol?.active !== undefined ? protocol.active : true
  })
  
  const [enableTitration, setEnableTitration] = useState(
    (protocol?.titration_schedule?.length > 0) || (protocol?.titration_status === 'titulando')
  )
  
  const [timeInput, setTimeInput] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync initial dosage with first stage if titration is enabled for new protocols
  useEffect(() => {
    if (!protocol && enableTitration && formData.titration_schedule?.length > 0) {
      const firstStage = formData.titration_schedule[0]
      if (firstStage.dosage && !formData.dosage_per_intake) {
        setFormData(prev => ({ ...prev, dosage_per_intake: firstStage.dosage }))
      }
    }
  }, [enableTitration, formData.titration_schedule, protocol, formData.dosage_per_intake])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const addTime = () => {
    if (!timeInput) return
    
    if (formData.time_schedule.includes(timeInput)) {
      setErrors({ time_schedule: 'Horário já adicionado' })
      return
    }
    
    setFormData(prev => ({
      ...prev,
      time_schedule: [...prev.time_schedule, timeInput].sort()
    }))
    setTimeInput('')
    setErrors(prev => ({ ...prev, time_schedule: '' }))
  }

  const removeTime = (time) => {
    setFormData(prev => ({
      ...prev,
      time_schedule: prev.time_schedule.filter(t => t !== time)
    }))
  }

  const validate = () => {
    const newErrors = {}
    
    if (!formData.medicine_id) {
      newErrors.medicine_id = 'Selecione um medicamento'
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do protocolo é obrigatório'
    }
    
    if (!formData.frequency.trim()) {
      newErrors.frequency = 'Frequência é obrigatória'
    }
    
    if (formData.time_schedule.length === 0) {
      newErrors.time_schedule = 'Adicione pelo menos um horário'
    }
    
    if (!formData.dosage_per_intake || formData.dosage_per_intake <= 0) {
      newErrors.dosage_per_intake = 'Dosagem deve ser maior que zero'
    }
    
    if (formData.target_dosage && isNaN(formData.target_dosage)) {
      newErrors.target_dosage = 'Deve ser um número'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const isTitrating = enableTitration && formData.titration_schedule.length > 0

      const dataToSave = {
        medicine_id: formData.medicine_id,
        treatment_plan_id: formData.treatment_plan_id || null,
        name: formData.name.trim(),
        frequency: formData.frequency.trim(),
        time_schedule: formData.time_schedule,
        dosage_per_intake: parseFloat(formData.dosage_per_intake),
        target_dosage: formData.target_dosage ? parseFloat(formData.target_dosage) : null,
        titration_status: isTitrating ? 'titulando' : formData.titration_status,
        titration_schedule: isTitrating ? formData.titration_schedule : [],
        notes: formData.notes.trim() || null,
        active: formData.active
      }
      
      await onSave(dataToSave)
    } catch (error) {
      console.error('Erro ao salvar protocolo:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar protocolo'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="protocol-form" onSubmit={handleSubmit} style={{ paddingBottom: '80px' }}>
      <h3>{protocol ? 'Editar Protocolo' : 'Novo Protocolo'}</h3>
      
      <div className="form-group">
        <label htmlFor="medicine_id">
          Medicamento <span className="required">*</span>
        </label>
        <select
          id="medicine_id"
          name="medicine_id"
          value={formData.medicine_id}
          onChange={handleChange}
          className={errors.medicine_id ? 'error' : ''}
          disabled={!!protocol} // Não permite mudar medicamento ao editar
        >
          <option value="">Selecione um medicamento</option>
          {medicines.map(medicine => (
            <option key={medicine.id} value={medicine.id}>
              {medicine.name} {medicine.dosage_per_pill ? `(${medicine.dosage_per_pill}${medicine.dosage_unit || 'mg'})` : `(${medicine.type === 'suplemento' ? 'Sup.' : 'N/A'})`}
            </option>
          ))}
        </select>
        {errors.medicine_id && <span className="error-message">{errors.medicine_id}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="treatment_plan_id">Plano de Tratamento (Opcional)</label>
        <select
          id="treatment_plan_id"
          name="treatment_plan_id"
          value={formData.treatment_plan_id}
          onChange={handleChange}
        >
          <option value="">Nenhum (Protocolo isolado)</option>
          {treatmentPlans.map(plan => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
        <small style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
          Agrupe este remédio em um plano maior (ex: Quarteto Fantástico).
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="name">
          Nome do Protocolo <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={errors.name ? 'error' : ''}
          placeholder="Ex: Paracetamol para dor"
          autoFocus={!protocol}
        />
        {errors.name && <span className="error-message">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="frequency">
            Frequência <span className="required">*</span>
          </label>
          <select
            id="frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            className={errors.frequency ? 'error' : ''}
          >
            <option value="">Selecione a frequência</option>
            {FREQUENCIES.map(freq => (
              <option key={freq} value={freq}>
                {FREQUENCY_LABELS[freq]}
              </option>
            ))}
          </select>
          {errors.frequency && <span className="error-message">{errors.frequency}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="dosage_per_intake">
            Dose por Horário (qtd) <span className="required">*</span>
          </label>
          <input
            type="number"
            id="dosage_per_intake"
            name="dosage_per_intake"
            value={formData.dosage_per_intake}
            onChange={handleChange}
            className={errors.dosage_per_intake ? 'error' : ''}
            placeholder="1"
            min="0.1"
            step="0.1"
          />
          {errors.dosage_per_intake && <span className="error-message">{errors.dosage_per_intake}</span>}
        </div>
      </div>

      <div className="form-row" style={{ flexDirection: 'column', gap: 'var(--space-2)', border: '1px solid var(--border-color)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', marginBottom: 'var(--space-4)' }}>
        <div className="form-group checkbox-group" style={{ marginBottom: 0 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enableTitration}
              onChange={(e) => {
                 setEnableTitration(e.target.checked)
                 if (e.target.checked) setFormData(prev => ({ ...prev, titration_status: 'titulando' }))
                 else setFormData(prev => ({ ...prev, titration_status: 'estável' }))
              }}
            />
            <span>📈 Regime de Titulação Inteligente</span>
          </label>
        </div>

        {enableTitration ? (
          <TitrationWizard 
            schedule={formData.titration_schedule}
            onChange={(newSchedule) => setFormData(prev => ({ ...prev, titration_schedule: newSchedule }))}
          />
        ) : (
           <div className="form-row" style={{ marginTop: 'var(--space-2)' }}>
            <div className="form-group">
              <label htmlFor="target_dosage">Dose Alvo (mg)</label>
              <input
                type="number"
                id="target_dosage"
                name="target_dosage"
                value={formData.target_dosage}
                onChange={handleChange}
                placeholder="Ex: 50"
                step="0.1"
                min="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="titration_status">Status Manual</label>
              <select
                id="titration_status"
                name="titration_status"
                value={formData.titration_status}
                onChange={handleChange}
              >
                <option value="estável">✅ Estável</option>
                <option value="titulando">📈 Titulando</option>
                <option value="alvo_atingido">🎯 Alvo Atingido</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="time_input">
          Horários <span className="required">*</span>
        </label>
        <div className="time-input-group">
          <input
            type="time"
            id="time_input"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className={errors.time_schedule ? 'error' : ''}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={addTime}
          >
            ➕ Adicionar
          </Button>
        </div>
        {errors.time_schedule && <span className="error-message">{errors.time_schedule}</span>}
        
        {formData.time_schedule.length > 0 && (
          <div className="time-schedule-list">
            {formData.time_schedule.map(time => (
              <div key={time} className="time-chip">
                <span>{time}</span>
                <button 
                  type="button" 
                  onClick={() => removeTime(time)}
                  className="remove-time"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="notes">Observações</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Informações adicionais sobre o protocolo..."
          rows="3"
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="active"
            checked={formData.active}
            onChange={handleChange}
          />
          <span>Protocolo ativo</span>
        </label>
      </div>

      {errors.submit && (
        <div className="error-banner">
          ❌ {errors.submit}
        </div>
      )}

      <div className="form-actions">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          variant="primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : protocol ? 'Atualizar' : 'Criar Protocolo'}
        </Button>
      </div>
    </form>
  )
}
