// Spec 042 Slice B (PO-SEC-3) — o detail dos eventos mobile nunca vaza PII (token/rótulo/segredo).
// Cobre os dois produtores mobile: deriveIosAlarmOutcome (puro) e beaconAlarmDelivered (enfileira).

import { deriveIosAlarmOutcome } from '../deriveIosAlarmOutcome'

// Mesmo mock-set do beacon (fila capturada + notifee/supabase/canal).
const mockEnqueue = jest.fn().mockResolvedValue(undefined)
jest.mock('../criticalAuditQueue', () => ({
  createCriticalAuditQueue: () => ({ enqueue: mockEnqueue }),
  AUDIT_QUEUE_KEY: 'k',
  AUDIT_QUEUE_CAP: 200,
}))
jest.mock('@platform/alarms/alarmService', () => ({ ALARM_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v2' }))
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getNotificationSettings: async () => ({ authorizationStatus: 1 }), getChannel: async () => ({ importance: 4 }) },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  AndroidImportance: { NONE: 0, HIGH: 4 },
}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) } },
}))

import { beaconAlarmDelivered } from '../criticalAuditBeacon'

const FORBIDDEN = ['la_push_token', 'push_token', 'medicineName', 'authKey', 'p8', 'Selozok']

function assertNoPii(payload) {
  const json = JSON.stringify(payload)
  for (const k of FORBIDDEN) expect(json).not.toContain(k)
}

describe('criticalAuditDetailShape (mobile) — sem PII no detail', () => {
  afterEach(() => jest.clearAllMocks())

  it('deriveIosAlarmOutcome: payloads só com {captured_at_foreground, reason?}', () => {
    const out = deriveIosAlarmOutcome({
      alarms: [
        { doseInstanceId: 'i1', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
        { doseInstanceId: 'i2', isCritical: true, nagAttempt: 0, doseStatus: 'pending' },
      ],
      permissionGranted: false, // força suppressed (com reason)
      userId: 'u-1',
    })
    expect(out.length).toBe(2)
    for (const p of out) {
      assertNoPii(p)
      const keys = Object.keys(p.detail)
      expect(keys.every((k) => k === 'captured_at_foreground' || k === 'reason')).toBe(true)
    }
  })

  it('beaconAlarmDelivered: enfileira sem PII (só permission_snapshot/reason no detail)', async () => {
    await beaconAlarmDelivered({ doseInstanceId: 'i1', isCritical: 'true', nagAttempt: '0', medicineName: 'Selozok' })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const evt = mockEnqueue.mock.calls[0][0]
    assertNoPii(evt)
    const keys = Object.keys(evt.detail)
    expect(keys.every((k) => k === 'permission_snapshot' || k === 'reason')).toBe(true)
  })
})
