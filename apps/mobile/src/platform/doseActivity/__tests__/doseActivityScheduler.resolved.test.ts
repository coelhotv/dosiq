// 082 D2 (C-35 · PO-D2-6): dose registrada neste aparelho nunca volta à superfície — nem por arme em
// voo, nem por boundary que escapou ao cancel. Smoke 054: `taken` 22:25:02, boundary `late` 22:34:00.

import notifee from '@notifee/react-native'
import { deriveDoseActivityState } from '@dosiq/core'
import { armDoseActivity, advanceDoseActivity, deferDoseItem } from '../doseActivityScheduler'
import { markDosesResolved, unmarkDoseResolved, isDoseResolved, RESOLVED_DOSES_KEY, RESOLVED_DOSE_TTL_MS } from '../resolvedDoseStore'

const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v)
  }),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k)
  }),
}))

jest.mock('@platform/audit/surfaceAuditBeacon', () => ({
  enqueueSurfaceTransition: jest.fn().mockResolvedValue(undefined),
  emitDeliveredTransition: jest.fn().mockResolvedValue(undefined),
}))

const RNPlatform = require('react-native').Platform
const ORIGINAL_OS = RNPlatform.OS
beforeEach(() => {
  RNPlatform.OS = 'android'
})
afterAll(() => {
  RNPlatform.OS = ORIGINAL_OS
})
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockStore.clear()
})

const NOW = new Date('2026-03-05T12:00:00.000Z')
const M = 60000
const iso = (offMin) => new Date(NOW.getTime() + offMin * M).toISOString()
const doseItem = (over = {}) => ({
  instanceId: 'inst-1',
  scheduledFor: iso(-11), // passou do T0 ⇒ `now`, próximo boundary = `late`
  status: 'pending',
  critical: true,
  toleranceMinutes: 120,
  medicineName: 'Lantus',
  scheduledTime: '08:49',
  ...over,
})

describe('resolvedDoseStore', () => {
  it('marca, consulta e desmarca; TTL de 24 h poda', async () => {
    await markDosesResolved(['a', 'b'], NOW.getTime())
    expect(await isDoseResolved('a', NOW.getTime())).toBe(true)
    await unmarkDoseResolved('a', NOW.getTime())
    expect(await isDoseResolved('a', NOW.getTime())).toBe(false)
    expect(await isDoseResolved('b', NOW.getTime() + RESOLVED_DOSE_TTL_MS + 1)).toBe(false)
  })

  it('marcas concorrentes não se sobrescrevem (RC6 #930)', async () => {
    await Promise.all([markDosesResolved(['a'], NOW.getTime()), markDosesResolved(['b'], NOW.getTime())])
    expect(await isDoseResolved('a', NOW.getTime())).toBe(true)
    expect(await isDoseResolved('b', NOW.getTime())).toBe(true)
  })

  it('JSON inválido ou id vazio ⇒ não resolvida (fail-open)', async () => {
    mockStore.set(RESOLVED_DOSES_KEY, '{nope')
    expect(await isDoseResolved('a')).toBe(false)
    expect(await isDoseResolved(null)).toBe(false)
  })
})

describe('guard da superfície', () => {
  it('controle: dose não resolvida arma e agenda o próximo boundary', async () => {
    const di = doseItem()
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
  })

  it('arme em voo de dose já registrada: não exibe, não agenda e encerra', async () => {
    await markDosesResolved(['inst-1'])
    const di = doseItem()
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:surface')
  })

  it('boundary entregue de dose registrada (o `late` do C-35): encerra e não encadeia', async () => {
    await markDosesResolved(['inst-1'])
    const data = { __surface: 'true', doseInstanceId: 'inst-1', scheduledFor: iso(-11), toleranceMinutes: '120', isCritical: 'true' }
    await advanceDoseActivity(data, NOW)
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
  })

  it('reaparecimento da soneca de dose registrada não é agendado', async () => {
    await markDosesResolved(['inst-1'])
    await deferDoseItem(doseItem({ snoozedUntil: NOW.getTime() + 5 * M }), NOW.getTime())
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})
