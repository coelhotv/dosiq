import { z } from 'zod'

/**
 * Schema de validação para Medicamentos
 * Baseado na tabela 'medicines' do Supabase
 */

// Unidades de dosagem válidas (alinhadas com MedicineForm.jsx dropdown)
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'ui', 'cp', 'gotas']

// Labels de unidade para exibição
export const DOSAGE_UNIT_LABELS = {
  mg: 'mg',
  mcg: 'mcg',
  g: 'g',
  ml: 'ml',
  ui: 'UI',
  cp: 'cp/cap',
  gotas: 'gotas',
}

// Tipos de medicamento
export const MEDICINE_TYPES = ['medicamento', 'suplemento']

// Labels de tipo para exibição
export const MEDICINE_TYPE_LABELS = {
  medicamento: 'Medicamento',
  suplemento: 'Suplemento',
}

/**
 * Schema base para medicamento
 */
export const medicineSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),

  laboratory: z
    .string()
    .max(200, 'Laboratório não pode ter mais de 200 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  active_ingredient: z
    .string()
    .max(300, 'Princípio ativo não pode ter mais de 300 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  dosage_per_pill: z
    .number()
    .positive('Dosagem deve ser maior que zero')
    .max(10000, 'Dosagem parece estar muito alta. Verifique o valor'),

  dosage_unit: z.enum(DOSAGE_UNITS, {
    errorMap: () => ({
      message: 'Unidade de dosagem inválida. Use: mg, mcg, g, ml, UI, cp ou gotas',
    }),
  }),

  type: z
    .enum(MEDICINE_TYPES, {
      errorMap: () => ({ message: 'Tipo inválido. Opções: medicamento, suplemento' }),
    })
    .default('medicamento'),
})

/**
 * Schema para criação de medicamento (sem id)
 */
export const medicineCreateSchema = medicineSchema

/**
 * Schema para atualização de medicamento (campos opcionais)
 */
export const medicineUpdateSchema = medicineSchema.partial()

/**
 * Schema completo com ID (para validação de dados do backend)
 */
export const medicineFullSchema = medicineSchema.extend({
  id: z.string().uuid('ID do medicamento deve ser um UUID válido'),
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

/**
 * Valida um objeto de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicine(data) {
  const result = medicineSchema.safeParse(data)

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
 * Valida dados para criação de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineCreate(data) {
  const result = medicineCreateSchema.safeParse(data)

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
 * Valida dados para atualização de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineUpdate(data) {
  const result = medicineUpdateSchema.safeParse(data)

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
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapMedicineErrorsToForm(zodErrors) {
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
 * Obtém mensagem de erro geral para exibição
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem formatada
 */
export function getMedicineErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default medicineSchema
