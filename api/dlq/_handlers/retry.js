// api/dlq/_handlers/retry.js
// Dead Letter Queue Handler - Retry a failed notification via Dispatcher (ADR-030)
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../server/bot/logger.js';
import { dispatchNotification } from '../../../server/notifications/dispatcher/dispatchNotification.js';
import { Expo } from 'expo-server-sdk';
import { getServerTimestamp } from '../../../server/utils/dateUtils.js';

const logger = createLogger('DLQRetry');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

// === HELPERS: Repository Setup ===

function _createRepositories(supabase) {
  const preferencesRepo = {
    async getByUserId(userId) {
      const { data } = await supabase.from('user_settings').select('notification_preference').eq('user_id', userId).maybeSingle();
      return data?.notification_preference || 'telegram';
    },
    async hasTelegramChat(userId) {
      const { data } = await supabase.from('user_settings').select('telegram_chat_id').eq('user_id', userId).maybeSingle();
      return !!data?.telegram_chat_id;
    },
    async getSettingsByUserId(userId) {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      return data || {};
    }
  };

  const devicesRepo = {
    async listActiveByUser(userId, provider) {
      const { data } = await supabase.from('notification_devices').select('*').eq('user_id', userId).eq('provider', provider).eq('is_active', true);
      return data || [];
    }
  };

  const dlqRepo = {
    async enqueue(notificationData, error, retryCount, correlationId) {
      await supabase
        .from('failed_notification_queue')
        .upsert({
          user_id: notificationData.userId,
          protocol_id: notificationData.protocolId,
          notification_type: notificationData.type,
          notification_payload: notificationData,
          error_code: error?.code || error?.error_code,
          error_message: error?.message || 'Unknown error',
          retry_count: retryCount,
          correlation_id: correlationId,
          status: 'pending'
        }, { onConflict: 'correlation_id', ignoreDuplicates: false });
    }
  };

  return { preferencesRepo, devicesRepo, dlqRepo };
}

function _createBotAdapter(token) {
  return {
    sendMessage: async (chatId, text, options) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...options })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.description);
      return { success: true, messageId: result.result.message_id };
    }
  };
}

async function _handleRetrySuccess(supabase, id, dispatchResult) {
  await supabase
    .from('failed_notification_queue')
    .update({
      status: 'resolved',
      resolved_at: getServerTimestamp(),
      resolution_notes: 'Manually retried via admin interface'
    })
    .eq('id', id);

  return {
    success: true,
    message: 'Notification sent successfully',
    channels: dispatchResult.channels
  };
}

async function _handleRetryFailure(supabase, id, notification, dispatchResult) {
  await supabase
    .from('failed_notification_queue')
    .update({
      retry_count: (notification.retry_count || 0) + 1,
      updated_at: getServerTimestamp(),
      error_message: dispatchResult.errors?.[0]?.message || 'Unknown error'
    })
    .eq('id', id);

  return {
    success: false,
    error: dispatchResult.errors?.[0]?.message || 'Failed to send notification'
  };
}

/**
 * Handler para retry de notificação da DLQ
 */
export async function handleRetry(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: 'Missing notification ID' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

  try {
    const { data: notification, error: fetchError } = await supabase
      .from('failed_notification_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const { preferencesRepo, devicesRepo, dlqRepo } = _createRepositories(supabase);
    const bot = _createBotAdapter(botToken);

    const dispatchResult = await dispatchNotification({
      userId: notification.user_id,
      kind: notification.notification_type,
      data: {
        ...(notification.notification_payload || {}),
        isRetry: true
      },
      context: {
        correlationId: notification.correlation_id || `retry_${id}`,
        isRetry: true
      },
      repositories: { preferences: preferencesRepo, devices: devicesRepo, dlq: dlqRepo },
      bot,
      expoClient
    });

    const result = dispatchResult.success
      ? await _handleRetrySuccess(supabase, id, dispatchResult)
      : await _handleRetryFailure(supabase, id, notification, dispatchResult);

    return res.status(dispatchResult.success ? 200 : 500).json(result);

  } catch (err) {
    logger.error('Unexpected error during retry', err, { id });
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
