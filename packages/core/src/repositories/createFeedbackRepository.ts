// packages/core/src/repositories/createFeedbackRepository.js
// Factory do repositório de feedback de usuários

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { validateFeedbackCreate } from '../schemas/feedbackSchema'

interface ValidationError {
  field: string
  message: string
}

function formatValidationError(errors: ValidationError[]) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

interface CreateFeedbackRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

/**
 * Cria o repositório para persistência de feedbacks enviados pelos usuários.
 */
export function createFeedbackRepository({
  client,
  getUserId,
}: CreateFeedbackRepositoryDeps) {
  if (!client) throw new Error('createFeedbackRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createFeedbackRepository: getUserId deve ser uma função async')
  }

  return {
    /**
     * Envia um feedback do usuário para o banco.
     *
     * @param feedback - Dados contendo subject, comment, rating, platform, device e app_version.
     */
    async submitFeedback(feedback: Record<string, unknown>) {
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
