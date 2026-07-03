import { supabase } from './supabase.js';
import { createLogger } from '../bot/logger.js';
import { getTodayLocal } from '../utils/dateUtils.js';

const logger = createLogger('ProtocolCache');

// In-memory cache com TTL por usuário
const cache = new Map();
const CACHE_TTL_SECONDS = 30;

function getCacheKey(userId, type) {
  return `${type}:${userId}`;
}

/**
 * Get active protocols for a specific user
 * @param {string} userId - User UUID
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<array>} Array of protocols with medicine details
 */
export async function getActiveProtocols(userId, useCache = true) {
  if (!userId) {
    logger.error('getActiveProtocols called without userId');
    return [];
  }

  const cacheKey = getCacheKey(userId, 'protocols');

  // Check cache
  if (useCache && cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL_SECONDS * 1000) {
      logger.debug(`Cache hit for protocols`, { userId });
      return data;
    }
    cache.delete(cacheKey);
  }

  try {
    const today = getTodayLocal();
    const { data, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', userId)
      .eq('active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);

    if (error) throw error;

    // Store in cache
    cache.set(cacheKey, {
      data: data || [],
      timestamp: Date.now()
    });

    logger.debug(`Protocols fetched`, { userId, count: data?.length || 0 });
    return data || [];
  } catch (err) {
    logger.error(`Error fetching protocols`, err, { userId });
    return [];
  }
}

/**
 * Get user settings
 * @param {string} userId - User UUID
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<object>} User settings
 */
export async function getUserSettings(userId, useCache = true) {
  if (!userId) {
    logger.error('getUserSettings called without userId');
    return null;
  }

  const cacheKey = getCacheKey(userId, 'settings');

  if (useCache && cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL_SECONDS * 1000) {
      logger.debug(`Cache hit for settings`, { userId });
      return data;
    }
    cache.delete(cacheKey);
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    logger.debug(`Settings fetched`, { userId });
    return data;
  } catch (err) {
    logger.error(`Error fetching settings`, err, { userId });
    return null;
  }
}

/**
 * Get all users with Telegram integration enabled
 * @returns {Promise<array>} Array of user settings
 */
export async function getAllUsersWithTelegram() {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id, telegram_chat_id, timezone')
      .not('telegram_chat_id', 'is', null);

    if (error) throw error;

    logger.debug(`Fetched users with Telegram`, { count: data?.length || 0 });
    return data || [];
  } catch (err) {
    logger.error(`Error fetching users with Telegram`, err);
    return [];
  }
}

/**
 * Invalidate cache for a user
 * @param {string} userId - User UUID
 */
export function invalidateUserCache(userId) {
  const keysToDelete = [];
  for (const key of cache.keys()) {
    if (key.endsWith(`:${userId}`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
  logger.debug(`Cache invalidated for user`, { userId, keysDeleted: keysToDelete.length });
}

/**
 * Invalidate all cache
 */
export function invalidateAllCache() {
  cache.clear();
  logger.info('All cache invalidated');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    entriesByType: {}
  };

  for (const key of cache.keys()) {
    const type = key.split(':')[0];
    stats.entriesByType[type] = (stats.entriesByType[type] || 0) + 1;
  }

  return stats;
}