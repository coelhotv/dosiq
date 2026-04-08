import { useState } from 'react'
import Button from '@shared/components/ui/Button'
import { formatLocalDate } from '@utils/dateUtils'
import { getFieldDescribedBy } from '@utils/formUtils'
import './StockForm.css'

export default function StockForm({ medicines, initialValues, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    medicine_id: initialValues?.medicine_id || '',
    quantity: initialValues?.quantity ?? '',
    unit_price: initialValues?.unit_price ?? '',
    purchase_date: initialValues?.purchase_date || formatLocalDate(new Date()),
    expiration_date: initialValues?.expiration_date || '',
    pharmacy: initialValues?.pharmacy || '',
    laboratory: initialValues?.laboratory || '',
    notes: initialValues?.notes || '',
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

  const selectedMedicine =
    medicines.find((medicine) => medicine.id === formData.medicine_id) || null
  const regulatoryCategory = selectedMedicine?.regulatory_category || null
  const shouldAskPurchaseLaboratory = regulatoryCategory === 'Genérico'
  const fixedLaboratory = regulatoryCategory && regulatoryCategory !== 'Genérico'
  const effectiveLaboratory = shouldAskPurchaseLaboratory
    ? formData.laboratory.trim() || null
    : selectedMedicine?.laboratory || null

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
        expiration_date: formData.expiration_date || null,
        pharmacy: formData.pharmacy.trim() || null,
        laboratory: effectiveLaboratory,
        notes: formData.notes.trim() || null,
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
          aria-describedby={getFieldDescribedBy('medicine_id')}
          aria-invalid={Boolean(errors.medicine_id)}
        >
          <option value="">Selecione um medicamento</option>
          {medicines.map((medicine) => (
            <option key={medicine.id} value={medicine.id}>
              {medicine.name}{' '}
              {medicine.dosage_per_pill
                ? `(${medicine.dosage_per_pill}${medicine.dosage_unit || 'mg'})`
                : ''}
            </option>
          ))}
        </select>
        {errors.medicine_id && (
          <span id="medicine_id-error" className="error-message">
            {errors.medicine_id}
          </span>
        )}
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
            aria-describedby={getFieldDescribedBy('quantity')}
            aria-invalid={Boolean(errors.quantity)}
          />
          {errors.quantity && (
            <span id="quantity-error" className="error-message">
              {errors.quantity}
            </span>
          )}
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
            aria-describedby={getFieldDescribedBy('unit_price')}
            aria-invalid={Boolean(errors.unit_price)}
          />
          {errors.unit_price && (
            <span id="unit_price-error" className="error-message">
              {errors.unit_price}
            </span>
          )}
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
            aria-describedby={getFieldDescribedBy('expiration_date')}
            aria-invalid={Boolean(errors.expiration_date)}
          />
          {errors.expiration_date && (
            <span id="expiration_date-error" className="error-message">
              {errors.expiration_date}
            </span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pharmacy">Farmácia</label>
        <input
          type="text"
          id="pharmacy"
          name="pharmacy"
          value={formData.pharmacy}
          onChange={handleChange}
          placeholder="Ex: Drogasil, Drogaria São Paulo"
          maxLength={200}
        />
      </div>

      {shouldAskPurchaseLaboratory && (
        <div className="form-group">
          <label htmlFor="laboratory">Laboratório desta compra</label>
          <input
            type="text"
            id="laboratory"
            name="laboratory"
            value={formData.laboratory}
            onChange={handleChange}
            placeholder="Ex: EMS, Medley"
            maxLength={200}
            aria-describedby="laboratory-hint"
          />
          <small id="laboratory-hint" className="field-hint">
            Para genéricos, o laboratório pode variar a cada compra.
          </small>
        </div>
      )}

      {fixedLaboratory && effectiveLaboratory && (
        <div className="form-group">
          <label htmlFor="laboratory_fixed">Laboratório</label>
          <input
            type="text"
            id="laboratory_fixed"
            value={effectiveLaboratory}
            disabled
            readOnly
            aria-describedby="laboratory_fixed-hint"
          />
          <small id="laboratory_fixed-hint" className="field-hint">
            Para {regulatoryCategory?.toLowerCase()}, usamos o laboratório fixo do medicamento.
          </small>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="notes">Observações da compra</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Ex: promoção, lote especial, compra emergencial"
          rows="3"
          maxLength={500}
        />
      </div>

      {errors.submit && <div className="error-banner">❌ {errors.submit}</div>}

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Adicionar Estoque'}
        </Button>
      </div>
    </form>
  )
}
