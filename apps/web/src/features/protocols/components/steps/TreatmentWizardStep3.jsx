import Button from '@shared/components/ui/Button'

export default function TreatmentWizardStep3({
  stockData,
  updateStock,
  error,
  goBack,
  handleComplete,
  isSubmitting,
}) {
  return (
    <div className="wizard__step">
      <h3 className="wizard__title">Estoque Atual</h3>

      <label className="wizard__label">
        Quantidade (comprimidos)
        <input
          type="number"
          className="wizard__input"
          value={stockData.quantity}
          onChange={(e) => updateStock('quantity', e.target.value)}
          placeholder="60"
          min="0"
        />
      </label>

      <label className="wizard__label">
        Data da compra
        <input
          type="date"
          className="wizard__input"
          value={stockData.purchase_date}
          onChange={(e) => updateStock('purchase_date', e.target.value)}
        />
      </label>

      <label className="wizard__label">
        Preço unitário (R$)
        <input
          type="number"
          className="wizard__input"
          value={stockData.unit_price}
          onChange={(e) => updateStock('unit_price', e.target.value)}
          placeholder="0.75"
          min="0"
          step="0.01"
        />
      </label>

      <label className="wizard__label">
        Validade (opcional)
        <input
          type="date"
          className="wizard__input"
          value={stockData.expiration_date}
          onChange={(e) => updateStock('expiration_date', e.target.value)}
        />
      </label>

      {error && <div className="wizard__error">{error}</div>}

      <div className="wizard__actions">
        <Button variant="ghost" onClick={goBack}>
          ← Voltar
        </Button>
        <Button variant="ghost" onClick={() => handleComplete(true)} disabled={isSubmitting}>
          Pular
        </Button>
        <Button variant="primary" onClick={() => handleComplete(false)} disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Concluir'}
        </Button>
      </div>
    </div>
  )
}
