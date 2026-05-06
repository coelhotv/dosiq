import { AlertCircle } from 'lucide-react'
import Button from '@shared/components/ui/Button'
import { useStockFormState } from '@features/stock/components/_useStockFormState.js'
import StockFormMedicineDetails from '@features/stock/components/sections/StockFormMedicineDetails.jsx'
import StockFormPurchaseDetails from '@features/stock/components/sections/StockFormPurchaseDetails.jsx'
import './StockForm.css'

export default function StockForm({ medicines, initialValues, onSave, onCancel }) {
  const {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    shouldAskPurchaseLaboratory,
    fixedLaboratory,
    effectiveLaboratory,
    regulatoryCategory,
  } = useStockFormState({ medicines, initialValues, onSave })

  return (
    <form className="stock-form" onSubmit={handleSubmit}>
      <h3>Adicionar Estoque</h3>

      <StockFormMedicineDetails
        formData={formData}
        errors={errors}
        handleChange={handleChange}
        medicines={medicines}
      />

      <StockFormPurchaseDetails
        formData={formData}
        errors={errors}
        handleChange={handleChange}
        shouldAskPurchaseLaboratory={shouldAskPurchaseLaboratory}
        fixedLaboratory={fixedLaboratory}
        effectiveLaboratory={effectiveLaboratory}
        regulatoryCategory={regulatoryCategory}
      />

      {errors.submit && (
        <div className="error-banner">
          <AlertCircle size={18} /> {errors.submit}
        </div>
      )}

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

