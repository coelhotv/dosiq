// staleDoseNotifications.test.js — Jest (jest-expo)

const mockGetDisplayed = jest.fn()
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getDisplayedNotifications: (...a) => mockGetDisplayed(...a) },
}))

const mockCancelAlarm = jest.fn()
jest.mock('../alarmService', () => ({
  ALARM_CHANNEL_ID: 'dose-alarm-v2',
  ALARM_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v2',
  cancelAlarm: (...a) => mockCancelAlarm(...a),
}))

const mockEndSurface = jest.fn()
jest.mock('@platform/doseActivity/doseActivitySurfaceService', () => ({
  DOSE_ACTIVITY_CHANNEL_ID: 'dose-activity-v2',
  endDoseActivity: (...a) => mockEndSurface(...a),
}))

import {
  isDoseNotificationStale,
  isAlarmNotification,
  reconcileStaleDoseNotifications,
} from '../staleDoseNotifications'

const NOW = new Date(Date.UTC(2026, 6, 2, 12, 0, 0)) // 2026-07-02 12:00Z
const iso = (min) => new Date(NOW.getTime() + min * 60000).toISOString()

describe('isDoseNotificationStale', () => {
  it('além de scheduled+tolerância → stale', () => {
    expect(isDoseNotificationStale({ scheduledFor: iso(-200), toleranceMinutes: '120' }, NOW)).toBe(true)
  })
  it('dentro da janela → não stale', () => {
    expect(isDoseNotificationStale({ scheduledFor: iso(-30), toleranceMinutes: '120' }, NOW)).toBe(false)
  })
  it('futuro → não stale', () => {
    expect(isDoseNotificationStale({ scheduledFor: iso(60) }, NOW)).toBe(false)
  })
  it('sem scheduledFor → não afirma (false)', () => {
    expect(isDoseNotificationStale({}, NOW)).toBe(false)
  })
  it('usa tolerância default (120) quando ausente', () => {
    expect(isDoseNotificationStale({ scheduledFor: iso(-121) }, NOW)).toBe(true)
    expect(isDoseNotificationStale({ scheduledFor: iso(-119) }, NOW)).toBe(false)
  })
})

describe('isAlarmNotification', () => {
  it('canal de alarme (android) e categoria (ios)', () => {
    expect(isAlarmNotification({ android: { channelId: 'dose-alarm-critical-v2' } })).toBe(true)
    expect(isAlarmNotification({ ios: { categoryId: 'dose-alarm-v2' } })).toBe(true)
    expect(isAlarmNotification({ android: { channelId: 'outro' } })).toBe(false)
  })
})

describe('reconcileStaleDoseNotifications', () => {
  beforeEach(() => jest.clearAllMocks())

  it('cancela alarme VELHO (missed) e ignora dose fresca', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: { doseInstanceId: 'old', scheduledFor: iso(-300), toleranceMinutes: '120' } } },
      { notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: { doseInstanceId: 'fresh', scheduledFor: iso(-10), toleranceMinutes: '120' } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).toHaveBeenCalledWith('old')
    expect(mockEndSurface).toHaveBeenCalledWith('old')
    expect(mockCancelAlarm).not.toHaveBeenCalledWith('fresh')
  })

  it('cancela superfície 039 velha (flag __surface)', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'dose-activity-v2' }, data: { doseInstanceId: 'surf', __surface: 'true', scheduledFor: iso(-400), toleranceMinutes: '120' } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockEndSurface).toHaveBeenCalledWith('surf')
  })

  it('notif sem doseInstanceId ou não-dose → ignora', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'outro-canal' }, data: { scheduledFor: iso(-400) } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).not.toHaveBeenCalled()
  })

  it('getDisplayedNotifications lança → best-effort, não propaga', async () => {
    mockGetDisplayed.mockRejectedValueOnce(new Error('boom'))
    await expect(reconcileStaleDoseNotifications(NOW)).resolves.toBeUndefined()
  })
})
