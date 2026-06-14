import { formatLocalDate, getNow } from '@utils/dateUtils'
import { coerceDecimal, cleanFloat } from '@dosiq/core'

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
    // 012 Fase B4 (ADR-068): apresentação física do injetável, capturada por LOTE
    // nesta compra (persiste em stock+purchases via RPC). '' = não informado.
    injection_container: values.injection_container || '',
  }
}

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

export const buildStockPayload = (formData, effectiveLaboratory, isLiquid = false, isInjectable = false) => {
  const base = {
    medicine_id: formData.medicine_id,
    purchase_date: formData.purchase_date || null,
    expiration_date: formData.expiration_date || null,
    pharmacy: formData.pharmacy?.trim() || null,
    laboratory: effectiveLaboratory,
    notes: formData.notes?.trim() || null,
    // ADR-068: apresentação do lote — só p/ injetável; outras formas mandam null.
    injection_container: isInjectable ? formData.injection_container || null : null,
  }

  if (isLiquid) {
    // 012 B4 (ADR-068/022): líquido (qualquer apresentação) com X frascos vira X LOTES
    // — carrega os campos crus p/ o caller rotear ao createLiquidPurchase (split + custo
    // dividido + compensação de centavos no último lote). Mantém quantity/unit_price
    // agregados como fallback de exibição/compat.
    // Gemini #664: frascos é inteiro (lotes discretos). totalMl DEVE usar o nº já
    // truncado — senão 1,5 frascos calcularia 150 ml mas só 1 lote de 100 ml seria
    // criado (perda silenciosa de 50 ml). cleanFloat no produto (R-277).
    const numBottles = Math.trunc(coerceDecimal(formData.num_bottles) || 0)
    const volumePerBottle = coerceDecimal(formData.volume_per_bottle) || 0
    const totalMl = cleanFloat(numBottles * volumePerBottle)
    const totalPrice = formData.total_price ? coerceDecimal(formData.total_price) : 0
    // Math.floor 4 casas (não cleanFloat): trunca p/ não inflar centavos no FIFO (#651).
    const unitPrice = totalPrice > 0 && totalMl > 0 ? Math.floor((totalPrice / totalMl) * 10000) / 10000 : 0
    return {
      ...base,
      quantity: totalMl,
      unit_price: unitPrice,
      isLiquid: true,
      numBottles,
      volumePerBottle,
      totalPrice,
    }
  }

  return {
    ...base,
    quantity: coerceDecimal(formData.quantity),
    unit_price: formData.unit_price ? coerceDecimal(formData.unit_price) : 0,
  }
}
