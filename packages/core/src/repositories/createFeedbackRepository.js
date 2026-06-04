// packages/core/src/repositories/createFeedbackRepository.js
// Factory do repositório de feedback de usuários

import { validateFeedbackCreate } from '../schemas/feedbackSchema.js'

function formatValidationError(errors) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

/**
 * Cria o repositório para persistência de feedbacks enviados pelos usuários.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase.
 * @param {Function} deps.getUserId  Async () => string. Resolve o user_id autenticado.
 * @returns {{
 *   submitFeedback: (feedback: Object) => Promise<Object>
 * }}
 */
export function createFeedbackRepository({
  client,
  getUserId,
}) {
  if (!client) throw new Error('createFeedbackRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createFeedbackRepository: getUserId deve ser uma função async')
  }

  return {
    /**
     * Envia um feedback do usuário para o banco.
     *
     * @param {Object} feedback - Dados contendo subject, comment, rating, platform, device e app_version.
     * @returns {Promise<Object>} Registro criado no banco de dados.
     */
    async submitFeedback(feedback) {
      const validation = validateFeedbackCreate(feedback)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()

      const { data, error } = await client
        .from('feedbacks')
        .insert([{
          ...validation.data,
          user_id: userId
        }])
        .select()
        .single()

      if (error) throw error
      return data
    }
  }
}
