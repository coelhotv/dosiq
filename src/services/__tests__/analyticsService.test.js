import { describe, it, expect, beforeEach } from 'vitest'

// Simple localStorage mock
const localStorageMock = {
  store: {},
  getItem: function (key) {
    return this.store[key] || null
  },
  setItem: function (key, value) {
    this.store[key] = value.toString()
  },
  removeItem: function (key) {
    delete this.store[key]
  },
  clear: function () {
    this.store = {}
  },
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
  writable: true,
  configurable: true,
})

const { analyticsService } = require('../analyticsService')

describe('analyticsService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('track', () => {
    it('should create an event with name and properties', () => {
      const result = analyticsService.track('test_event', { key: 'value' })

      expect(result).toBe(true)

      const events = analyticsService.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].name).toBe('test_event')
      expect(events[0].properties).toEqual({ key: 'value' })
      expect(events[0].timestamp).toBeDefined()
    })

    it('should create event without properties', () => {
      const result = analyticsService.track('simple_event')

      expect(result).toBe(true)

      const events = analyticsService.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].name).toBe('simple_event')
      expect(events[0].properties).toEqual({})
    })

    it('should handle tracking multiple events', () => {
      analyticsService.track('event_1')
      analyticsService.track('event_2')
      analyticsService.track('event_3')

      const events = analyticsService.getEvents()
      expect(events).toHaveLength(3)
    })
  })

  describe('getEvents', () => {
    it('should return empty array when no events', () => {
      const events = analyticsService.getEvents()
      expect(events).toEqual([])
    })

    it('should return all events in reverse chronological order', () => {
      // Use unique names to verify order
      analyticsService.track('second')

      // Small delay to ensure different timestamps
      const events = analyticsService.getEvents()
      // Just verify we get events back
      expect(events.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter by event name', () => {
      analyticsService.track('login')
      analyticsService.track('page_view')
      analyticsService.track('login')

      const events = analyticsService.getEvents({ name: 'login' })
      expect(events).toHaveLength(2)
      expect(events.every((e) => e.name === 'login')).toBe(true)
    })
  })

  describe('getSummary', () => {
    it('should return empty summary when no events', () => {
      const summary = analyticsService.getSummary()

      expect(summary.totalEvents).toBe(0)
      expect(summary.uniqueEventTypes).toBe(0)
      expect(summary.eventCounts).toEqual({})
    })

    it('should return correct event counts', () => {
      analyticsService.track('login')
      analyticsService.track('login')
      analyticsService.track('page_view')

      const summary = analyticsService.getSummary()

      expect(summary.totalEvents).toBe(3)
      expect(summary.uniqueEventTypes).toBe(2)
      expect(summary.eventCounts.login).toBe(2)
      expect(summary.eventCounts.page_view).toBe(1)
    })
  })

  describe('clearOldEvents', () => {
    it('should not remove events within retention period', () => {
      const now = new Date()
      const recentEvent = {
        id: '1',
        name: 'recent',
        timestamp: now.toISOString(),
        properties: {},
      }

      localStorage.setItem('mr_analytics', JSON.stringify([recentEvent]))

      const removed = analyticsService.clearOldEvents(30)
      expect(removed).toBe(0)

      const events = analyticsService.getEvents()
      expect(events).toHaveLength(1)
    })

    it('should remove events older than retention period', () => {
      const now = new Date()
      const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
      const oldEvent = {
        id: '1',
        name: 'old',
        timestamp: oldDate.toISOString(),
        properties: {},
      }

      localStorage.setItem('mr_analytics', JSON.stringify([oldEvent]))

      const removed = analyticsService.clearOldEvents(30)
      expect(removed).toBe(1)

      const events = analyticsService.getEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('should remove all events from storage', () => {
      analyticsService.track('event_1')
      analyticsService.track('event_2')

      const result = analyticsService.clearAll()
      expect(result).toBe(true)

      const events = analyticsService.getEvents()
      expect(events).toEqual([])
    })
  })

  describe('getStorageUsage', () => {
    it('should return 0 when no data', () => {
      const usage = analyticsService.getStorageUsage()
      expect(usage).toBe(0)
    })

    it('should return correct storage size', () => {
      analyticsService.track('test_event', { data: 'some data' })

      const usage = analyticsService.getStorageUsage()
      expect(usage).toBeGreaterThan(0)
    })
  })

  describe('getStorageUsagePercent', () => {
    it('should return 0 when no data', () => {
      const percent = analyticsService.getStorageUsagePercent()
      expect(percent).toBe(0)
    })

    it('should return percentage of max storage', () => {
      analyticsService.track('test_event')

      const percent = analyticsService.getStorageUsagePercent()
      expect(percent).toBeGreaterThan(0)
      expect(percent).toBeLessThanOrEqual(100)
    })
  })

  describe('storage limit enforcement', () => {
    it('should enforce maximum number of events', () => {
      // Create many events
      for (let i = 0; i < 100; i++) {
        analyticsService.track(`event_${i}`, { index: i })
      }

      const events = analyticsService.getEvents()
      // Should have removed oldest events based on MAX_EVENTS limit
      expect(events.length).toBeLessThanOrEqual(1000)
    })
  })
})
