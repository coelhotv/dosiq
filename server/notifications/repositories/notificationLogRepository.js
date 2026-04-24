// Repositório para gerenciar os logs de notificações enviadas
// Registra o histórico multicanal para consulta posterior na Inbox do usuário

import { supabase } from '../../services/supabase.js';
import { notificationLogCreateSchema } from '../../../packages/core/src/schemas/notificationLogSchema.js';

export const notificationLogRepository = {
  /**
   * Registra uma nova entrada no log de notificações
   * @param {Object} data - Dados da notificação (userId, protocolId, kind, status, etc)
   */
  async create(data) {
    const parsed = notificationLogCreateSchema.safeParse(data);
    
    if (!parsed.success) {
      throw new Error(`Dados de log inválidos: ${JSON.stringify(parsed.error?.format())}`);
    }

    const { error, data: insertedData } = await supabase
      .from('notification_log')
      .insert({
        user_id: parsed.data.user_id,
        protocol_id: parsed.data.protocol_id,
        notification_type: parsed.data.notification_type,
        status: parsed.data.status,
        sent_at: parsed.data.sent_at || new Date().toISOString(),
        telegram_message_id: parsed.data.telegram_message_id,
        mensagem_erro: parsed.data.mensagem_erro,
        provider_metadata: parsed.data.provider_metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[notificationLogRepository.create] Erro ao inserir log no Supabase:', {
        userId: parsed.data.user_id,
        error: error.message
      });
      throw new Error(`Erro ao persistir log: ${error.message}`);
    }

    return insertedData;
  },

  /**
   * Lista notificações de um usuário de forma paginada para a Inbox
   * (Será usado principalmente na v8.2/8.3, mas deixamos pronto o backend)
   */
  async listByUserId(userId, { limit = 20, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('notification_log')
      .select(`
        *,
        protocols:protocol_id (
          name,
          medicine_id (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[notificationLogRepository.listByUserId] Erro ao listar logs:', {
        userId,
        error: error.message
      });
      return [];
    }

    return data || [];
  }
};
