import { useState } from 'react'
import Button from '../ui/Button'
import { MEDICINE_TYPES } from '../../schemas/medicineSchema'
import './MedicineForm.css'

export default function MedicineForm({ medicine, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: medicine?.name || '',
    laboratory: medicine?.laboratory || '',
    active_ingredient: medicine?.active_ingredient || '',
    dosage_per_pill: medicine?.dosage_per_pill || '',
    type: medicine?.type || 'medicamento',
    dosage_unit: medicine?.dosage_unit || 'mg'
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Limpa erro do campo quando usuário começa a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }
    
    // Dosage is optional for supplements, but must be active number if provided
    if (formData.dosage_per_pill && isNaN(formData.dosage_per_pill)) {
      newErrors.dosage_per_pill = 'Deve ser um número'
    } else if (formData.type === 'medicamento' && !formData.dosage_per_pill) {
      // For medicines, we generally want a dosage, but maybe not strict? 
      // strict 'medicine' usually implies a mg value. 
      // Let's keep it optional but recommended, or strict if existing logic was strict.
      // Eexisting logic: if (formData.dosage_per_pill && isNaN...) -> it was optional before?
      // Logic from lines 32-34: "if (formData.dosage_per_pill && isNaN...)" implies it was already optional but if present must be number.
      // So no change needed for optionality, just keeping the number check.
    }
    
    setErrors(newErrors)
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
        dosage_unit: formData.dosage_unit
      }
      
      await onSave(dataToSave)
    } catch (error) {
      console.error('Erro ao salvar medicamento:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao salvar medicamento'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="medicine-form" onSubmit={handleSubmit}>
      <h3>{medicine ? 'Editar Medicamento' : 'Novo Medicamento'}</h3>
      
      <div className="form-group">
        <label htmlFor="type">Tipo</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
        >
          {MEDICINE_TYPES.map(type => (
            <option key={type} value={type}>
              {type === 'medicamento' ? 'Medicamento' : 'Suplemento'}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="name">
          Nome {formData.type === 'suplemento' ? '(Comercial)' : 'do Remédio'} <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={errors.name ? 'error' : ''}
          placeholder="Ex: Paracetamol"
          autoFocus
        />
        {errors.name && <span className="error-message">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="active_ingredient">Princípio Ativo</label>
        <input
          type="text"
          id="active_ingredient"
          name="active_ingredient"
          value={formData.active_ingredient}
          onChange={handleChange}
          placeholder="Ex: Paracetamol"
        />
      </div>

      <div className="form-group">
        <label htmlFor="laboratory">Marca / Laboratório</label>
        <input
          type="text"
          id="laboratory"
          name="laboratory"
          value={formData.laboratory}
          onChange={handleChange}
          placeholder="Ex: EMS, Medley, etc."
        />
      </div>

      <div className="form-group">
        <label htmlFor="dosage_per_pill">Dosagem</label>
        <div className="dosage-input-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
          <input
            type="number"
            id="dosage_per_pill"
            name="dosage_per_pill"
            value={formData.dosage_per_pill}
            onChange={handleChange}
            className={errors.dosage_per_pill ? 'error' : ''}
            placeholder={formData.type === 'suplemento' ? 'Opcional' : '500'}
            step="0.01"
          />
          <select
            name="dosage_unit"
            value={formData.dosage_unit}
            onChange={handleChange}
          >
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="ui">UI</option>
            <option value="cp">cp/cap</option>
            <option value="gotas">gotas</option>
          </select>
        </div>
        {errors.dosage_per_pill && <span className="error-message">{errors.dosage_per_pill}</span>}
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
          {isSubmitting ? 'Salvando...' : medicine ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  )
}
