import { getFieldDescribedBy } from '@utils/formUtils'

export default function StockFormMedicineDetails({
  formData,
  errors,
  handleChange,
  medicines,
}) {
  return (
    <>
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
    </>
  )
}
