import { getFieldDescribedBy } from '@utils/formUtils'

export default function StockFormPurchaseDetails({
  formData,
  errors,
  handleChange,
  shouldAskPurchaseLaboratory,
  fixedLaboratory,
  effectiveLaboratory,
  regulatoryCategory,
}) {
  return (
    <>
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
    </>
  )
}
