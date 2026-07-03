// Spec 042 Slice B (PO-1) — beacon de dose crítica no disparo (Android headless).
// Prova: monta {event, permission_snapshot} correto e ENFILEIRA; filtra não-crítica/órfão; fail-open.

import { Platform } from 'react-native'

// Mock da fila: captura os payloads enfileirados (o beacon usa uma instância module-level).
const mockEnqueue = jest.fn().mockResolvedValue(undefined)
jest.mock('../criticalAuditQueue', () => ({
  createCriticalAuditQueue: () => ({ enqueue: mockEnqueue }),
  AUDIT_QUEUE_KEY: '@dosiq/audit/queue',
  AUDIT_QUEUE_CAP: 200,
}))

// Const do canal crítico sem carregar o alarmService pesado (supabase/firebase).
jest.mock('@platform/alarms/alarmService', () => ({ ALARM_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v2' }))

// notifee: settings de permissão + canal.
const mockGetSettings = jest.fn()
const mockGetChannel = jest.fn().mockResolvedValue({ importance: 4 })
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    getNotificationSettings: (...a) => mockGetSettings(...a),
    getChannel: (...a) => mockGetChannel(...a),
  },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  AndroidImportance: { NONE: 0, HIGH: 4 },
}))

// Sessão: dono da dose.
const mockGetUser = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: (...a) => mockGetUser(...a) } },
}))

import { beaconAlarmDelivered } from '../criticalAuditBeacon'

const USER = '58ff7850-8d96-4db5-9051-0908a115611c'
const INST = '22222222-2222-4222-8222-222222222222'

const authorized = () => mockGetSettings.mockResolvedValue({ authorizationStatus: 1 })

describe('criticalAuditBeacon — beaconAlarmDelivered', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER } } })
    authorized()
  })
  afterEach(() => {
    jest.clearAllMocks()
    mockGetChannel.mockResolvedValue({ importance: 4 })
  })

  it('sem doseInstanceId → não enfileira', async () => {
    await beaconAlarmDelivered({ isCritical: 'true' })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('não-crítica → não enfileira (só dose crítica gera trail)', async () => {
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'false' })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('sem sessão (userId null) → não enfileira (órfão proibido)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'true' })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('crítica + autorizado + nag 0 → alarm_fired enfileirado (camelCase, snapshot)', async () => {
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'true', nagAttempt: '0' })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const evt = mockEnqueue.mock.calls[0][0]
    expect(evt).toMatchObject({
      userId: USER,
      doseInstanceId: INST,
      event: 'alarm_fired',
      platform: Platform.OS,
      actor: 'system',
    })
    expect(evt.detail.permission_snapshot).toBeTruthy()
  })

  it('nagAttempt > 0 → nag_fired', async () => {
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'true', nagAttempt: '2' })
    expect(mockEnqueue.mock.calls[0][0].event).toBe('nag_fired')
  })

  it('permissão negada → alarm_suppressed + reason', async () => {
    mockGetSettings.mockResolvedValue({ authorizationStatus: 0 }) // DENIED
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'true', nagAttempt: '0' })
    const evt = mockEnqueue.mock.calls[0][0]
    expect(evt.event).toBe('alarm_suppressed')
    expect(evt.detail.reason).toBe('notifications_blocked')
  })

  it('getNotificationSettings falha → snapshot null mas ainda enfileira alarm_fired (fail-open)', async () => {
    mockGetSettings.mockRejectedValue(new Error('native fail'))
    await beaconAlarmDelivered({ doseInstanceId: INST, isCritical: 'true', nagAttempt: '0' })
    const evt = mockEnqueue.mock.calls[0][0]
    expect(evt.event).toBe('alarm_fired')
    expect(evt.detail.permission_snapshot).toBeNull()
  })
})
