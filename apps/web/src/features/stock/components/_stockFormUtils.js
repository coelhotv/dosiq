import { formatLocalDate, getNow } from '@utils/dateUtils'

export const getInitialFormData = (initialValues = {}) => ({
  medicine_id: initialValues.medicine_id || '',
  quantity: initialValues.quantity ?? '',
  unit_price: initialValues.unit_price ?? '',
  purchase_date: initialValues.purchase_date || formatLocalDate(getNow()),
  expiration_date: initialValues.expiration_date || '',
  pharmacy: initialValues.pharmacy || '',
  laboratory: initialValues.laboratory || '',
  notes: initialValues.notes || '',
})

export const validateStockForm = (formData) => {
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

  return newErrors
}

export const buildStockPayload = (formData, effectiveLaboratory) => ({
  medicine_id: formData.medicine_id,
  quantity: parseFloat(formData.quantity),
  unit_price: formData.unit_price ? parseFloat(formData.unit_price) : 0,
  purchase_date: formData.purchase_date || null,
  expiration_date: formData.expiration_date || null,
  pharmacy: formData.pharmacy.trim() || null,
  laboratory: effectiveLaboratory,
  notes: formData.notes.trim() || null,
})
