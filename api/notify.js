// Import modules directly (no dynamic imports)
import { createLogger } from '../server/bot/logger.js';
import { withCorrelation, generateCorrelationId } from '../server/bot/correlationLogger.js';
import {
  checkReminders,
  runDailyDigest,
  checkStockAlerts,
  checkAdherenceReports,
  checkTitrationAlerts,
  checkMonthlyReport,
  sendDLQDigest
} from '../server/bot/tasks.js';

const logger = createLogger('CronNotify');

// --- Bot Adapter (Minimal for Notifications) ---
function createNotifyBotAdapter(token) {
  const telegramFetch = async (method, body) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!data.ok) {
        logger.error(`Erro na API do Telegram (${method})`, null, { error: data });
        throw new Error(`Erro Telegram API: ${data.error_code} - ${data.description}`);
      }
      
      return data.result;
    } catch (err) {
      logger.error(`Erro de fetch (${method})`, err);
      throw err;  // SEMPRE re-lançar o erro
    }
  };

  /**
   * Verifica se um erro é passível de retry
   * @param {Error} error - Objeto de erro
   * @returns {boolean} true se o erro é transiente
   */
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
    
    return retryableCodes.some(code =>
      error.message?.includes(code) ||
      error.code === code
    );
  }

  return {
    sendMessage: async (chatId, text, options = {}) => {
      try {
        const result = await telegramFetch('sendMessage', { chat_id: chatId, text, ...options });
        
        logger.debug(`Mensagem Telegram enviada com sucesso`, {
          chatId,
          messageId: result.message_id
        });
        
        return {
          success: true,
          messageId: result.message_id,
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        logger.error(`Falha ao enviar mensagem Telegram`, err, { chatId });
        
        return {
          success: false,
          error: {
            code: err.name || 'SEND_FAILED',
            message: err.message,
            retryable: isRetryableError(err)
          },
          timestamp: new Date().toISOString()
        };
      }
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
      (context) => checkReminders(bot, context),
      { correlationId, jobType: 'reminders' }
    );
    results.push('reminders');

    // 2. Daily Digest: Daily at 23:00
    if (currentHour === 23 && currentMinute === 0) {
      await withCorrelation(
        (context) => runDailyDigest(bot, context),
        { correlationId, jobType: 'daily_digest' }
      );
      results.push('daily_digest');
    }

    // 3. Stock Alerts: Daily at 09:00
    if (currentHour === 9 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkStockAlerts(bot, context),
        { correlationId, jobType: 'stock_alerts' }
      );
      results.push('stock_alerts');
    }

    // 4. Titration Alerts: Daily at 08:00
    if (currentHour === 8 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkTitrationAlerts(bot, context),
        { correlationId, jobType: 'titration_alerts' }
      );
      results.push('titration_alerts');
    }

    // 5. Adherence Reports: Sunday at 23:00
    if (currentWeekDay === 0 && currentHour === 23 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkAdherenceReports(bot, context),
        { correlationId, jobType: 'adherence_reports' }
      );
      results.push('adherence_reports');
    }

    // 6. Monthly Report: 1st of month at 10:00
    if (currentDay === 1 && currentHour === 10 && currentMinute === 0) {
      await withCorrelation(
        (context) => checkMonthlyReport(bot, context),
        { correlationId, jobType: 'monthly_report' }
      );
      results.push('monthly_report');
    }

    // 7. DLQ Digest: Daily at 09:00
    if (currentHour === 9 && currentMinute === 0) {
      await withCorrelation(
        (context) => sendDLQDigest(bot, context),
        { correlationId, jobType: 'dlq_digest' }
      );
      results.push('dlq_digest');
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