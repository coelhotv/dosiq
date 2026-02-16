import { useState } from 'react'
import Button from '../ui/Button'
import './TreatmentPlanForm.css'

export default function TreatmentPlanForm({ plan, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    objective: plan?.objective || '',
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do plano é obrigatório'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        objective: formData.objective.trim() || null,
      })
    } catch (error) {
      console.error('Erro ao salvar plano de tratamento:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar plano'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="treatment-plan-form" onSubmit={handleSubmit}>
      <h3>{plan ? 'Editar Plano de Tratamento' : 'Novo Plano de Tratamento'}</h3>
      <p className="form-help">
        Use planos para agrupar medicamentos de um mesmo tratamento (ex: Insuficiência Cardíaca).
      </p>

      <div className="form-group">
        <label htmlFor="name">
          Nome do Plano <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={errors.name ? 'error' : ''}
          placeholder="Ex: Quarteto Fantástico (IC)"
          autoFocus
        />
        {errors.name && <span className="error-message">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="description">Descrição</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Ex: Protocolo para controle de insuficiência cardíaca conforme prescrição do Dr. Silva."
          rows="3"
        />
      </div>

      <div className="form-group">
        <label htmlFor="objective">Objetivo do Tratamento</label>
        <input
          type="text"
          id="objective"
          name="objective"
          value={formData.objective}
          onChange={handleChange}
          placeholder="Ex: Titular Beta-bloqueador até 100mg"
        />
      </div>

      {errors.submit && <div className="error-banner">❌ {errors.submit}</div>}

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : plan ? 'Atualizar Plano' : 'Criar Plano'}
        </Button>
      </div>
    </form>
  )
}
