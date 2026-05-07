import { formatLocalDate, getNow } from '@utils/dateUtils'

export const getInitialFormData = (initialValues) => {
  const values = initialValues || {}
  return {
    medicine_id: values.medicine_id || '',
    quantity: values.quantity ?? '',
    unit_price: values.unit_price ?? '',
    purchase_date: values.purchase_date || formatLocalDate(getNow()),
    expiration_date: values.expiration_date || '',
    pharmacy: values.pharmacy || '',
    laboratory: values.laboratory || '',
    notes: values.notes || '',
  }
}

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
  pharmacy: formData.pharmacy?.trim() || null,
  laboratory: effectiveLaboratory,
  notes: formData.notes?.trim() || null,
})
