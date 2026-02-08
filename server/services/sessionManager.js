/**
 * Persistent Session Manager for Telegram Bot
 * 
 * Features:
 * - Persistent sessions via Supabase (survives restarts)
 * - TTL (Time To Live) of 30 minutes
 * - Automatic cleanup of expired sessions
 * - Local cache for ultra-fast reads (< 100ms)
 * - Background sync for write operations
 * 
 * @module sessionManager
 */

import { supabase } from './supabase.js';
import { getUserIdByChatId } from './userService.js';

const SESSION_TTL_MINUTES = 30; // 30 minute expiry as per requirements
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

// Local in-memory cache for ultra-fast reads
const localCache = new Map();
const cacheTimestamps = new Map();
const CACHE_TTL_MS = 60 * 1000; // Local cache valid for 1 minute

/**
 * Calculate expiration timestamp
 * @returns {string} ISO timestamp for session expiration
 */
function calculateExpiration() {
  return new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();
}

/**
 * Check if local cache entry is valid
 * @param {string} chatId - Telegram chat ID
 * @returns {boolean}
 */
function isCacheValid(chatId) {
  const timestamp = cacheTimestamps.get(chatId);
  if (!timestamp) return false;
  return (Date.now() - timestamp) < CACHE_TTL_MS;
}

/**
 * Update local cache
 * @param {string} chatId - Telegram chat ID
 * @param {object} context - Session data
 */
function updateCache(chatId, context) {
  localCache.set(chatId, context);
  cacheTimestamps.set(chatId, Date.now());
}

/**
 * Clear local cache entry
 * @param {string} chatId - Telegram chat ID
 */
function clearCache(chatId) {
  localCache.delete(chatId);
  cacheTimestamps.delete(chatId);
}

/**
 * Set session context for a chat (async, non-blocking)
 * Updates both local cache and database
 * 
 * @param {number|string} chatId - Telegram chat ID
 * @param {object} context - Session data
 * @returns {Promise<void>}
 */
export async function setSession(chatId, context) {
  const startTime = Date.now();
  const chatIdStr = String(chatId);
  const expiresAt = calculateExpiration();

  // Update local cache immediately for fast subsequent reads
  updateCache(chatIdStr, context);

  try {
    // Get userId from chatId (supports multiple users)
    let userId;
    try {
      userId = await getUserIdByChatId(chatIdStr);
    } catch {
      // User not linked yet, skip database write
      console.warn(`[SessionManager] User not linked for chat ${chatId}, skipping DB write`);
      return;
    }

    const { error } = await supabase
      .from('bot_sessions')
      .upsert({
        user_id: userId,
        chat_id: chatIdStr,
        context,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'chat_id'
      });

    if (error) {
      console.error(`[SessionManager] Error setting session for chat ${chatId}:`, error);
      // Cache is already updated, session survives in memory even if DB fails
    } else {
      const duration = Date.now() - startTime;
      if (duration > 100) {
        console.warn(`[SessionManager] Slow write detected: ${duration}ms for chat ${chatId}`);
      }
    }
  } catch (err) {
    console.error(`[SessionManager] Exception setting session for chat ${chatId}:`, err);
    // Session persists in local cache despite error
  }
}

/**
 * Get session context for a chat (fast path with cache)
 * 
 * @param {number|string} chatId - Telegram chat ID
 * @returns {Promise<object|null>} Session context or null if expired/not found
 */
export async function getSession(chatId) {
  const startTime = Date.now();
  const chatIdStr = String(chatId);

  // Fast path: check local cache first
  if (isCacheValid(chatIdStr) && localCache.has(chatIdStr)) {
    const cached = localCache.get(chatIdStr);
    // Validate cache hasn't expired logically
    if (cached && cached._expiresAt && new Date(cached._expiresAt) > new Date()) {
      return cached;
    }
  }

  try {
    const { data, error } = await supabase
      .from('bot_sessions')
      .select('context, expires_at')
      .eq('chat_id', chatIdStr)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not found error
        console.error(`[SessionManager] Error getting session for chat ${chatId}:`, error);
      }
      clearCache(chatIdStr);
      return null;
    }

    // Check if session expired
    if (new Date(data.expires_at) < new Date()) {
      // Async cleanup without awaiting
      clearSession(chatId);
      clearCache(chatIdStr);
      return null;
    }

    // Update cache with fresh data
    updateCache(chatIdStr, data.context);

    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.warn(`[SessionManager] Slow read detected: ${duration}ms for chat ${chatId}`);
    }

    return data.context;
  } catch (err) {
    console.error(`[SessionManager] Exception getting session for chat ${chatId}:`, err);
    return null;
  }
}

/**
 * Clear session for a chat (async)
 * Removes from both local cache and database
 * 
 * @param {number|string} chatId - Telegram chat ID
 * @returns {Promise<void>}
 */
export async function clearSession(chatId) {
  const chatIdStr = String(chatId);
  
  // Clear local cache immediately
  clearCache(chatIdStr);

  try {
    const { error } = await supabase
      .from('bot_sessions')
      .delete()
      .eq('chat_id', chatIdStr);

    if (error) {
      console.error(`[SessionManager] Error clearing session for chat ${chatId}:`, error);
    }
  } catch (err) {
    console.error(`[SessionManager] Exception clearing session for chat ${chatId}:`, err);
  }
}

/**
 * Clean up expired sessions from database
 * Can be called periodically or manually
 * 
 * @returns {Promise<number>} Count of deleted sessions
 */
export async function cleanupExpiredSessions() {
  const startTime = Date.now();

  try {
    // Use database function if available, otherwise direct delete
    const { data, error } = await supabase
      .from('bot_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[SessionManager] Error cleaning up expired sessions:', error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    const duration = Date.now() - startTime;
    
    if (deletedCount > 0) {
      console.log(`[SessionManager] Cleanup completed: ${deletedCount} sessions removed in ${duration}ms`);
    }
    
    return deletedCount;
  } catch (err) {
    console.error('[SessionManager] Exception during cleanup:', err);
    return 0;
  }
}

/**
 * Get session statistics for monitoring
 * @returns {Promise<object>} Stats object with counts
 */
export async function getSessionStats() {
  try {
    const { count: totalCount, error: totalError } = await supabase
      .from('bot_sessions')
      .select('*', { count: 'exact', head: true });

    const { count: expiredCount, error: expiredError } = await supabase
      .from('bot_sessions')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString());

    if (totalError || expiredError) {
      console.error('[SessionManager] Error getting stats:', totalError || expiredError);
      return null;
    }

    return {
      totalSessions: totalCount || 0,
      expiredSessions: expiredCount || 0,
      activeSessions: (totalCount || 0) - (expiredCount || 0),
      localCacheSize: localCache.size
    };
  } catch (err) {
    console.error('[SessionManager] Exception getting stats:', err);
    return null;
  }
}

/**
 * Start automatic cleanup interval
 * Call this once when bot starts
 */
export function startAutoCleanup() {
  console.log(`[SessionManager] Auto-cleanup started (interval: ${CLEANUP_INTERVAL_MS}ms)`);
  
  // Run initial cleanup
  cleanupExpiredSessions();
  
  // Set up interval
  const intervalId = setInterval(() => {
    cleanupExpiredSessions().catch(err => {
      console.error('[SessionManager] Auto-cleanup error:', err);
    });
  }, CLEANUP_INTERVAL_MS);

  // Return function to stop cleanup
  return () => clearInterval(intervalId);
}

// Export constants for external use
export { SESSION_TTL_MINUTES };
