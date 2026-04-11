// src/schemas/userProfileSchema.js
// Schema de validação para dados de perfil do usuário (Wave 10B)

import { z } from 'zod'

/**
 * Estados brasileiros (UF)
 * Usado em validação de seleção no formulário "Editar Perfil"
 */
export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]

/**
 * Schema Zod para validação de dados de perfil do usuário
 *
 * Campos:
 * - display_name: Nome de exibição (obrigatório, 2-200 chars)
 * - birth_date: Data de nascimento (opcional, formato YYYY-MM-DD)
 * - city: Cidade (opcional, até 100 chars)
 * - state: Estado UF (opcional, sigla ou texto livre até 50 chars)
 *
 * Nota sobre .nullable().optional():
 * - .nullable() permite null explícito
 * - .optional() permite undefined (quando campo não é enviado)
 * - Juntos: o campo pode ser undefined, null ou o tipo esperado
 */
const userProfileSchema = z.object({
  display_name: z
    .string('Nome é obrigatório')
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),

  birth_date: z
    .string()
    .date('Data de nascimento inválida (formato: YYYY-MM-DD)')
    .nullable()
    .optional(),

  city: z
    .string()
    .max(100, 'Cidade não pode ter mais de 100 caracteres')
    .trim()
    .nullable()
    .optional(),

  state: z
    .union([z.enum(BRAZILIAN_STATES), z.literal('')])
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
})

/**
 * Validar dados de perfil do usuário
 * @param {Object} data - { display_name, birth_date, city, state }
 * @returns {Object} { success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }
 */
export function validateUserProfile(data) {
  const result = userProfileSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

export default userProfileSchema
