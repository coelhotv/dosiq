/**
 * createNotificationLogRepository — Factory para repositório de log de notificações
 *
 * Fornece acesso aos logs de notificações de forma independente de plataforma.
 * O cliente Supabase é injetado pelo chamador.
 *
 * @module createNotificationLogRepository
 */

import { notificationLogSchema } from '@dosiq/core'
import { z } from 'zod'

/**
 * @typedef {Object} NotificationLogRepository
 * @property {function(string, Object): Promise<Array>} listByUserId - Lista logs de um usuário
 */

/**
 * Cria uma instância do repositório de logs de notificações.
 *
 * @param {Object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase - Cliente Supabase injetado
 * @returns {NotificationLogRepository}
 */
export function createNotificationLogRepository({ supabase }) {
  if (!supabase) throw new Error('createNotificationLogRepository: supabase client is required')

  /**
   * Retorna os logs de notificação de um usuário, ordenados por data de envio.
   * R-130: Validado via Zod para garantir integridade do contrato.
   *
   * @param {string} userId - ID do usuário (UUID)
   * @param {Object} [options]
   * @param {number} [options.limit=20] - Limite de logs (padrão 20)
   * @param {number} [options.offset=0] - Ponto de partida (padrão 0)
   * @returns {Promise<Array>} Lista de logs validados
   */
  async function listByUserId(userId, { limit = 20, offset = 0 } = {}) {
    if (!userId) {
      throw new Error('listByUserId: userId is required')
    }

    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[NotificationLogRepository] Error fetching logs:', error.message)
      throw error
    }

    // R-130: Validação de saída (Read check)
    // Usamos array de schemas para validar a lista
    try {
      return z.array(notificationLogSchema).parse(data || [])
    } catch (validationError) {
      console.warn('[NotificationLogRepository] Data validation warning:', validationError.errors)
      // R-130: Integridade estrita - se os dados falharem na validação, 
      // retornamos vazio para evitar que dados corrompidos atinjam a UI.
      return []
    }
  }

  return {
    listByUserId,
  }
}
