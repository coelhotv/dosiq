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
import { runOutboxCycle } from '../server/notifications/outbox/runOutboxCycle.js';
import {
  buildDailyAdherenceData,
  buildWeeklyAdherenceData,
  buildMonthlyReportData
} from '../server/bot/_adherenceHelpers.js';
import { buildDailyDigestData } from '../server/bot/_reminderHelpers.js';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { Expo } from 'expo-server-sdk';
import { getServerTimestamp, getSaoPauloTime, getRawNow } from '../server/utils/dateUtils.js';

const logger = createLogger('CronNotify');

// Cutover kind-a-kind (ADR-078): kinds em OUTBOX_KINDS são servidos pela outbox; seu job legado
// é PULADO (evita envio duplo). Ausente/vazio → tudo legado (deploy neutro — ENG-1). Rollback por env.
const OUTBOX_KINDS = new Set(
  (process.env.OUTBOX_KINDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

// Registry outbox-kind → builder puro (nível B; injetado no ciclo da outbox para não arrastar
// server/bot pro island strict-A — R-283). Só kinds aqui podem ser drenados.
const OUTBOX_CONTENT_BUILDERS = {
  daily_adherence: ({ userId, settings }) => buildDailyAdherenceData(userId, settings?.display_name),
  weekly_adherence: ({ userId, settings }) => buildWeeklyAdherenceData(userId, settings?.display_name),
  monthly_report: ({ userId, settings }) => buildMonthlyReportData(userId, settings?.display_name),
  // 043 T023b: o digest revalida o modo/horário no DB no momento do envio (settings do drain
  // pode estar defasado) e devolve null se o usuário saiu do modo digest.
  daily_digest: ({ userId, settings }) => buildDailyDigestData(userId, settings)
};
// outbox kind → kind de dispatch quando divergem (payload legado usa 'adherence_report').
const OUTBOX_DISPATCH_KIND = { daily_adherence: 'adherence_report' };

// Singleton clients — instanciados no module scope para reuso em warm invocations (R-089)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: /* TODO(040-strict): typar transport supabase realtime */ ws as any } }
);
const expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// === HELPERS: Repository factories ===

const preferencesRepo = {
  async getByUserId(userId) {
    const { data } = await supabase.from('user_settings').select('notification_preference').eq('user_id', userId).single();
    return data?.notification_preference || 'telegram';
  },
  async hasTelegramChat(userId) {
    const { data } = await supabase.from('user_settings').select('telegram_chat_id').eq('user_id', userId).single();
    return !!data?.telegram_chat_id;
  },
  async getSettingsByUserId(userId) {
    const { data } = await supabase
      .from('user_settings')
      .select('notification_mode, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, digest_time, timezone, channel_mobile_push_enabled, channel_web_push_enabled, channel_telegram_enabled')
      .eq('user_id', userId)
      .single();
    return data ?? {
      notification_mode: 'realtime',
      quiet_hours_enabled: false,
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
  },
  async deactivateByToken(token) {
    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: getServerTimestamp() })
      .eq('push_token', token);
    if (error) logger.error('Falha ao desativar device por token', null, { error: error.message });
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

// === HELPER: isRetryableError ===

function isRetryableError(error) {
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

  if (error.response?.status === 429) {
    return true;
  }

  if (error.response?.status >= 500) {
    return true;
  }

  return false;
}

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
        const error = new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`) as any; // TODO(040-strict): tipar erro custom
        error.response = { status: res.status };
        error.statusCode = res.status;
        throw error;
      }

      return data.result;
    } catch (err: any) {
      if (!err.response && res) {
        err.response = { status: res.status };
        err.statusCode = res.status;
      }
      logger.error(`Erro de fetch (${method})`, err);
      throw err;
    }
  };

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
            timestamp: getServerTimestamp(),
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
        timestamp: getServerTimestamp(),
        attempts: maxAttempts
      };
    }
  };
}

// === HELPER: createNotificationDispatcher ===

function _createNotificationDispatcher(bot) {
  return {
    async dispatch({ userId, kind, data, context }) {
      try {
        const result = await dispatchNotification({
          userId,
          kind,
          data,
          channels: undefined, // TODO(040-strict): canais explícitos por chamada
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
}

// === HELPER: executeCronJobs ===

async function _executeCronJobs(notificationDispatcher, bot, correlationId, spDate) {
  const currentHour = spDate.getHours();
  const currentMinute = spDate.getMinutes();
  const currentDay = spDate.getDate();
  const currentWeekDay = spDate.getDay();
  const results = [];

  // Isolamento por job (PO-1/FR-001): a falha de um relatório NÃO propaga — reminders (que já
  // rodou) e os demais jobs seguem. Cada job vira um registro discreto ('<job>' ou '<job>:failed').
  const runJob = async (name, jobType, fn) => {
    try {
      await withCorrelation((context) => fn(context), { correlationId, jobType });
      results.push(name);
    } catch (err) {
      logger.error(`Job '${name}' falhou (isolado — não propaga)`, err, { correlationId, jobType });
      results.push(`${name}:failed`);
    }
  };

  // 1. Reminders — SEMPRE primeiro (ADR-057 intocado), isolado de qualquer relatório.
  await runJob('reminders', 'reminders',
    (context) => checkReminders(bot, { ...context, notificationDispatcher }));

  // 2. Ciclo da outbox (ADR-078): enqueue por range + drain dos kinds migrados. Isolado.
  //    No-op quando OUTBOX_KINDS vazio (deploy neutro). Falha aqui não afeta reminders/legado.
  await runJob('outbox_cycle', 'outbox_cycle', async () => {
    const outcome = await runOutboxCycle({
      supabase,
      dispatcher: notificationDispatcher,
      outboxKinds: OUTBOX_KINDS,
      contentBuilders: OUTBOX_CONTENT_BUILDERS,
      dispatchKind: OUTBOX_DISPATCH_KIND,
      correlationId,
      logger,
    });
    logger.info('[outbox] ciclo concluído', { correlationId, ...outcome });
  });

  // --- Jobs LEGADOS: pulados quando o kind já é servido pela outbox (evita envio duplo). ---

  // Daily Digest
  if (!OUTBOX_KINDS.has('daily_digest')) {
    await runJob('daily_digest', 'daily_digest',
      (context) => runDailyDigest(bot, { ...context, notificationDispatcher }));
  }

  // Daily Adherence Report
  if (!OUTBOX_KINDS.has('daily_adherence')) {
    await runJob('daily_adherence_report', 'daily_adherence_report',
      (context) => runDailyAdherenceReport(bot, { ...context, notificationDispatcher }));
  }

  // Tasks at 10:00
  if (currentHour === 10 && currentMinute === 0) {
    if (!OUTBOX_KINDS.has('stock_alert')) {
      await runJob('stock_alerts', 'stock_alerts',
        (context) => checkStockAlerts(bot, { ...context, notificationDispatcher }));
    }
    await runJob('dlq_digest', 'dlq_digest',
      (context) => sendDLQDigest(notificationDispatcher, context));
  }

  // Titration Alerts: Daily at 08:00 (não migra para outbox)
  if (currentHour === 8 && currentMinute === 0) {
    await runJob('titration_alerts', 'titration_alerts',
      (context) => checkTitrationAlerts(bot, { ...context, notificationDispatcher }));
  }

  // Adherence Reports: Sunday 09:00-12:00 SP
  if (currentWeekDay === 0 && currentHour >= 9 && currentHour <= 12 && !OUTBOX_KINDS.has('weekly_adherence')) {
    await runJob('adherence_reports', 'adherence_reports',
      (context) => checkAdherenceReports(bot, { ...context, notificationDispatcher }));
  }

  // Monthly Report: 1st of month
  if (currentDay === 1 && !OUTBOX_KINDS.has('monthly_report')) {
    await runJob('monthly_report', 'monthly_report',
      (context) => checkMonthlyReport(bot, { ...context, notificationDispatcher }));
  }

  return results;
}

export default async function handler(req, res) {
  const correlationId = generateCorrelationId();

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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Falha-fechado se CRON_SECRET não estiver configurado — sem essa guarda,
  // CRON_SECRET undefined viraria "Bearer undefined" e qualquer requisição com
  // esse header burlaria a autenticação (mesma classe do Gemini #604, security-high).
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron attempt', { correlationId, authHeader });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN not configured', null, { correlationId });
    return res.status(500).json({ error: 'Token missing' });
  }

  const bot = createNotifyBotAdapter(token);
  // 046 T014: a supressão por consentimento revogado vive DENTRO do dispatcher, a partir do fetch de
  // `user_settings` que ele já faz por usuário. Nada a preparar aqui — e nada global a falhar: o
  // estado de um titular não pode derrubar o lembrete de dose dos outros pacientes (R-292).
  const notificationDispatcher = _createNotificationDispatcher(bot);

  const now = getRawNow();
  const spDate = getSaoPauloTime(now);

  const currentHHMM = spDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  logger.info(`Executing cron jobs`, {
    correlationId,
    time: currentHHMM,
    hour: spDate.getHours(),
    minute: spDate.getMinutes(),
    day: spDate.getDate(),
    weekday: spDate.getDay()
  });

  try {
    const results = await _executeCronJobs(notificationDispatcher, bot, correlationId, spDate);

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