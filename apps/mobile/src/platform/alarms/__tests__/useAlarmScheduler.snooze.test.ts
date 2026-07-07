// Guard: soneca sobrevive ao resync. cancelAll mata o trigger de soneca; syncAlarms DEVE
// re-armar o item snoozed no snoozed_until (fireAt), senão a soneca some (bug smoke 2026-06-29).

import { syncAlarms } from '../useAlarmScheduler'
import { alarmService } from '../alarmService'

const mockedScheduleAlarm = alarmService.scheduleAlarm as jest.Mock

const NOW = new Date('2026-03-05T12:00:00.000Z')

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

jest.mock('../alarmService', () => ({
  alarmService: {
    cancelAll: jest.fn().mockResolvedValue(undefined),
    scheduleAlarm: jest.fn().mockResolvedValue(undefined),
  },
}))

let mockItems = []
jest.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  createCriticalAuditService: () => ({ emit: jest.fn().mockResolvedValue({ ok: true }) }),
  buildDoseItemsFromInstances: () => mockItems,
  ensureInstancesUpTo: jest.fn().mockResolvedValue(undefined),
  getRawNow: () => new Date('2026-03-05T12:00:00.000Z'),
  addDays: (d, n) => new Date(d.getTime() + n * 86400000),
  parseISO: (s) => new Date(s),
}))

const baseItem = (over = {}) => ({
  instanceId: 'inst-1',
  scheduledFor: '2026-03-05T11:00:00.000Z', // passado, mas snoozed → fireAt manda
  status: 'pending',
  critical: true,
  toleranceMinutes: 120,
  medicineName: 'Lantus',
  ...over,
})

afterEach(() => jest.clearAllMocks())

describe('syncAlarms — soneca re-armada no resync', () => {
  it('item snoozed (snoozed_until futuro) → scheduleAlarm com fireAt = snoozed_until', async () => {
    const snoozedTs = NOW.getTime() + 5 * 60000
    mockItems = [baseItem({ snoozedUntil: snoozedTs })]
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

    expect(alarmService.cancelAll).toHaveBeenCalled()
    expect(alarmService.scheduleAlarm).toHaveBeenCalledTimes(1)
    const arg = mockedScheduleAlarm.mock.calls[0][0]
    expect(arg.doseInstanceId).toBe('inst-1')
    expect(arg.fireAt).toBe(snoozedTs)
    expect(arg.scheduledFor).toBe('2026-03-05T11:00:00.000Z') // original preservado
  })

  it('snoozed_until no passado → NÃO trata como soneca (agenda normal, sem fireAt)', async () => {
    mockItems = [baseItem({ snoozedUntil: NOW.getTime() - 60000, scheduledFor: '2026-03-05T13:00:00.000Z' })]
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    const arg = mockedScheduleAlarm.mock.calls[0][0]
    expect(arg.fireAt).toBeUndefined()
  })
})
