import { useState } from 'react'
import Button from '../ui/Button'
import './StockForm.css'

export default function StockForm({ medicines, initialValues, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    medicine_id: initialValues?.medicine_id || '',
    quantity: '',
    unit_price: '',
    purchase_date: new Date().toISOString().split('T')[0],
    expiration_date: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    
    if (!formData.medicine_id) {
      newErrors.medicine_id = 'Selecione um medicamento'
    }
    
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantidade deve ser maior que zero'
    }

    if (formData.unit_price && isNaN(formData.unit_price)) {
      newErrors.unit_price = 'Deve ser um número'
    }
    
    if (formData.expiration_date && formData.expiration_date < formData.purchase_date) {
      newErrors.expiration_date = 'Data de validade não pode ser anterior à compra'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const dataToSave = {
        medicine_id: formData.medicine_id,
        quantity: parseFloat(formData.quantity),
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : 0,
        purchase_date: formData.purchase_date || null,
        expiration_date: formData.expiration_date || null
      }
      
      await onSave(dataToSave)
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setErrors({ submit: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="stock-form" onSubmit={handleSubmit}>
      <h3>Adicionar Estoque</h3>
      
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
        >
          <option value="">Selecione um medicamento</option>
          {medicines.map(medicine => (
            <option key={medicine.id} value={medicine.id}>
              {medicine.name} {medicine.dosage_per_pill ? `(${medicine.dosage_per_pill}${medicine.dosage_unit || 'mg'})` : ''}
            </option>
          ))}
        </select>
        {errors.medicine_id && <span className="error-message">{errors.medicine_id}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="quantity">
            Quantidade <span className="required">*</span>
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            className={errors.quantity ? 'error' : ''}
            placeholder="30"
            min="0.1"
            step="0.1"
          />
          {errors.quantity && <span className="error-message">{errors.quantity}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="unit_price">Preço Unitário (R$)</label>
          <input
            type="number"
            id="unit_price"
            name="unit_price"
            value={formData.unit_price}
            onChange={handleChange}
            className={errors.unit_price ? 'error' : ''}
            placeholder="0.50"
            step="0.001"
            min="0"
          />
          {errors.unit_price && <span className="error-message">{errors.unit_price}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="purchase_date">Data da Compra</label>
          <input
            type="date"
            id="purchase_date"
            name="purchase_date"
            value={formData.purchase_date}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="expiration_date">Data de Validade</label>
          <input
            type="date"
            id="expiration_date"
            name="expiration_date"
            value={formData.expiration_date}
            onChange={handleChange}
            className={errors.expiration_date ? 'error' : ''}
          />
          {errors.expiration_date && <span className="error-message">{errors.expiration_date}</span>}
        </div>
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
          {isSubmitting ? 'Salvando...' : 'Adicionar Estoque'}
        </Button>
      </div>
    </form>
  )
}
