import { z } from 'zod'
import { getServerTimestamp } from '../utils/dateUtils.js'

/**
 * Schema de validação para o Cartão de Emergência
 * Funciona offline e armazena informações médicas críticas
 */

// Tipos sanguíneos válidos
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'desconhecido']

// Labels dos tipos sanguíneos para exibição
export const BLOOD_TYPE_LABELS = {
  'A+': 'A+',
  'A-': 'A-',
  'B+': 'B+',
  'B-': 'B-',
  'AB+': 'AB+',
  'AB-': 'AB-',
  'O+': 'O+',
  'O-': 'O-',
  desconhecido: 'Desconhecido',
}

// Regex para validação de telefone brasileiro
// Aceita: (XX) XXXXX-XXXX, (XX) XXXX-XXXX, XX XXXXX-XXXX, +55 XX XXXXX-XXXX
const BRAZILIAN_PHONE_REGEX =
  /^(\+55\s?)?(\(?[1-9]{2}\)?\s?)?(9[0-9]{4}|[2-8][0-9]{3})[-\s]?[0-9]{4}$/

/**
 * Schema para contato de emergência
 */
export const emergencyContactSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),

  phone: z
    .string()
    .min(8, 'Telefone deve ter pelo menos 8 dígitos')
    .max(20, 'Telefone não pode ter mais de 20 caracteres')
    .regex(
      BRAZILIAN_PHONE_REGEX,
      'Formato de telefone inválido. Use: (XX) XXXXX-XXXX ou +55 XX XXXXX-XXXX'
    ),

  relationship: z
    .string()
    .min(2, 'Parentesco deve ter pelo menos 2 caracteres')
    .max(100, 'Parentesco não pode ter mais de 100 caracteres')
    .trim(),
})

/**
 * Schema base para o cartão de emergência
 */
export const emergencyCardSchema = z.object({
  emergency_contacts: z
    .array(emergencyContactSchema)
    .min(1, 'Adicione pelo menos um contato de emergência')
    .max(5, 'Máximo de 5 contatos de emergência permitidos'),

  allergies: z
    .array(
      z
        .string()
        .min(1, 'Alergia não pode estar vazia')
        .max(200, 'Nome da alergia não pode ter mais de 200 caracteres')
        .trim()
    )
    .max(20, 'Máximo de 20 alergias permitidas')
    .default([]),

  blood_type: z.enum(BLOOD_TYPES, {
    errorMap: () => ({
      message: 'Tipo sanguíneo inválido. Opções: A+, A-, B+, B-, AB+, AB-, O+, O-, desconhecido',
    }),
  }),

  notes: z
    .string()
    .max(1000, 'Observações não podem ter mais de 1000 caracteres')
    .nullable()
    .optional()
    .transform((val) => val || null),

  last_updated: z
    .string()
    .datetime('Data de atualização deve ser uma data válida (ISO 8601)')
    .default(() => getServerTimestamp()),
})

/**
 * Schema para criação do cartão de emergência
 */
export const emergencyCardCreateSchema = emergencyCardSchema

/**
 * Schema para atualização do cartão de emergência (campos opcionais)
 */
export const emergencyCardUpdateSchema = emergencyCardSchema.partial()

/**
 * Schema completo com ID do usuário
 */
export const emergencyCardFullSchema = emergencyCardSchema.extend({
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
})

/**
 * Valida um objeto de cartão de emergência
 * @param {Object} data - Dados do cartão de emergência
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateEmergencyCard(data) {
  const result = emergencyCardSchema.safeParse(data)

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
 * Valida dados para criação do cartão de emergência
 * @param {Object} data - Dados do cartão de emergência
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateEmergencyCardCreate(data) {
  return validateEmergencyCard(data)
}

/**
 * Valida dados para atualização do cartão de emergência
 * @param {Object} data - Dados do cartão de emergência
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateEmergencyCardUpdate(data) {
  const result = emergencyCardUpdateSchema.safeParse(data)

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
 * Valida um contato de emergência individual
 * @param {Object} contact - Dados do contato
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateEmergencyContact(contact) {
  const result = emergencyContactSchema.safeParse(contact)

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
export function mapEmergencyCardErrorsToForm(zodErrors) {
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
export function getEmergencyCardErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default emergencyCardSchema
