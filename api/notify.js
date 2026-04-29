// Import modules directly (no dynamic imports)
import { createLogger } from '../server/bot/logger.js';
import { withCorrelation, generateCorrelationId } from '../server/bot/correlationLogger.js';
import {
  checkReminders,
  runDailyDigest,
  runDailyAdherenceReport,
  checkStockAlerts,
  checkAdherenceReports,
  checkTitrationAlerts,
  checkMonthlyReport,
  sendDLQDigest
} from '../server/bot/tasks.js';
import { dispatchNotification } from '../server/notifications/dispatcher/dispatchNotification.js';
import { createClient } from '@supabase/supabase-js';
import { Expo } from 'expo-server-sdk';

const logger = createLogger('CronNotify');

// Singleton clients — instanciados no module scope para reuso em warm invocations (R-089)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// Repository factories — thin wrappers em torno do supabase singleton
const preferencesRepo = {
  async getByUserId(userId) {
    const { data } = await supabase.from('user_settings').select('notification_preference').eq('user_id', userId).single();
    return data?.notification_preference || 'telegram';
  },
  async hasTelegramChat(userId) {
    const { data } = await supabase.from('user_settings').select('telegram_chat_id').eq('user_id', userId).single();
    return !!data?.telegram_chat_id;
  },
  // Wave N2: getSettingsByUserId necessário para o gate centralizado em dispatchNotification.
  // NOTA: Este método é intencionalmente inline e não importa notificationPreferenceRepository.js do servidor.
  // Motivo: api/notify.js roda em contexto Vercel Serverless com SUPABASE_SERVICE_ROLE_KEY,
  // enquanto o repo do servidor usa o client anon (src/shared/utils/supabase). Importar o repo
  // do servidor quebraria a separação de clientes. As colunas são idênticas ao repo central.
  async getSettingsByUserId(userId) {
    const { data } = await supabase
      .from('user_settings')
      .select('notification_mode, quiet_hours_start, quiet_hours_end, digest_time, timezone, channel_mobile_push_enabled, channel_web_push_enabled, channel_telegram_enabled')
      .eq('user_id', userId)
      .single();
    return data ?? {
      notification_mode: 'realtime',
      quiet_hours_start: null,
      quiet_hours_end: null,
      digest_time: '08:00',
      timezone: 'America/Sao_Paulo'
    };
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
    const { error: upsertError } = await supabase
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
      }, {
        onConflict: 'correlation_id',
        ignoreDuplicates: false
      });
    if (upsertError) throw upsertError;
  }
};


// --- Bot Adapter (Minimal for Notifications) ---
function createNotifyBotAdapter(token) {
  const telegramFetch = async (method, body) => {
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.ok) {
        logger.error(`Erro na API do Telegram (${method})`, null, { error: data });
        const error = new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`);
        // Anexar status HTTP para detecção de erros retryable
        error.response = { status: res.status };
        error.statusCode = res.status;
        throw error;
      }

      return data.result;
    } catch (err) {
      // Se o erro não tem response, adicionar baseado no fetch response
      if (!err.response && res) {
        err.response = { status: res.status };
        err.statusCode = res.status;
      }
      logger.error(`Erro de fetch (${method})`, err);
      throw err;  // SEMPRE re-lançar o erro
    }
  };

  /**
   * Verifica se um erro é passível de retry (transitório)
   * @param {Error} error - Objeto de erro
   * @returns {boolean} true se o erro é transitório e pode ser retentado
   */
  function isRetryableError(error) {
    // Network errors (connection issues)
    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'Socket hang up',
      'ECONNABORTED',
      'Network Error'
    ];

    if (retryableCodes.some(code =>
      error.message?.includes(code) ||
      error.code === code
    )) {
      return true;
    }

    // Telegram API rate limiting (429 Too Many Requests)
    if (error.response?.status === 429) {
      return true;
    }

    // Telegram API internal errors (5xx)
    if (error.response?.status >= 500) {
      return true;
    }

    return false;
  }

  return {
    sendMessage: async (chatId, text, options = {}) => {
      const maxAttempts = 2; // Simple: just 2 attempts
      let lastError;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });

          logger.debug(`Mensagem Telegram enviada`, {
            chatId,
            messageId: result.message_id,
            attempt
          });

          return {
            success: true,
            messageId: result.message_id,
            timestamp: new Date().toISOString(),
            attempts: attempt
          };
        } catch (err) {
          lastError = err;

          // Only retry on network/retryable errors
          if (!isRetryableError(err) || attempt === maxAttempts) {
            break;
          }

          // Simple delay: 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.error(`Falha ao enviar mensagem Telegram após ${maxAttempts} tentativas`, lastError, { chatId });

      return {
        success: false,
        error: {
          code: lastError.name || 'SEND_FAILED',
          message: lastError.message,
          retryable: isRetryableError(lastError)
        },
        timestamp: new Date().toISOString(),
        attempts: maxAttempts
      };
    }
  };
}

export default async function handler(req, res) {
  // Gerar correlation ID para esta execução do cron
  const correlationId = generateCorrelationId();
  
  // Log de diagnóstico das variáveis de ambiente (apenas existência, não valores)
  logger.info('Ambiente de execução', {
    correlationId,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL ? 'present' : 'absent',
    hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasCronSecret: !!process.env.CRON_SECRET,
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
  });

  logger.info('Cron job triggered', {
    correlationId,
    method: req.method,
    url: req.url
  });

  // Accept both GET (from cron-job.org) and POST (for compatibility)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Protection against unauthorized calls
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn('Unauthorized cron attempt', { correlationId, authHeader });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN not configured', null, { correlationId });
    return res.status(500).json({ error: 'Token missing' });
  }

  const bot = createNotifyBotAdapter(token);

  // --- Notification Dispatcher Setup (Sprint 6.4) ---
  const notificationDispatcher = {
    async dispatch({ userId, kind, data, context }) {
      try {
        const result = await dispatchNotification({
          userId,
          kind,
          data,
          context,
          repositories: { 
            preferences: preferencesRepo, 
            devices: devicesRepo,
            dlq: dlqRepo
          },
          bot,
          expoClient
        });

        logger.info('[notificationDispatcher] Resultado do envio', { 
          userId, 
          kind, 
          success: result.success,
          totalDelivered: result.totalDelivered,
          totalFailed: result.totalFailed,
          correlationId: context?.correlationId 
        });

        return result;
      } catch (error) {
        logger.error('[notificationDispatcher] Erro ao enviar notificação', error, { userId, kind, correlationId: context?.correlationId });
        return { success: false, channels: [], totalDelivered: 0, totalFailed: 1, deactivatedTokens: [], errors: [{ message: error.message }] };
      }
    }
  };

  // Get current time in Sao Paulo
  const now = new Date();
  const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const currentHour = spDate.getHours();
  const currentMinute = spDate.getMinutes();
  const currentDay = spDate.getDate();
  const currentWeekDay = spDate.getDay();
  
  const currentHHMM = spDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  logger.info(`Executing cron jobs`, {
    correlationId,
    time: currentHHMM,
    hour: currentHour,
    minute: currentMinute,
    day: currentDay,
    weekday: currentWeekDay
  });

  const results = [];

  try {
    // 1. Always check dose reminders (Every minute)
    await withCorrelation(
      (context) => checkReminders(bot, { ...context, notificationDispatcher }),
      { correlationId, jobType: 'reminders' }
    );
    results.push('reminders');

    // 2. Daily Digest (Horário personalizado por usuário validado em tasks.js)
    await withCorrelation(
      (context) => runDailyDigest(bot, { ...context, notificationDispatcher }),
      { correlationId, jobType: 'daily_digest' }
    );
    results.push('daily_digest');

    // 2.1 Daily Adherence Report (Fase 12: Storytelling + Nudges)
    // Chamado a cada minuto; elegibilidade por usuário validada em tasks.js
    await withCorrelation(
      (context) => runDailyAdherenceReport(bot, { ...context, notificationDispatcher }),
      { correlationId, jobType: 'daily_adherence_report' }
    );
    results.push('daily_adherence_report');

    // 3. Tasks at 09:00: Stock Alerts + DLQ Digest
    if (currentHour === 9 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkStockAlerts(bot, { ...context, notificationDispatcher }),
        { correlationId, jobType: 'stock_alerts' }
      );
      results.push('stock_alerts');

      await withCorrelation(
        (context) => sendDLQDigest(notificationDispatcher, context),
        { correlationId, jobType: 'dlq_digest' }
      );
      results.push('dlq_digest');
    }

    // 4. Titration Alerts: Daily at 08:00
    if (currentHour === 8 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkTitrationAlerts(bot, { ...context, notificationDispatcher }),
        { correlationId, jobType: 'titration_alerts' }
      );
      results.push('titration_alerts');
    }

    // 5. Adherence Reports: Sunday at 23:00
    if (currentWeekDay === 0 && currentHour === 23 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkAdherenceReports(bot, { ...context, notificationDispatcher }),
        { correlationId, jobType: 'adherence_reports' }
      );
      results.push('adherence_reports');
    }

    // 6. Monthly Report: 1st of month at 10:00
    if (currentDay === 1 && currentHour === 10 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkMonthlyReport(bot, { ...context, notificationDispatcher }),
        { correlationId, jobType: 'monthly_report' }
      );
      results.push('monthly_report');
    }

    logger.info('Cron jobs completed', {
      correlationId,
      executed: results,
      duration: Date.now() - now.getTime()
    });

    res.status(200).json({
      status: 'ok',
      executed: results,
      time: currentHHMM,
      correlationId
    });
    
  } catch (error) {
    console.error('[CronNotify] Cron job failed with error:', {
      correlationId,
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    logger.error('Cron job failed', error, { correlationId });
    res.status(500).json({
      error: error.message,
      correlationId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}