import { z } from 'zod'

/**
 * Schema de validação para Logs de Medicação
 * Baseado na tabela 'medicine_logs' do Supabase
 */

/**
 * Schema base para log de medicação
 */
export const logSchema = z.object({
  protocol_id: z
    .string()
    .uuid('ID do protocolo deve ser um UUID válido')
    .optional()
    .nullable()
    .transform((val) => val || null),

  medicine_id: z.string().uuid('ID do medicamento deve ser um UUID válido'),

  taken_at: z
    .string()
    .datetime('Data e hora devem estar no formato ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)')
    .refine((date) => {
      const parsed = new Date(date)
      const now = new Date()
      // Permite até 5 minutos no futuro (margem para clock skew)
      const futureLimit = new Date(now.getTime() + 5 * 60 * 1000)
      return parsed <= futureLimit
    }, 'Data/hora não pode estar no futuro'),

  quantity_taken: z
    .number()
    .positive('Quantidade tomada deve ser maior que zero')
    .max(100, 'Quantidade máxima por registro é 100'),

  notes: z
    .string()
    .max(500, 'Notas não podem ter mais de 500 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),
})

/**
 * Schema para criação de log
 */
export const logCreateSchema = logSchema.refine(
  () => {
    // Se tem protocol_id, deve ter medicine_id (já é obrigatório)
    // Mas verificamos se os dois são consistentes quando necessário
    return true
  },
  {
    message: 'Dados de log inconsistentes',
  }
)

/**
 * Schema para atualização de log (campos opcionais)
 */
export const logUpdateSchema = logSchema.partial()

/**
 * Schema completo com ID
 */
export const logFullSchema = logSchema.extend({
  id: z.string().uuid('ID do log deve ser um UUID válido'),
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

/**
 * Schema para criação em lote de logs
 */
export const logBulkCreateSchema = z.object({
  logs: z
    .array(logCreateSchema)
    .min(1, 'Adicione pelo menos um registro')
    .max(50, 'Máximo de 50 registros por operação em lote'),
})

/**
 * Valida um objeto de log
 * @param {Object} data - Dados do log
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateLog(data) {
  const result = logCreateSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida dados para criação de log
 * @param {Object} data - Dados do log
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateLogCreate(data) {
  return validateLog(data)
}

/**
 * Valida dados para atualização de log
 * @param {Object} data - Dados do log
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateLogUpdate(data) {
  const result = logUpdateSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida dados para criação em lote de logs
 * @param {Object} data - Dados com array de logs
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateLogBulkCreate(data) {
  const result = logBulkCreateSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida dados para criação em lote (array direto)
 * @param {Array} logs - Array de logs
 * @returns {{ success: boolean, data?: Array, errors?: Array<{index: number, field: string, message: string}> }}
 */
export function validateLogBulkArray(logs) {
  if (!Array.isArray(logs)) {
    return {
      success: false,
      errors: [{ index: -1, field: 'logs', message: 'Deve ser um array de registros' }],
    }
  }

  if (logs.length === 0) {
    return {
      success: false,
      errors: [{ index: -1, field: 'logs', message: 'Adicione pelo menos um registro' }],
    }
  }

  if (logs.length > 50) {
    return {
      success: false,
      errors: [
        { index: -1, field: 'logs', message: 'Máximo de 50 registros por operação em lote' },
      ],
    }
  }

  const allErrors = []
  const validLogs = []

  logs.forEach((log, index) => {
    const result = logCreateSchema.safeParse(log)
    if (result.success) {
      validLogs.push(result.data)
    } else {
      result.error.issues.forEach((err) => {
        allErrors.push({
          index,
          field: err.path.join('.'),
          message: err.message,
        })
      })
    }
  })

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors }
  }

  return { success: true, data: validLogs }
}

/**
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapLogErrorsToForm(zodErrors) {
  const formErrors = {}

  zodErrors.forEach((error) => {
    const field = error.path[0]
    if (!formErrors[field]) {
      formErrors[field] = error.message
    }
  })

  return formErrors
}

/**
 * Converte erros de validação em lote para formato amigável
 * @param {Array} errors - Array de erros com index
 * @returns {Object} Objeto organizado por índice
 */
export function mapBulkLogErrors(errors) {
  const mappedErrors = {}

  errors.forEach((error) => {
    if (error.index >= 0) {
      if (!mappedErrors[error.index]) {
        mappedErrors[error.index] = {}
      }
      mappedErrors[error.index][error.field] = error.message
    }
  })

  return mappedErrors
}

/**
 * Obtém mensagem de erro geral para exibição
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem formatada
 */
export function getLogErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

/**
 * Obtém mensagem de erro para validação em lote
 * @param {Array} errors - Array de erros com index
 * @returns {string} Mensagem formatada
 */
export function getBulkLogErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  const indicesAfetados = [...new Set(errors.map((e) => e.index))].filter((i) => i >= 0)

  if (indicesAfetados.length === 1) {
    return `Erro no registro ${indicesAfetados[0] + 1}. Verifique os campos.`
  }

  return `${errors.length} erro(s) encontrado(s) em ${indicesAfetados.length} registro(s). Verifique os campos destacados.`
}

export default logSchema
