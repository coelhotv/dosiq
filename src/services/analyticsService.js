/**
 * Analytics Service - Privacy-First Local Analytics
 *
 * Tracks user events in localStorage without external data transfer.
 * Supports rotation of old events and storage limit management.
 *
 * @module analyticsService
 */

// Constants
const STORAGE_KEY = 'mr_analytics'
const MAX_STORAGE_BYTES = 500 * 1024 // 500KB
const EVENT_RETENTION_DAYS = 30
const MAX_EVENTS = 1000

/**
 * Creates an analytics event object
 * @param {string} name - Event name
 * @param {Object} properties - Event properties
 * @returns {Object} Formatted event object
 */
const createEvent = (name, properties = {}) => ({
  id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name,
  properties,
  timestamp: new Date().toISOString(),
})

/**
 * Gets all events from localStorage
 * @returns {Array} Array of events
 */
const getAllEvents = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    console.error('[Analytics] Error reading events')
    return []
  }
}

/**
 * Saves events to localStorage
 * @param {Array} events - Array of events to save
 */
const saveEvents = (events) => {
  try {
    const data = JSON.stringify(events)
    localStorage.setItem(STORAGE_KEY, data)
  } catch {
    console.error('[Analytics] Error saving events')
  }
}

/**
 * Cleans up old events and enforces storage limits
 * @param {Array} events - Array of events
 * @returns {Array} Cleaned array of events
 */
const cleanupEvents = (events) => {
  const now = new Date()
  const cutoffDate = new Date(now.setDate(now.getDate() - EVENT_RETENTION_DAYS))

  // Filter out old events
  let filtered = events.filter((event) => new Date(event.timestamp) > cutoffDate)

  // Enforce maximum number of events
  if (filtered.length > MAX_EVENTS) {
    filtered = filtered.slice(-MAX_EVENTS)
  }

  // Enforce storage limit (keep most recent events)
  let result = filtered
  while (JSON.stringify(result).length > MAX_STORAGE_BYTES && result.length > 0) {
    result = result.slice(1) // Remove oldest
  }

  return result
}

/**
 * Analytics Service - Privacy-First Local Tracking
 *
 * Provides methods to track events, get summaries, and manage
 * local analytics data without external transfers.
 */
export const analyticsService = {
  /**
   * Tracks an analytics event
   * Performance target: < 5ms execution time
   *
   * @param {string} name - Event name
   * @param {Object} properties - Event properties (optional)
   * @returns {boolean} Success status
   */
  track: (name, properties = {}) => {
    const startTime = performance.now()

    try {
      const events = getAllEvents()
      const newEvent = createEvent(name, properties)
      events.push(newEvent)

      const cleanedEvents = cleanupEvents(events)
      saveEvents(cleanedEvents)

      const duration = performance.now() - startTime
      if (duration > 5) {
        console.warn(`[Analytics] track() exceeded 5ms target: ${duration.toFixed(2)}ms`)
      }

      return true
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error)
      return false
    }
  },

  /**
   * Gets all events, optionally filtered
   *
   * @param {Object} filter - Filter options
   * @param {string} [filter.name] - Filter by event name
   * @param {Date} [filter.since] - Filter events after date
   * @param {Date} [filter.until] - Filter events before date
   * @returns {Array} Filtered events
   */
  getEvents: (filter = {}) => {
    let events = getAllEvents()

    if (filter.name) {
      events = events.filter((e) => e.name === filter.name)
    }

    if (filter.since) {
      const sinceDate = new Date(filter.since)
      events = events.filter((e) => new Date(e.timestamp) >= sinceDate)
    }

    if (filter.until) {
      const untilDate = new Date(filter.until)
      events = events.filter((e) => new Date(e.timestamp) <= untilDate)
    }

    return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  },

  /**
   * Gets a summary of events by name with counts
   *
   * @param {Object} options - Summary options
   * @param {Date} [options.since] - Only count events after date
   * @param {Date} [options.until] - Only count events before date
   * @returns {Object} Summary object with event counts
   */
  getSummary: (options = {}) => {
    const events = getAllEvents()

    let filtered = events

    if (options.since) {
      const sinceDate = new Date(options.since)
      filtered = filtered.filter((e) => new Date(e.timestamp) >= sinceDate)
    }

    if (options.until) {
      const untilDate = new Date(options.until)
      filtered = filtered.filter((e) => new Date(e.timestamp) <= untilDate)
    }

    // Count events by name
    const counts = {}
    for (const event of filtered) {
      counts[event.name] = (counts[event.name] || 0) + 1
    }

    return {
      totalEvents: filtered.length,
      uniqueEventTypes: Object.keys(counts).length,
      eventCounts: counts,
      oldestEvent: filtered.length > 0 ? filtered[filtered.length - 1]?.timestamp : null,
      newestEvent: filtered.length > 0 ? filtered[0]?.timestamp : null,
    }
  },

  /**
   * Cleans up old events
   *
   * @param {number} days - Number of days to retain (default: 30)
   * @returns {number} Number of events removed
   */
  clearOldEvents: (days = EVENT_RETENTION_DAYS) => {
    const events = getAllEvents()
    const now = new Date()
    const cutoffDate = new Date(now.setDate(now.getDate() - days))

    const beforeCount = events.length
    const filtered = events.filter((event) => new Date(event.timestamp) > cutoffDate)
    const afterCount = filtered.length

    saveEvents(filtered)

    return beforeCount - afterCount
  },

  /**
   * Clears all analytics data
   *
   * @returns {boolean} Success status
   */
  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      return true
    } catch {
      console.error('[Analytics] Error clearing events')
      return false
    }
  },

  /**
   * Gets storage usage in bytes
   *
   * @returns {number} Storage used in bytes
   */
  getStorageUsage: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? new Blob([data]).size : 0
    } catch {
      return 0
    }
  },

  /**
   * Gets storage usage as percentage of max
   *
   * @returns {number} Usage percentage (0-100)
   */
  getStorageUsagePercent: () => {
    const usage = analyticsService.getStorageUsage()
    return Math.min((usage / MAX_STORAGE_BYTES) * 100, 100)
  },
}

export default analyticsService
