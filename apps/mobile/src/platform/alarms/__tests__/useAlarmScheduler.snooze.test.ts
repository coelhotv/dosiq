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
let mockAnchors: Record<string, number> = {}
let mockAttempts: Record<string, number> = {}
jest.mock('../snoozeAnchorStore', () => ({
  ...jest.requireActual('../snoozeAnchorStore'),
  getSnoozeAnchors: () => Promise.resolve(mockAnchors),
  getSnoozeAttempts: () => Promise.resolve(mockAttempts),
}))
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

afterEach(() => {
  mockAnchors = {}
  mockAttempts = {}
  jest.clearAllMocks()
})

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

  it('🔴 PO-101-8: soneca antecipada (snoozed_until = scheduled+5, antes de t0) ⇒ só o alarme da soneca, nenhum em t0', async () => {
    const t0 = NOW.getTime() + 30 * 60000
    const snoozedTs = t0 + 5 * 60000
    mockItems = [baseItem({ scheduledFor: new Date(t0).toISOString(), snoozedUntil: snoozedTs })]
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(alarmService.scheduleAlarm).toHaveBeenCalledTimes(1)
    expect(mockedScheduleAlarm.mock.calls[0][0].fireAt).toBe(snoozedTs)
  })

  it('spec 101: alarme da soneca re-armado no resync leva snoozedUntil no data (reconcile reaparece em now)', async () => {
    const snoozedTs = NOW.getTime() + 5 * 60000
    mockItems = [baseItem({ snoozedUntil: snoozedTs })]
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockedScheduleAlarm.mock.calls[0][0].data.snoozedUntil).toBe(String(snoozedTs))
  })

  it('🔴 C-23: claim zerou snoozed_until no banco antes da âncora ⇒ âncora local re-arma o alarme da soneca', async () => {
    // Smoke iOS 2026-10-10 17:23: claim 17:23:04 (snoozed_until=null), app aberto 17:23:10, âncora 17:23:24.
    const anchor = NOW.getTime() + 20_000
    mockItems = [baseItem({ snoozedUntil: null })]
    mockAnchors = { 'inst-1': anchor }
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(alarmService.scheduleAlarm).toHaveBeenCalledTimes(1)
    expect(mockedScheduleAlarm.mock.calls[0][0].fireAt).toBe(anchor)
  })

  it('🔴 C-25: re-arme mantém a contagem de sonecas', async () => {
    mockItems = [baseItem({ snoozedUntil: NOW.getTime() + 5 * 60000 })]
    mockAttempts = { 'inst-1': 2 }
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockedScheduleAlarm.mock.calls[0][0].data.snoozeAttempt).toBe('2')
  })
})
