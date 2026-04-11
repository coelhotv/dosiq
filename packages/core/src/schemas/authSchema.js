// src/schemas/authSchema.js
// Schemas de validação para autenticação e segurança

import { z } from 'zod'

/**
 * Schema para validação de troca de senha
 * - Mínimo 6 caracteres (padrão Supabase)
 * - Máximo 128 caracteres (limite razoável)
 * - Sem whitespace no início/fim
 */
const passwordChangeSchema = z.object({
  newPassword: z
    .string()
    .trim()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(128, 'Senha deve ter no máximo 128 caracteres')
    .refine((pass) => pass.length >= 6, 'Senha deve ter no mínimo 6 caracteres'),
})

/**
 * Validar troca de senha
 * @param {Object} input - { newPassword: string }
 * @returns {Object} { success: boolean, data?: Object, error?: string }
 */
export function validatePasswordChange(input) {
  const result = passwordChangeSchema.safeParse(input)
  if (!result.success) {
    const error = result.error.issues[0]
    return {
      success: false,
      error: error.message,
    }
  }
  return {
    success: true,
    data: result.data,
  }
}

export default {
  validatePasswordChange,
}
