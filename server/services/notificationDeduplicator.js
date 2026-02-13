
import { supabase } from './supabase.js';

const DEDUP_WINDOW_MINUTES = 5; // Don't send same notification twice within 5 minutes

/**
 * Check if notification was recently sent and log if not
 * @param {string} userId - User UUID (required)
 * @param {string|null} protocolId - Protocol UUID (optional, null for user-level alerts)
 * @param {string} notificationType - Type: 'dose_reminder', 'daily_digest', etc.
 * @returns {Promise<boolean>} true if should send, false if duplicate
 */
export async function shouldSendNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] shouldSendNotification called without userId');
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
      console.error('[Deduplicator] Error checking notification log:', error);
      return true; // Fail open on error
    }

    // If we found a recent notification, this is a duplicate
    if (data) {
      console.log(`[Deduplicator] Skipping duplicate ${notificationType} for user ${userId}`);
      return false;
    }

    // Not a duplicate - log it and return true
    const loggedSuccessfully = await logNotification(userId, protocolId, notificationType);
    return loggedSuccessfully;
  } catch (err) {
    console.error('[Deduplicator] Unexpected error:', err);
    return true; // Fail open
  }
}

/**
 * Log a notification as sent
 * @param {string} userId - User UUID (required)
 * @param {string|null} protocolId - Protocol UUID (optional, null for user-level alerts)
 * @param {string} notificationType - Notification type
 * @returns {Promise<boolean>} true if logged successfully
 */
export async function logNotification(userId, protocolId, notificationType) {
  if (!userId) {
    console.error('[Deduplicator] logNotification called without userId');
    return false;
  }

  try {
    const { error } = await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        protocol_id: protocolId,  // Can be null for user-level alerts
        notification_type: notificationType
      });

    if (error) {
      console.error('[Deduplicator] Error logging notification:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Deduplicator] Unexpected error in logNotification:', err);
    return false;
  }
}

/**
 * Clean up old notification logs (older than 7 days)
 */
export async function cleanupOldNotificationLogs() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('notification_log')
    .delete()
    .lt('created_at', sevenDaysAgo);

  if (error) {
    console.error('[Deduplicator] Error cleaning up logs:', error);
  } else {
    console.log('[Deduplicator] Cleanup completed');
  }
}
