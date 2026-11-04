// 082 D2 (smoke T101): soneca num aparelho que não alarma reafirma o negativo, sem throttle.

import { reassertIncapableAfterSnooze, CAPABILITY_AUDIT_KEY } from '../capabilityBulletin'

const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v)
  }),
}))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
}))
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.34.2' } }))

const mockEmit = jest.fn()
jest.mock('@dosiq/core', () => ({ createCriticalAuditService: () => ({ emit: mockEmit }) }))

jest.mock('@platform/alarms/alarmService', () => ({}))
jest.mock('../backgroundRestriction', () => ({ isBackgroundRestricted: () => null }))

let mockFacts: any = null
jest.mock('../deviceProbe', () => ({
  probeDevice: jest.fn(async () => mockFacts),
  deriveCapability: jest.requireActual('../deviceProbe').deriveCapability,
}))

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS

const facts = (over = {}) => ({
  notificationsAllowed: true,
  alarmChannelBlocked: false,
  exactAlarmAllowed: true,
  criticalArmedIds: ['inst-4'],
  backgroundRestricted: false,
  batteryOptimized: true,
  powerManagerActivity: null,
  ...over,
})

beforeEach(() => {
  RN.Platform.OS = 'android'
  mockEmit.mockResolvedValue({ ok: true })
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockStore.clear()
})

describe('reassertIncapableAfterSnooze', () => {
  it('canal desligado: emite capable=false MESMO com o mesmo negativo no throttle', async () => {
    mockStore.set(CAPABILITY_AUDIT_KEY, JSON.stringify({ capable: false, at: Date.now() }))
    mockFacts = facts({ alarmChannelBlocked: true })
    await reassertIncapableAfterSnooze(['inst-4'])
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      event: 'device_capability',
      doseInstanceId: null,
      detail: { capable: false, alarm_channel_blocked: true },
    })
  })

  it('app restrito em segundo plano também reafirma', async () => {
    mockFacts = facts({ backgroundRestricted: true })
    await reassertIncapableAfterSnooze(['inst-4'])
    expect(mockEmit.mock.calls[0][0].detail.capable).toBe(false)
  })

  it('aparelho capaz ⇒ não emite (a soneca é prova legítima)', async () => {
    mockFacts = facts()
    await reassertIncapableAfterSnooze(['inst-4'])
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('fato desconhecido ⇒ não emite (desconhecido nunca é negativo)', async () => {
    mockFacts = facts({ notificationsAllowed: null })
    await reassertIncapableAfterSnooze(['inst-4'])
    expect(mockEmit).not.toHaveBeenCalled()
  })
})
