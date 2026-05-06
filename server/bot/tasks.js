import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { getCurrentCorrelationId } from './correlationLogger.js';

import { 
  checkRemindersViaDispatcher, 
  runDailyDigestViaDispatcher, 
  checkStockAlertsViaDispatcher, 
  checkTitrationAlertsViaDispatcher, 
  checkPrescriptionAlertsViaDispatcher 
} from './_reminderHelpers.js';

import { 
  runDailyAdherenceReportViaDispatcher, 
  checkAdherenceReportsViaDispatcher, 
  checkMonthlyReportViaDispatcher 
} from './_adherenceHelpers.js';

const logger = createLogger('Tasks');

// --- DLQ Digest ---

const DLQ_DIGEST_LIMIT = 10;

/**
 * Envia digest diário de notificações falhadas para o admin via Dispatcher (ADR-030)
 * @param {object} notificationDispatcher - Dispatcher central
 * @param {object} options - Opções com correlationId
 * @returns {Promise<object>} Resultado da operação
 */
export async function sendDLQDigest(notificationDispatcher, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
  
  try {
    const { data: failedNotifications, error } = await supabase
      .from('failed_notification_queue')
      .select('id, notification_type, error_message, created_at')
      .in('status', ['pending', 'retrying'])
      .order('created_at', { ascending: false })
      .limit(DLQ_DIGEST_LIMIT);
    
    if (error) {
      logger.error('Erro ao buscar notificações falhadas', { correlationId, error });
      return { sent: false, reason: 'query_failed', error: error.message };
    }
    
    if (!failedNotifications || failedNotifications.length === 0) {
      logger.debug('No failed notifications in DLQ', { correlationId });
      return { sent: false, reason: 'no_failures' };
    }
    
    const result = await notificationDispatcher.dispatch({
      userId: SYSTEM_USER_ID,
      kind: 'dlq_digest',
      data: {
        failedCount: failedNotifications.length,
        failures: failedNotifications.map(f => ({
          id: f.id,
          type: f.notification_type,
          error_message: f.error_message,
          created_at: f.created_at
        }))
      },
      context: { correlationId }
    });
    
    return { 
      sent: result.success, 
      count: failedNotifications.length,
      success: result.success 
    };
    
  } catch (err) {
    logger.error('Error in sendDLQDigest', err, { correlationId });
    return { sent: false, reason: 'exception', error: err.message };
  }
}

// --- Reminder/Adherence Checkers (Cron/Dispatch wrappers) ---

/**
 * Check reminders for ALL users (cron job)
 */
export async function checkReminders(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkReminders. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando verificação de lembretes via Dispatcher (ADR-030)', { correlationId });
  return checkRemindersViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check stock alerts for a specific user
 */
export async function checkStockAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkStockAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de estoque via Dispatcher (ADR-030)', { correlationId });
  return checkStockAlertsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check adherence reports for ALL users (weekly)
 */
export async function checkAdherenceReports(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkAdherenceReports. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando relatórios de adesão via Dispatcher (ADR-030)', { correlationId });
  return checkAdherenceReportsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check titration alerts for ALL users
 */
export async function checkTitrationAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkTitrationAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de titulação via Dispatcher (ADR-030)', { correlationId });
  return checkTitrationAlertsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check monthly reports for ALL users
 */
export async function checkMonthlyReport(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkMonthlyReport. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando relatórios mensais via Dispatcher (ADR-030)', { correlationId });
  return checkMonthlyReportViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check prescription alerts for ALL users
 */
export async function checkPrescriptionAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkPrescriptionAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de prescrição via Dispatcher (ADR-030)', { correlationId });
  return checkPrescriptionAlertsViaDispatcher(notificationDispatcher, correlationId);
}

export async function runDailyAdherenceReport(bot, { correlationId, notificationDispatcher }) {
  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para runDailyAdherenceReport. Skipping.', { correlationId });
    return;
  }
  return runDailyAdherenceReportViaDispatcher(notificationDispatcher, correlationId);
}

export async function runDailyDigest(bot, { correlationId, notificationDispatcher }) {
  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para runDailyDigest. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando resumo diário via Dispatcher (ADR-030)', { correlationId });
  return runDailyDigestViaDispatcher(notificationDispatcher, correlationId);
}