
import { supabase } from './supabase.js';

const DEDUP_WINDOW_MINUTES = 5; // Don't send same notification twice within 5 minutes

/**
 * Verifica se a notificação deve ser enviada (sem duplicatas)
 * NÃO mais loga automaticamente - o log deve ser feito APÓS envio confirmado
 * @param {string} userId - UUID do usuário (obrigatório)
 * @param {string|null} protocolId - UUID do protocolo (opcional)
 * @param {string} notificationType - Tipo: 'dose_reminder', 'daily_digest', etc.
 * @returns {Promise<boolean>} true se deve enviar, false se duplicado
 */
export async function shouldSendNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] shouldSendNotification chamado sem userId');
    return true; // Fail open
  }

  const cutoffTime = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    // Build query based on notification type
    let query = supabase
      .from('notification_log')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .gte('sent_at', cutoffTime)
      .limit(1);
    
    // Add protocol filter only for protocol-level notifications
    if (protocolId) {
      query = query.eq('protocol_id', protocolId);
    } else {
      query = query.is('protocol_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Deduplicator] Erro ao verificar log de notificação:', error);
      return true; // Fail open on error
    }

    // If we found a recent notification, this is a duplicate
    if (data) {
      console.log(`[Deduplicator] Ignorando duplicata ${notificationType} para usuário ${userId}`);
      return false;
    }

    // Not a duplicate - return true (but DON'T log yet)
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado:', err);
    return true; // Fail open
  }
}

/**
 * Loga uma notificação (função legada - usar logSuccessfulNotification)
 * @deprecated Use logSuccessfulNotification após envio confirmado
 */
export async function logNotification(userId, protocolId, notificationType, status = 'enviada') {
  if (!userId) {
    console.error('[Deduplicator] logNotification chamado sem userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,  // Can be null for user-level alerts
        notification_type: notificationType,
        status: status
      });

    if (error) {
      console.error('[Deduplicator] Erro ao logar notificação:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado em logNotification:', err);
    return false;
  }
}

/**
 * Loga uma notificação como enviada com sucesso
 * Deve ser chamado APÓS confirmação de envio pelo Telegram
 * @param {string} userId - UUID do usuário (obrigatório)
 * @param {string|null} protocolId - UUID do protocolo (opcional)
 * @param {string} notificationType - Tipo de notificação
 * @param {object} metadata - Metadados adicionais (messageId, etc)
 * @returns {Promise<boolean>} true se logado com sucesso
 */
export async function logSuccessfulNotification(userId, protocolId, notificationType, metadata = {}) {
  if (!userId) {
    console.error('[Deduplicator] logSuccessfulNotification chamado sem userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,
        notification_type: notificationType,
        status: 'enviada',
        telegram_message_id: metadata.messageId || null
      });

    if (error) {
      console.error('[Deduplicator] Erro ao logar notificação:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Erro inesperado em logSuccessfulNotification:', err);
    return false;
  }
}

/**
 * Limpa logs de notificação antigos (mais de 7 dias)
 */
export async function cleanupOldNotificationLogs() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('notification_log')
    .delete()
    .lt('created_at', sevenDaysAgo);

  if (error) {
    console.error('[Deduplicator] Erro ao limpar logs:', error);
  } else {
    console.log('[Deduplicator] Limpeza concluída');
  }
}
