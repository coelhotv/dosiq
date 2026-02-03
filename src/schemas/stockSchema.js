import { z } from 'zod'

/**
 * Schema de validação para Estoque
 * Baseado na tabela 'stock' do Supabase
 */

/**
 * Schema base para entrada de estoque
 */
export const stockSchema = z.object({
  medicine_id: z
    .string()
    .uuid('ID do medicamento deve ser um UUID válido'),
  
  quantity: z
    .number()
    .positive('Quantidade deve ser maior que zero')
    .max(10000, 'Quantidade parece estar muito alta. Verifique o valor'),
  
  purchase_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de compra deve estar no formato YYYY-MM-DD')
    .refine((date) => {
      const parsed = new Date(date)
      return !isNaN(parsed.getTime())
    }, 'Data de compra inválida')
    .refine((date) => {
      const parsed = new Date(date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return parsed <= today
    }, 'Data de compra não pode ser no futuro'),
  
  expiration_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de validade deve estar no formato YYYY-MM-DD')
    .refine((date) => {
      if (!date) return true
      const parsed = new Date(date)
      return !isNaN(parsed.getTime())
    }, 'Data de validade inválida')
    .optional()
    .nullable()
    .transform(val => val || null),
  
  unit_price: z
    .number()
    .min(0, 'Preço unitário não pode ser negativo')
    .max(100000, 'Preço unitário parece estar muito alto')
    .optional()
    .default(0),
  
  notes: z
    .string()
    .max(500, 'Notas não podem ter mais de 500 caracteres')
    .optional()
    .nullable()
    .transform(val => val || null),
})

/**
 * Schema refinado com validação cruzada de datas
 */
export const stockCreateSchema = stockSchema.refine(
  (data) => {
    if (!data.expiration_date) return true
    
    const purchase = new Date(data.purchase_date)
    const expiration = new Date(data.expiration_date)
    
    return expiration > purchase
  },
  {
    message: 'Data de validade deve ser posterior à data de compra',
    path: ['expiration_date'],
  }
).refine(
  (data) => {
    if (!data.expiration_date) return true
    
    const expiration = new Date(data.expiration_date)
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    // Data de validade não pode estar mais de 1 ano no passado
    return expiration >= oneYearAgo
  },
  {
    message: 'Data de validade está muito no passado. Verifique se o medicamento não está vencido',
    path: ['expiration_date'],
  }
)

/**
 * Schema para atualização de estoque (campos opcionais)
 */
export const stockUpdateSchema = stockSchema.partial()

/**
 * Schema completo com ID
 */
export const stockFullSchema = stockSchema.extend({
  id: z.string().uuid('ID do estoque deve ser um UUID válido'),
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

/**
 * Schema para operação de diminuição de estoque
 */
export const stockDecreaseSchema = z.object({
  medicine_id: z
    .string()
    .uuid('ID do medicamento deve ser um UUID válido'),
  
  quantity: z
    .number()
    .positive('Quantidade a diminuir deve ser maior que zero')
    .max(1000, 'Quantidade máxima por operação é 1000'),
})

/**
 * Schema para operação de aumento de estoque (ajuste/estorno)
 */
export const stockIncreaseSchema = z.object({
  medicine_id: z
    .string()
    .uuid('ID do medicamento deve ser um UUID válido'),
  
  quantity: z
    .number()
    .positive('Quantidade a adicionar deve ser maior que zero')
    .max(1000, 'Quantidade máxima por operação é 1000'),
  
  reason: z
    .string()
    .max(200, 'Motivo não pode ter mais de 200 caracteres')
    .optional()
    .default('Ajuste de estoque'),
})

/**
 * Valida um objeto de estoque
 * @param {Object} data - Dados do estoque
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateStock(data) {
  const result = stockCreateSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Valida dados para criação de entrada de estoque
 * @param {Object} data - Dados do estoque
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateStockCreate(data) {
  return validateStock(data)
}

/**
 * Valida dados para atualização de estoque
 * @param {Object} data - Dados do estoque
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateStockUpdate(data) {
  const result = stockUpdateSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Valida operação de diminuição de estoque
 * @param {Object} data - Dados da operação
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateStockDecrease(data) {
  const result = stockDecreaseSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Valida operação de aumento de estoque
 * @param {Object} data - Dados da operação
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateStockIncrease(data) {
  const result = stockIncreaseSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapStockErrorsToForm(zodErrors) {
  const formErrors = {}
  
  zodErrors.forEach(error => {
    const field = error.path[0]
    if (!formErrors[field]) {
      formErrors[field] = error.message
    }
  })
  
  return formErrors
}

/**
 * Obtém mensagem de erro geral para exibição
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem formatada
 */
export function getStockErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''
  
  if (errors.length === 1) {
    return errors[0].message
  }
  
  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default stockSchema
