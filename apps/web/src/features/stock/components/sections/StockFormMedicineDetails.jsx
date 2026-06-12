import { getFieldDescribedBy } from '@utils/formUtils'
import { formatActiveIngredientFormula, INJECTION_CONTAINERS, INJECTION_CONTAINER_LABELS } from '@dosiq/core'

export default function StockFormMedicineDetails({
  formData,
  errors,
  handleChange,
  medicines,
  isLiquid = false,
  needsContainer = false,
}) {
  const selectedMedicine = medicines?.find((m) => m.id === formData.medicine_id) || null
  const totalMl =
    parseFloat(formData.num_bottles) > 0 && parseFloat(formData.volume_per_bottle) > 0
      ? parseFloat(formData.num_bottles) * parseFloat(formData.volume_per_bottle)
      : 0

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

      {/* 012 Fase B2 (FR-019): apresentação física do injetável, captada na 1ª compra. */}
      {needsContainer && (
        <div className="form-group">
          <label htmlFor="injection_container">Apresentação (como vem embalado)</label>
          <select
            id="injection_container"
            name="injection_container"
            value={formData.injection_container}
            onChange={handleChange}
          >
            <option value="">Selecione (opcional)</option>
            {INJECTION_CONTAINERS.map((c) => (
              <option key={c} value={c}>{INJECTION_CONTAINER_LABELS[c]}</option>
            ))}
          </select>
          <span className="helper-text" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Ex.: caneta, ampola — usado para mostrar quantas aplicações restam.
          </span>
        </div>
      )}

      {isLiquid ? (
        <>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="num_bottles">
                Nº de frascos <span className="required">*</span>
              </label>
              <input
                type="number"
                id="num_bottles"
                name="num_bottles"
                value={formData.num_bottles}
                onChange={handleChange}
                className={errors.num_bottles ? 'error' : ''}
                placeholder="1"
                min="1"
                step="1"
                aria-invalid={Boolean(errors.num_bottles)}
              />
              {errors.num_bottles && (
                <span className="error-message">{errors.num_bottles}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="volume_per_bottle">
                Volume por frasco (ml) <span className="required">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="volume_per_bottle"
                name="volume_per_bottle"
                value={formData.volume_per_bottle}
                onChange={handleChange}
                className={errors.volume_per_bottle ? 'error' : ''}
                placeholder="100"
                aria-invalid={Boolean(errors.volume_per_bottle)}
              />
              {errors.volume_per_bottle && (
                <span className="error-message">{errors.volume_per_bottle}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="total_price">Preço total (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              id="total_price"
              name="total_price"
              value={formData.total_price}
              onChange={handleChange}
              className={errors.total_price ? 'error' : ''}
              placeholder="0,00"
              aria-invalid={Boolean(errors.total_price)}
            />
            {errors.total_price && (
              <span className="error-message">{errors.total_price}</span>
            )}
            {totalMl > 0 && (
              <span
                className="helper-text"
                style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}
              >
                💧 Total: {totalMl} ml em estoque
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">
              Quantidade <span className="required">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className={errors.quantity ? 'error' : ''}
              placeholder="30"
              aria-describedby={getFieldDescribedBy('quantity')}
              aria-invalid={Boolean(errors.quantity)}
            />
            {errors.quantity && (
              <span id="quantity-error" className="error-message">
                {errors.quantity}
              </span>
            )}
            {selectedMedicine && (
              <span className="helper-text active-ingredient-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                ✨ {formatActiveIngredientFormula(formData.quantity, selectedMedicine.dosage_per_pill, selectedMedicine.dosage_unit)}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="unit_price">Preço Unitário (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              id="unit_price"
              name="unit_price"
              value={formData.unit_price}
              onChange={handleChange}
              className={errors.unit_price ? 'error' : ''}
              placeholder="0,50"
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
      )}
    </>
  )
}
