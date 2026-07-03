// packages/core/src/schemas/feedbackSchema.js
// Schema de validação para feedbacks de usuários

import { z } from 'zod'

/**
 * Schema Zod para validação de dados de feedback
 *
 * Campos:
 * - subject: Assunto/Título (obrigatório, 1-100 chars)
 * - comment: Comentário/Feedback (obrigatório, 1-2000 chars)
 * - rating: Avaliação do aplicativo (1 a 5 estrelas)
 * - platform: Plataforma ('ios', 'android', 'other')
 * - device: Modelo do dispositivo (opcional)
 * - app_version: Versão do aplicativo (opcional)
 */
const feedbackSchema = z.object({
  subject: z
    .string({ error: 'O assunto é obrigatório' })
    .min(1, 'O assunto não pode estar vazio')
    .max(100, 'O assunto não pode ter mais de 100 caracteres')
    .trim(),

  comment: z
    .string({ error: 'O comentário é obrigatório' })
    .min(1, 'O comentário não pode estar vazio')
    .max(2000, 'O comentário não pode ter mais de 2000 caracteres')
    .trim(),

  rating: z
    .number()
    .int('A avaliação deve ser um número inteiro')
    .min(1, 'A avaliação mínima é 1 estrela')
    .max(5, 'A avaliação máxima é 5 estrelas')
    .nullable()
    .optional(),

  platform: z
    .enum(['ios', 'android', 'other']),

  device: z
    .string()
    .trim()
    .nullable()
    .optional(),

  app_version: z
    .string()
    .trim()
    .nullable()
    .optional(),
})

/**
 * Validar criação de feedback
 * @param {Object} data
 * @returns {Object} { success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }
 */
export function validateFeedbackCreate(data: unknown) {
  const result = feedbackSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: String(issue.path[0]),
        message: issue.message,
      })),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

export default feedbackSchema
