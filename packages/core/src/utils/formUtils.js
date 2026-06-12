export const getFieldDescribedBy = (fieldName, errors, hintId = null) =>
  [hintId, errors?.[fieldName] ? `${fieldName}-error` : null].filter(Boolean).join(' ') || undefined

/**
 * Coerção de decimal PT-BR (R-270/AP-167): o usuário digita "2,5" mas o banco só
 * aceita ponto. Aceita vírgula OU ponto e devolve Number. Inputs decimais na web
 * devem ser `type="text" inputMode="decimal"` (o `type="number"` do HTML bloqueia a
 * vírgula no browser) e normalizar com este helper na hora de persistir.
 * @param {string|number|null|undefined} value
 * @returns {number} NaN quando vazio/ inválido (deixa a validação decidir)
 */
export const coerceDecimal = (value) => parseFloat(String(value ?? '').replace(',', '.'))
