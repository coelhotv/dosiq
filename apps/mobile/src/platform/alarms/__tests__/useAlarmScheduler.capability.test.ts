// 082 D2 (PO-D2-2 · PO-D2-3): boletim `device_capability` pós-sync, throttle e dedupe zerado no negativo.

import { syncAlarms, CAPABILITY_AUDIT_KEY, CAPABILITY_REFRESH_MS } from '../useAlarmScheduler'

const SCHEDULED_AUDIT_KEY = '@dosiq/audit/alarm_scheduled_ids'
const ALLOWLIST = [
  'alarm_channel_blocked',
  'app_version',
  'background_restricted',
  'capable',
  'critical_armed',
  'critical_expected',
  'exact_alarm_allowed',
  'notifications_allowed',
]

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

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } } }))
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.34.2' } }))

jest.mock('../alarmService', () => ({
  alarmService: {
    cancelAll: jest.fn().mockResolvedValue(undefined),
    scheduleAlarm: jest.fn().mockResolvedValue(undefined),
    migrateLegacyAlarmChannels: jest.fn().mockResolvedValue(undefined),
  },
}))

let mockFacts: any = null
jest.mock('@platform/device/deviceProbe', () => ({
  probeDevice: jest.fn(async () => {
    if (mockFacts instanceof Error) throw mockFacts
    return mockFacts
  }),
  deriveCapability: jest.requireActual('@platform/device/deviceProbe').deriveCapability,
}))

const mockEmit = jest.fn()
let mockItems = []
jest.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  createCriticalAuditService: () => ({ emit: mockEmit }),
  buildDoseItemsFromInstances: () => mockItems,
  ensureInstancesUpTo: jest.fn().mockResolvedValue(undefined),
  getRawNow: () => new Date('2026-03-05T12:00:00.000Z'),
  addDays: (d, n) => new Date(d.getTime() + n * 86400000),
  parseISO: (s) => new Date(s),
}))

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS

const item = (instanceId, scheduledFor = '2026-03-05T14:00:00.000Z') => ({
  instanceId,
  scheduledFor,
  status: 'pending',
  critical: true,
  toleranceMinutes: 120,
  medicineName: 'Lantus',
})

const capable = (over = {}) => ({
  notificationsAllowed: true,
  alarmChannelBlocked: false,
  exactAlarmAllowed: true,
  criticalArmedIds: ['i1'],
  backgroundRestricted: false,
  batteryOptimized: true,
  powerManagerActivity: null,
  ...over,
})

const calls = (event) => mockEmit.mock.calls.map((c) => c[0]).filter((e) => e.event === event)
const sync = () => syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

beforeEach(() => {
  RN.Platform.OS = 'android'
  mockItems = [item('i1')]
  mockFacts = capable()
  mockEmit.mockResolvedValue({ ok: true })
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockStore.clear()
})

describe('boletim device_capability (082 D2)', () => {
  it('capaz: emite alarm_scheduled e o boletim positivo, detail só com a allowlist', async () => {
    await sync()
    expect(calls('alarm_scheduled')).toHaveLength(1)
    const [b] = calls('device_capability')
    expect(b).toMatchObject({ userId: 'u1', doseInstanceId: null, actor: 'system', platform: 'android' })
    expect(Object.keys(b.detail).sort()).toEqual(ALLOWLIST)
    expect(b.detail).toMatchObject({ capable: true, critical_expected: 1, critical_armed: 1, app_version: '0.34.2' })
  })

  it.each([
    ['permissão revogada', { notificationsAllowed: false }],
    ['canal do alarme NONE', { alarmChannelBlocked: true }],
    ['alarme exato negado', { exactAlarmAllowed: false }],
    ['zero alarmes críticos armados', { criticalArmedIds: [] }],
    ['app restrito em segundo plano', { backgroundRestricted: true }],
  ])('negativo (%s): emite capable=false, zera o dedupe e NÃO emite prova', async (_l, over) => {
    mockStore.set(SCHEDULED_AUDIT_KEY, JSON.stringify(['i1']))
    mockFacts = capable(over)
    await sync()
    expect(calls('device_capability')[0].detail.capable).toBe(false)
    expect(calls('alarm_scheduled')).toHaveLength(0)
    expect(mockStore.has(SCHEDULED_AUDIT_KEY)).toBe(false)
  })

  it('grupo: conta o id sintético do trigger (String(ts)), não os instanceIds', async () => {
    mockItems = [item('i1'), item('i2')]
    const ts = String(new Date('2026-03-05T14:00:00.000Z').getTime())
    mockFacts = capable({ criticalArmedIds: [ts] })
    await sync()
    expect(calls('device_capability')[0].detail).toMatchObject({ capable: true, critical_expected: 1, critical_armed: 1 })
  })

  it('leitura do aparelho com erro ⇒ não emite boletim; prova segue como antes', async () => {
    mockFacts = new Error('boom')
    await sync()
    expect(calls('device_capability')).toHaveLength(0)
    expect(calls('alarm_scheduled')).toHaveLength(1)
  })

  it('fato desconhecido (ids armados null) ⇒ não emite boletim', async () => {
    mockFacts = capable({ criticalArmedIds: null })
    await sync()
    expect(calls('device_capability')).toHaveLength(0)
  })

  it('sem dose crítica no horizonte ⇒ não emite boletim', async () => {
    mockItems = []
    await sync()
    expect(calls('device_capability')).toHaveLength(0)
  })

  it('PO-D2-9: bateria otimizada sozinha nunca vira negativo', async () => {
    mockFacts = capable({ batteryOptimized: true })
    await sync()
    expect(calls('device_capability')[0].detail.capable).toBe(true)
  })
})

describe('throttle e recuperação (PO-D2-3)', () => {
  it('mesmo estado em < 24 h não re-emite; mudança de estado emite', async () => {
    await sync()
    await sync()
    expect(calls('device_capability')).toHaveLength(1)
    mockFacts = capable({ alarmChannelBlocked: true })
    await sync()
    expect(calls('device_capability').map((b) => b.detail.capable)).toEqual([true, false])
  })

  it('dois syncs simultâneos emitem UM boletim (smoke T101: duplicata a 150 ms)', async () => {
    await Promise.all([sync(), sync()])
    expect(calls('device_capability')).toHaveLength(1)
  })

  it('mesmo estado após 24 h re-emite', async () => {
    mockStore.set(CAPABILITY_AUDIT_KEY, JSON.stringify({ capable: true, at: Date.now() - CAPABILITY_REFRESH_MS - 1 }))
    await sync()
    expect(calls('device_capability')).toHaveLength(1)
  })

  it('insert do boletim falho não grava throttle ⇒ próximo sync tenta de novo', async () => {
    mockFacts = capable({ alarmChannelBlocked: true })
    mockEmit.mockResolvedValueOnce({ ok: false })
    await sync()
    expect(mockStore.has(CAPABILITY_AUDIT_KEY)).toBe(false)
    await sync()
    expect(calls('device_capability')).toHaveLength(2)
    expect(JSON.parse(mockStore.get(CAPABILITY_AUDIT_KEY)!).capable).toBe(false)
  })

  it('negativo → positivo: o sync re-emite alarm_scheduled (prova NOVA, posterior ao negativo)', async () => {
    await sync()
    expect(calls('alarm_scheduled')).toHaveLength(1)
    mockFacts = capable({ alarmChannelBlocked: true })
    await sync()
    mockFacts = capable()
    await sync()
    const seq = mockEmit.mock.calls.map((c) => `${c[0].event}${c[0].detail?.capable === undefined ? '' : ':' + c[0].detail.capable}`)
    expect(seq).toEqual([
      'alarm_scheduled',
      'device_capability:true',
      'device_capability:false',
      'alarm_scheduled',
      'device_capability:true',
    ])
  })
})
