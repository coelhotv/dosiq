/**
 * Helper geral para validação de entidades
 * Fornece uma interface unificada para validação com Zod
 */

import { z } from 'zod'
import {
  validateMedicineCreate,
  validateMedicineUpdate,
  mapMedicineErrorsToForm,
  getMedicineErrorMessage
} from './medicineSchema'

import {
  validateProtocolCreate,
  validateProtocolUpdate,
  mapProtocolErrorsToForm,
  getProtocolErrorMessage
} from './protocolSchema'

import {
  validateStockCreate,
  validateStockUpdate,
  validateStockDecrease,
  validateStockIncrease,
  mapStockErrorsToForm,
  getStockErrorMessage
} from './stockSchema'

import {
  validateLogCreate,
  validateLogUpdate,
  validateLogBulkArray,
  mapLogErrorsToForm,
  mapBulkLogErrors,
  getLogErrorMessage,
  getBulkLogErrorMessage
} from './logSchema'

/**
 * Classe de erro de validação customizada
 */
export class ValidationError extends Error {
  constructor(message, errors, entityType) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
    this.entityType = entityType
  }
}

/**
 * Mapeia tipos de entidade para suas funções de validação
 */
const validationMap = {
  medicine: {
    create: validateMedicineCreate,
    update: validateMedicineUpdate,
    mapErrors: mapMedicineErrorsToForm,
    getMessage: getMedicineErrorMessage,
  },
  protocol: {
    create: validateProtocolCreate,
    update: validateProtocolUpdate,
    mapErrors: mapProtocolErrorsToForm,
    getMessage: getProtocolErrorMessage,
  },
  stock: {
    create: validateStockCreate,
    update: validateStockUpdate,
    decrease: validateStockDecrease,
    increase: validateStockIncrease,
    mapErrors: mapStockErrorsToForm,
    getMessage: getStockErrorMessage,
  },
  log: {
    create: validateLogCreate,
    update: validateLogUpdate,
    bulk: validateLogBulkArray,
    mapErrors: mapLogErrorsToForm,
    mapBulkErrors: mapBulkLogErrors,
    getMessage: getLogErrorMessage,
    getBulkMessage: getBulkLogErrorMessage,
  },
}

/**
 * Tipos de entidade suportados
 * @typedef {'medicine' | 'protocol' | 'stock' | 'log'} EntityType
 */

/**
 * Operações de validação suportadas
 * @typedef {'create' | 'update' | 'decrease' | 'increase' | 'bulk'} ValidationOperation
 */

/**
 * Valida uma entidade de forma genérica
 * 
 * @param {EntityType} entityType - Tipo da entidade
 * @param {Object} data - Dados a serem validados
 * @param {ValidationOperation} operation - Operação (create, update, etc.)
 * @returns {{ success: boolean, data?: Object, errors?: Array, error?: ValidationError }}
 * 
 * @example
 * const result = validateEntity('medicine', { name: 'Paracetamol', ... }, 'create')
 * if (!result.success) {
 *   console.log(result.errors)
 * }
 */
export function validateEntity(entityType, data, operation = 'create') {
  const validator = validationMap[entityType]
  
  if (!validator) {
    return {
      success: false,
      error: new ValidationError(
        `Tipo de entidade desconhecido: ${entityType}`,
        [{ field: 'entity', message: `Tipo "${entityType}" não é suportado` }],
        entityType
      )
    }
  }
  
  const validateFn = validator[operation]
  
  if (!validateFn) {
    return {
      success: false,
      error: new ValidationError(
        `Operação "${operation}" não suportada para ${entityType}`,
        [{ field: 'operation', message: `Operação "${operation}" não disponível` }],
        entityType
      )
    }
  }
  
  const result = validateFn(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const error = new ValidationError(
    validator.getMessage(result.errors),
    result.errors,
    entityType
  )
  
  return { success: false, errors: result.errors, error }
}

/**
 * Converte erros de validação para formato de formulário
 * 
 * @param {EntityType} entityType - Tipo da entidade
 * @param {Array} errors - Array de erros da validação
 * @param {boolean} isBulk - Se é validação em lote
 * @returns {Object} Erros mapeados para formulário
 */
export function mapErrorsToForm(entityType, errors, isBulk = false) {
  const validator = validationMap[entityType]
  
  if (!validator) {
    return { general: `Tipo de entidade desconhecido: ${entityType}` }
  }
  
  if (isBulk && validator.mapBulkErrors) {
    return validator.mapBulkErrors(errors)
  }
  
  return validator.mapErrors(errors)
}

/**
 * Obtém mensagem de erro formatada
 * 
 * @param {EntityType} entityType - Tipo da entidade
 * @param {Array} errors - Array de erros
 * @param {boolean} isBulk - Se é validação em lote
 * @returns {string} Mensagem formatada
 */
export function getErrorMessage(entityType, errors, isBulk = false) {
  const validator = validationMap[entityType]
  
  if (!validator) {
    return 'Erro de validação desconhecido'
  }
  
  if (isBulk && validator.getBulkMessage) {
    return validator.getBulkMessage(errors)
  }
  
  return validator.getMessage(errors)
}

/**
 * Valida um UUID
 * @param {string} id - ID a ser validado
 * @returns {boolean}
 */
export function isValidUUID(id) {
  const uuidSchema = z.string().uuid()
  return uuidSchema.safeParse(id).success
}

/**
 * Valida uma data no formato ISO
 * @param {string} date - Data a ser validada
 * @returns {boolean}
 */
export function isValidISODate(date) {
  const dateSchema = z.string().datetime()
  return dateSchema.safeParse(date).success
}

/**
 * Valida uma data no formato YYYY-MM-DD
 * @param {string} date - Data a ser validada
 * @returns {boolean}
 */
export function isValidDateString(date) {
  const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  if (!dateSchema.safeParse(date).success) return false
  
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

/**
 * Valida um horário no formato HH:MM
 * @param {string} time - Horário a ser validado
 * @returns {boolean}
 */
export function isValidTime(time) {
  const timeSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  return timeSchema.safeParse(time).success
}

/**
 * Sanitiza uma string removendo tags HTML e caracteres perigosos
 * @param {string} str - String a ser sanitizada
 * @returns {string}
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return ''
  
  return str
    .replace(/[<>]/g, '') // Remove < e >
    .trim()
    .slice(0, 1000) // Limita tamanho
}

/**
 * Hook helper para React - prepara estado de erros para formulários
 * 
 * @param {EntityType} entityType - Tipo da entidade
 * @returns {{
 *   validate: (data: Object, operation?: string) => { success: boolean, data?: Object, errors?: Array },
 *   getFormErrors: (errors: Array) => Object,
 *   getErrorMessage: (errors: Array) => string
 * }}
 * 
 * @example
 * const { validate, getFormErrors, getErrorMessage } = useValidation('medicine')
 * 
 * const handleSubmit = (data) => {
 *   const result = validate(data, 'create')
 *   if (!result.success) {
 *     setErrors(getFormErrors(result.errors))
 *     toast.error(getErrorMessage(result.errors))
 *     return
 *   }
 *   // Prossegue com envio...
 * }
 */
export function useValidationHelper(entityType) {
  return {
    validate: (data, operation = 'create') => validateEntity(entityType, data, operation),
    getFormErrors: (errors) => mapErrorsToForm(entityType, errors),
    getErrorMessage: (errors, isBulk = false) => getErrorMessage(entityType, errors, isBulk),
  }
}

export default {
  validateEntity,
  mapErrorsToForm,
  getErrorMessage,
  ValidationError,
  isValidUUID,
  isValidISODate,
  isValidDateString,
  isValidTime,
  sanitizeString,
  useValidationHelper,
}
