// server/services/deadLetterQueue.js
import { supabase } from './supabase.js';
import { createLogger } from '../bot/logger.js';
import { updateDlqSize } from './notificationMetrics.js';
import { 
  getServerTimestamp, 
  addDays, 
  parseISO 
} from '../utils/dateUtils.js';

const logger = createLogger('DeadLetterQueue');

/**
 * Error categories for DLQ
 * @readonly
 * @enum {string}
 */
export const ErrorCategories = {
  NETWORK_ERROR: 'network_error',           // Network error, retryable
  RATE_LIMIT: 'rate_limit',                 // 429 Too Many Requests
  INVALID_CHAT: 'invalid_chat',             // User blocked the bot
  MESSAGE_TOO_LONG: 'message_too_long',     // Message exceeds limit
  TELEGRAM_API_ERROR: 'telegram_api_error', // Telegram API errors
  TELEGRAM_400: 'telegram_400',             // Bad Request
  TELEGRAM_401: 'telegram_401',             // Unauthorized
  TELEGRAM_403: 'telegram_403',             // Forbidden
  TELEGRAM_404: 'telegram_404',             // Not Found
  UNKNOWN: 'unknown'                        // Unknown error
};

/**
 * Possible statuses in DLQ
 * @readonly
 * @enum {string}
 */
export const DLQStatus = {
  FAILED: 'failed',             // Failed after all attempts
  PENDING: 'pending',           // Awaiting retry
  RETRYING: 'retrying',         // Retry in progress
  RESOLVED: 'resolved',         // Successfully resolved
  DISCARDED: 'discarded'        // Discarded (too old or invalid)
};

/**
 * Error mappers for Telegram HTTP codes
 * @private
 */
const TELEGRAM_ERROR_MAPPERS = {
  400: (msg) => (msg.includes('too long') ? ErrorCategories.MESSAGE_TOO_LONG : ErrorCategories.TELEGRAM_400),
  401: () => ErrorCategories.TELEGRAM_401,
  403: (msg) => (msg.includes('blocked') || msg.includes('deactivated') ? ErrorCategories.INVALID_CHAT : ErrorCategories.TELEGRAM_403),
  404: () => ErrorCategories.TELEGRAM_404,
  429: () => ErrorCategories.RATE_LIMIT
};

/**
 * Categorizes a notification error
 * @param {Error|object} error - Error that occurred
 * @returns {string} Error category
 */
function categorizeError(error) {
  if (!error) return ErrorCategories.UNKNOWN;
  
  const code = Number(error.code || error.error_code);
  const message = (error.message || '').toLowerCase();
  
  // 1. Telegram HTTP codes
  if (code && TELEGRAM_ERROR_MAPPERS[code]) {
    return TELEGRAM_ERROR_MAPPERS[code](message);
  }
  
  if (code) return ErrorCategories.TELEGRAM_API_ERROR;
  
  // 2. Network patterns
  const networkPatterns = ['etimedout', 'econnreset', 'enotfound', 'network error'];
  if (networkPatterns.some(p => message.includes(p))) {
    return ErrorCategories.NETWORK_ERROR;
  }
  
  return ErrorCategories.UNKNOWN;
}

/**
 * Adds a failed notification to the DLQ
 * @param {object} notificationData - Notification data
 * @param {Error|object} error - Error that occurred
 * @param {number} retryCount - Number of attempts made
 * @param {string} correlationId - Correlation ID
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function enqueue(notificationData, error, retryCount, correlationId) {
  try {
    const errorCategory = categorizeError(error);
    
    // Usar upsert para evitar race condition
    // O índice único parcial garante atomicidade
    const { data, error: upsertError } = await supabase
      .from('failed_notification_queue')
      .upsert({
        user_id: notificationData.userId,
        protocol_id: notificationData.protocolId,
        notification_type: notificationData.type,
        notification_payload: notificationData,
        error_code: error?.code || error?.error_code,
        error_message: error?.message || 'Unknown error',
        error_category: errorCategory,
        retry_count: retryCount,
        correlation_id: correlationId,
        status: DLQStatus.PENDING
      }, {
        onConflict: 'correlation_id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();
    
    if (upsertError) throw upsertError;
    
    logger.info('Notification enqueued to DLQ', {
      id: data.id,
      correlationId,
      userId: notificationData.userId,
      errorCategory
    });
    
    // Atualizar métrica de tamanho da DLQ
    const stats = await getDLQStats();
    updateDlqSize(stats.pending + stats.retrying);
    
    return { success: true, id: data.id };
    
  } catch (err) {
    logger.error('Failed to add to DLQ', err, {
      correlationId,
      userId: notificationData.userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Marks a notification for retry
 * @param {string} id - Notification ID in DLQ
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function markForRetry(id) {
  try {
    const { error } = await supabase
      .from('failed_notification_queue')
      .update({
        status: DLQStatus.RETRYING,
        updated_at: getServerTimestamp()
      })
      .eq('id', id)
      .eq('status', DLQStatus.PENDING); // Only if pending
    
    if (error) throw error;
    
    logger.info('Notification marked for retry', { id });
    
    return { success: true };
    
  } catch (err) {
    logger.error('Failed to mark for retry', err, { id });
    return { success: false, error: err.message };
  }
}

/**
 * Marks a notification as resolved
 * @param {string} id - Notification ID in DLQ
 * @param {string} resolution - Resolution type ('success' | 'discarded' | 'manual')
 * @param {string} notes - Notes about the resolution
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function markAsResolved(id, resolution, notes = '') {
  const statusMap = {
    success: DLQStatus.RESOLVED,
    discarded: DLQStatus.DISCARDED,
    manual: DLQStatus.RESOLVED
  };
  
  const status = statusMap[resolution] || DLQStatus.RESOLVED;
  
  try {
    const { error } = await supabase
      .from('failed_notification_queue')
      .update({
        status,
        resolution_notes: notes,
        resolved_at: getServerTimestamp()
      })
      .eq('id', id);
    
    if (error) throw error;
    
    logger.info('Notification resolved', { id, resolution, notes });
    
    // Atualizar métrica de tamanho da DLQ
    const stats = await getDLQStats();
    updateDlqSize(stats.pending + stats.retrying);
    
    return { success: true };
    
  } catch (err) {
    logger.error('Failed to resolve notification', err, { id });
    return { success: false, error: err.message };
  }
}

/**
 * Gets failed notifications for a user
 * @param {string} userId - User UUID
 * @param {number} limit - Result limit
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} List of failed notifications
 */
export async function getFailedForUser(userId, limit = 10, status = null) {
  try {
    let query = supabase
      .from('failed_notification_queue')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
    
  } catch (err) {
    logger.error('Failed to fetch failed notifications', err, { userId });
    return [];
  }
}

/**
 * Gets DLQ statistics
 * @returns {Promise<object>} Statistics
 */
export async function getDLQStats() {
  try {
    // Usa função PostgreSQL para agregação eficiente (não carrega todas as linhas)
    const { data, error } = await supabase
      .rpc('get_dlq_stats');
    
    if (error) throw error;
    
    const stats = {
      total: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
      resolved: 0,
      discarded: 0,
      byCategory: {},
      oldestFailure: null
    };
    
    data.forEach(item => {
      const count = parseInt(item.count, 10) || 0;
      const status = item.status;
      
      // Basic counts
      if (status in stats) {
        stats[status] = count;
      }
      stats.total += count;
      
      // Category aggregation
      const cat = item.error_category || 'unknown';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + count;
      
      // Oldest failure tracking
      if (item.oldest_failure) {
        const itemOldest = parseISO(item.oldest_failure);
        const currentOldest = stats.oldestFailure ? parseISO(stats.oldestFailure) : null;
        
        if (!currentOldest || itemOldest < currentOldest) {
          stats.oldestFailure = item.oldest_failure;
        }
      }
    });
    
    return stats;
    
  } catch (err) {
    logger.error('Failed to get DLQ statistics', err);
    return {
      total: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
      resolved: 0,
      discarded: 0,
      byCategory: {},
      oldestFailure: null,
      error: err.message
    };
  }
}

/**
 * Gets pending notifications for automatic retry
 * @param {number} limit - Notification limit
 * @returns {Promise<Array>} Pending notifications
 */
export async function getPendingForRetry(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('failed_notification_queue')
      .select('*')
      .eq('status', DLQStatus.PENDING)
      .lte('retry_count', 5) // Maximum 5 automatic retries
      .order('created_at', { ascending: true }) // Oldest first
      .limit(limit);
    
    if (error) throw error;
    return data || [];
    
  } catch (err) {
    logger.error('Failed to fetch pending for retry', err);
    return [];
  }
}

/**
 * Cleans up old resolved notifications
 * @param {number} daysToKeep - Days to keep (default: 30)
 * @returns {Promise<{success: boolean, deleted?: number, error?: string}>}
 */
export async function cleanupResolved(daysToKeep = 30) {
  try {
    const cutoffDate = addDays(-daysToKeep);
    
    const { error, count } = await supabase
      .from('failed_notification_queue')
      .delete()
      .in('status', [DLQStatus.RESOLVED, DLQStatus.DISCARDED])
      .lt('resolved_at', cutoffDate.toISOString());
    
    if (error) throw error;
    
    logger.info('DLQ cleanup completed', { deleted: count, olderThan: cutoffDate.toISOString() });
    return { success: true, deleted: count };
    
  } catch (err) {
    logger.error('DLQ cleanup failed', err);
    return { success: false, error: err.message };
  }
}

export default {
  enqueue,
  markForRetry,
  markAsResolved,
  getFailedForUser,
  getDLQStats,
  getPendingForRetry,
  cleanupResolved,
  ErrorCategories,
  DLQStatus
};
