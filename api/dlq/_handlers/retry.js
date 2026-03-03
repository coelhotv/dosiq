// api/dlq/_handlers/retry.js
// Dead Letter Queue Handler - Retry a failed notification
// NOTA: Este handler é chamado pelo router api/dlq.js, que já faz a autenticação
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../server/bot/logger.js';
import { escapeMarkdownV2 } from '../../../server/utils/formatters.js';

const logger = createLogger('DLQRetry');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Handler para retry de notificação da DLQ
 * @param {object} req - Request object (Vercel)
 * @param {object} res - Response object (Vercel)
 */
export async function handleRetry(req, res) {
  // Get notification ID from query (router passa via req.query.id)
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing notification ID' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid notification ID format' });
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch the failed notification
    const { data: notification, error: fetchError } = await supabase
      .from('failed_notification_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      logger.error('Notification not found', fetchError, { id });
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if notification can be retried
    if (notification.status === 'resolved') {
      return res.status(400).json({ error: 'Notification already resolved' });
    }

    if (notification.status === 'discarded') {
      return res.status(400).json({ error: 'Notification was discarded' });
    }

    // Get user's chat_id from user_settings
    const { data: userSettings, error: userError } = await supabase
      .from('user_settings')
      .select('telegram_chat_id')
      .eq('user_id', notification.user_id)
      .single();

    if (userError || !userSettings?.telegram_chat_id) {
      logger.error('User chat ID not found', userError, { userId: notification.user_id });
      return res.status(400).json({
        error: 'User does not have Telegram chat ID configured',
        success: false
      });
    }

    const chatId = userSettings.telegram_chat_id;

    // Get protocol details for message formatting
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select(`
        *,
        medicines (name, dosage_per_pill, dosage_unit)
      `)
      .eq('id', notification.protocol_id)
      .single();

    if (protocolError) {
      logger.warn('Protocol not found, using stored payload', { protocolId: notification.protocol_id });
    }

    // Format the notification message
    const medicineName = protocol?.medicines?.name || notification.notification_payload?.medicineName || 'Medicamento';
    const message = formatRetryMessage(notification, medicineName);

    // Send the message via Telegram API
    const telegramResult = await sendTelegramMessage(botToken, chatId, message);

    if (telegramResult.success) {
      // Mark as resolved
      const { error: updateError } = await supabase
        .from('failed_notification_queue')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Manually retried via admin interface'
        })
        .eq('id', id);

      if (updateError) {
        logger.error('Failed to update notification status', updateError, { id });
        // Message was sent, but status update failed - return warning
        return res.status(200).json({
          success: true,
          message: 'Notification sent successfully, but status update failed',
          messageId: telegramResult.messageId,
          warning: 'A entrada permanece na DLQ e pode ser reenviada. Verifique manualmente.'
        });
      }

      logger.info('Notification retry successful', {
        id,
        chatId,
        messageId: telegramResult.messageId
      });

      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        messageId: telegramResult.messageId
      });

    } else {
      // Update retry count
      const { error: updateError } = await supabase
        .from('failed_notification_queue')
        .update({
          retry_count: notification.retry_count + 1,
          updated_at: new Date().toISOString(),
          error_message: telegramResult.error
        })
        .eq('id', id);

      if (updateError) {
        logger.error('Failed to update retry count', updateError, { id });
      }

      logger.error('Notification retry failed', null, {
        id,
        error: telegramResult.error
      });

      return res.status(500).json({
        success: false,
        error: telegramResult.error || 'Failed to send notification'
      });
    }

  } catch (err) {
    logger.error('Unexpected error during retry', err, { id });
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

/**
 * Sanitiza uma mensagem garantindo escapes corretos para MarkdownV2.
 * Função de proteção para evitar falhas em mensagens legadas.
 * @param {string} text - Texto a ser sanitizado
 * @returns {string} Texto seguro para MarkdownV2
 */
function sanitizeMessageForMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Aplicar escapeMarkdownV2 em qualquer parte dinâmica que possa conter caracteres especiais
  // Isso garante que retries de notificações antigas não falhem
  return escapeMarkdownV2(text);
}

/**
 * Format retry message for Telegram
 */
function formatRetryMessage(notification, medicineName) {
  const type = notification.notification_type;
  const timestamp = new Date(notification.created_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  });

  switch (type) {
    case 'dose_reminder':
      return `🔔 *Lembrete de dose* (Reenvio)\n\n` +
             `💊 ${escapeMarkdownV2(medicineName)}\n` +
             `📅 Horário original: ${timestamp}\n` +
             `\n_Esta é uma nova tentativa de notificação._`;

    case 'stock_alert':
      return `⚠️ *Alerta de estoque* (Reenvio)\n\n` +
             `💊 ${escapeMarkdownV2(medicineName)}\n` +
             `📅 Original: ${timestamp}\n` +
             `\n_Esta é uma nova tentativa de notificação._`;

    case 'proactive_stock_alert':
      return `💡 *Lembrete de Reposição* (Reenvio)\n\n` +
             `📅 Original: ${timestamp}\n` +
             `\n_Esta é uma nova tentativa de notificação._`;

    default:
      return `📢 *Notificação* (Reenvio)\n\n` +
             `📅 Original: ${timestamp}\n` +
             `\n_Esta é uma nova tentativa de notificação._`;
  }
}

/**
 * Send message via Telegram API
 */
async function sendTelegramMessage(token, chatId, text) {
  if (!token) {
    return { success: false, error: 'Bot token not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'MarkdownV2'
      })
    });

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        error: `${data.error_code}: ${data.description}`
      };
    }

    return {
      success: true,
      messageId: data.result.message_id
    };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
