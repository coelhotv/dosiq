import { formatLocalDate, getNow } from '@utils/dateUtils'
import { coerceDecimal } from '@dosiq/core'

export const getInitialFormData = (initialValues) => {
  const values = initialValues || {}
  return {
    medicine_id: values.medicine_id || '',
    quantity: values.quantity ?? '',
    unit_price: values.unit_price ?? '',
    // Líquidos (022): estoque em ml. Coleta nº de frascos + volume/frasco + preço total.
    num_bottles: values.num_bottles ?? '',
    volume_per_bottle: values.volume_per_bottle ?? '',
    total_price: values.total_price ?? '',
    purchase_date: values.purchase_date || formatLocalDate(getNow()),
    expiration_date: values.expiration_date || '',
    pharmacy: values.pharmacy || '',
    laboratory: values.laboratory || '',
    notes: values.notes || '',
    // 012 Fase B2 (FR-019): apresentação física do injetável, capturada na 1ª
    // compra (persiste no medicine, não no stock). '' = não informado.
    injection_container: values.injection_container || '',
  }
}

// quantity (ml) derivada de frascos × volume p/ líquidos.
const liquidTotalMl = (formData) =>
  coerceDecimal(formData.num_bottles) * coerceDecimal(formData.volume_per_bottle)

export const validateStockForm = (formData, isLiquid = false) => {
  const newErrors = {}

  if (!formData.medicine_id) {
    newErrors.medicine_id = 'Selecione um medicamento'
  }

  if (isLiquid) {
    if (!formData.num_bottles || formData.num_bottles <= 0) {
      newErrors.num_bottles = 'Informe o número de frascos (maior que zero)'
    }
    const volume = coerceDecimal(formData.volume_per_bottle)
    if (Number.isNaN(volume) || volume <= 0) {
      newErrors.volume_per_bottle = 'Informe o volume por frasco em ml (maior que zero)'
    }
    if (formData.total_price && isNaN(coerceDecimal(formData.total_price))) {
      newErrors.total_price = 'Deve ser um número'
    }
  } else {
    const qty = coerceDecimal(formData.quantity)
    if (Number.isNaN(qty) || qty <= 0) {
      newErrors.quantity = 'Quantidade deve ser maior que zero'
    }
    if (formData.unit_price && isNaN(coerceDecimal(formData.unit_price))) {
      newErrors.unit_price = 'Deve ser um número'
    }
  }

  if (formData.expiration_date && formData.expiration_date < formData.purchase_date) {
    newErrors.expiration_date = 'Data de validade não pode ser anterior à compra'
  }

  return newErrors
}

export const buildStockPayload = (formData, effectiveLaboratory, isLiquid = false) => {
  const base = {
    medicine_id: formData.medicine_id,
    purchase_date: formData.purchase_date || null,
    expiration_date: formData.expiration_date || null,
    pharmacy: formData.pharmacy?.trim() || null,
    laboratory: effectiveLaboratory,
    notes: formData.notes?.trim() || null,
  }

  if (isLiquid) {
    const totalMl = liquidTotalMl(formData)
    const totalPrice = formData.total_price ? coerceDecimal(formData.total_price) : 0
    // Preço por ml (4 casas — review #651 trunca p/ não inflar centavos no FIFO).
    const unitPrice = totalPrice > 0 && totalMl > 0 ? Math.floor((totalPrice / totalMl) * 10000) / 10000 : 0
    return { ...base, quantity: totalMl, unit_price: unitPrice }
  }

  return {
    ...base,
    quantity: coerceDecimal(formData.quantity),
    unit_price: formData.unit_price ? coerceDecimal(formData.unit_price) : 0,
  }
}
