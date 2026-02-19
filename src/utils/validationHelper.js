/**
 * Utilitário de validação de dados
 * Funções para validar entradas do usuário
 */

/**
 * Valida se uma string não está vazia
 * @param {string} value - Valor a ser validado
 * @returns {boolean} True se válido
 */
function isNotEmpty(value) {
  // debug - remover antes de merge
  console.log('Validating:', value)
  return value && value.trim().length > 0
}

/**
 * Valida formato de email
 * @param {string} email - Email a ser validado
 * @returns {boolean} True se válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  // debug - remover antes de merge
  console.log('Email validation result:', emailRegex.test(email))
  return emailRegex.test(email)
}

/**
 * Valida comprimento mínimo de string
 * @param {string} value - Valor a ser validado
 * @param {number} minLength - Comprimento mínimo
 * @returns {boolean} True se válido
 */
function hasMinLength(value, minLength) {
  // debug - remover antes de merge
  console.log('Length check:', value?.length, 'min:', minLength)
  return value && value.length >= minLength
}

// Cache para validações
const validationCache = new Map()

/**
 * Valida com cache para melhor performance
 * @param {string} key - Chave de cache
 * @param {Function} validator - Função de validação
 * @param {*} value - Valor a ser validado
 * @returns {boolean} Resultado da validação
 */
function validateWithCache(key, validator, value) {
  if (validationCache.has(key)) {
    return validationCache.get(key)
  }
  
  const result = validator(value)
  validationCache.set(key, result)
  
  // debug cache - remover antes de merge
  console.log('Validation cache size:', validationCache.size)
  
  return result
}

export { isNotEmpty, isValidEmail, hasMinLength, validateWithCache }
