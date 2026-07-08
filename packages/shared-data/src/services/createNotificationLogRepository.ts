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
 * @param deps
 * @param deps.supabase - Cliente Supabase injetado
 * @returns {NotificationLogRepository}
 */
export function createNotificationLogRepository({
  supabase,
}: {
  // TODO(040-strict): `SupabaseClient<Database>` nominal diverge entre generic
  // instantiations de plataformas (web/mobile) dependendo da versão resolvida de
  // @supabase/supabase-js — tipagem estrutural equivalente causa "type instantiation
  // excessively deep" no consumidor (hooks nível A). Mantido como injeção duck-typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}) {
  if (!supabase) throw new Error('createNotificationLogRepository: supabase client is required')

  /**
   * Retorna os logs de notificação de um usuário, ordenados por data de envio.
   * R-130: Validado via Zod para garantir integridade do contrato.
   *
   * @param userId - ID do usuário (UUID)
   * @param options
   * @param options.limit - Limite de logs (padrão 20)
   * @param options.offset - Ponto de partida (padrão 0)
   * @returns Lista de logs validados
   */
  async function listByUserId(
    userId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
  ) {
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
      // Zod v4 usa .issues (não .errors como no v3)
      console.warn('[NotificationLogRepository] Data validation warning:', validationError.issues ?? validationError.message)
      return []
    }
  }

  return {
    listByUserId,
  }
}
