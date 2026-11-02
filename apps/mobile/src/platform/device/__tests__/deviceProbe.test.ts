// 082 D2 (PO-D2-2 · PO-D2-9): fatos crus fail-safe + capacidade derivada sem bateria.

import notifee from '@notifee/react-native'
import { probeDevice, deriveCapability, type DeviceFacts } from '../deviceProbe'

jest.mock('@platform/alarms/alarmService', () => ({
  ALARM_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v3',
  LEGACY_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v2',
  isPushUsable: (s) => s?.authorizationStatus === 1 || s?.authorizationStatus === 2,
}))

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS
const mocked = notifee as unknown as Record<string, jest.Mock>

const facts = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({
  notificationsAllowed: true,
  alarmChannelBlocked: false,
  exactAlarmAllowed: true,
  criticalArmedIds: ['a', 'b'],
  batteryOptimized: false,
  powerManagerActivity: null,
  ...over,
})

beforeEach(() => {
  RN.Platform.OS = 'android'
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('probeDevice', () => {
  it('Android: lê push, canal NONE, alarme exato negado e ids armados', async () => {
    mocked.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 1, android: { alarm: 0 } })
    mocked.getChannel.mockResolvedValueOnce({ importance: 0 })
    mocked.getTriggerNotificationIds.mockResolvedValueOnce(['x', 42])
    mocked.isBatteryOptimizationEnabled.mockResolvedValueOnce(true)
    const out = await probeDevice()
    expect(out).toEqual({
      notificationsAllowed: true,
      alarmChannelBlocked: true,
      exactAlarmAllowed: false,
      criticalArmedIds: ['x', '42'],
      batteryOptimized: true,
      powerManagerActivity: null,
    })
  })

  it('Android <12 (NOT_SUPPORTED) conta alarme exato como liberado; canal inexistente não bloqueia', async () => {
    mocked.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 1, android: { alarm: -1 } })
    const out = await probeDevice()
    expect(out.exactAlarmAllowed).toBe(true)
    expect(out.alarmChannelBlocked).toBe(false)
  })

  it('cada leitura que lança vira null (fail-safe)', async () => {
    mocked.getNotificationSettings.mockRejectedValueOnce(new Error('x'))
    mocked.getChannel.mockRejectedValueOnce(new Error('x'))
    mocked.getTriggerNotificationIds.mockRejectedValueOnce(new Error('x'))
    mocked.isBatteryOptimizationEnabled.mockRejectedValueOnce(new Error('x'))
    mocked.getPowerManagerInfo.mockRejectedValueOnce(new Error('x'))
    const out = await probeDevice()
    expect(out).toEqual({
      notificationsAllowed: null,
      alarmChannelBlocked: null,
      exactAlarmAllowed: null,
      criticalArmedIds: null,
      batteryOptimized: null,
      powerManagerActivity: null,
    })
  })

  it('iOS: fatos de Android são null; crítico autorizado conta como notificação permitida (C-11)', async () => {
    RN.Platform.OS = 'ios'
    mocked.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 0, ios: { criticalAlert: 1 } })
    mocked.getTriggerNotificationIds.mockResolvedValueOnce(['a'])
    const out = await probeDevice()
    expect(out.notificationsAllowed).toBe(true)
    expect(out.alarmChannelBlocked).toBeNull()
    expect(out.exactAlarmAllowed).toBeNull()
    expect(out.batteryOptimized).toBeNull()
    expect(mocked.getChannel).not.toHaveBeenCalled()
  })

  it('iOS: permissão revogada sem crítico ⇒ notificação não permitida', async () => {
    RN.Platform.OS = 'ios'
    mocked.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 0, ios: { criticalAlert: 0 } })
    expect((await probeDevice()).notificationsAllowed).toBe(false)
  })
})

describe('deriveCapability', () => {
  it('capaz com tudo liberado e ao menos 1 crítico armado', () => {
    expect(deriveCapability(facts(), ['a', 'c'])).toEqual({ capable: true, criticalExpected: 2, criticalArmed: 1 })
  })

  it.each([
    ['permissão revogada', { notificationsAllowed: false }],
    ['canal do alarme NONE', { alarmChannelBlocked: true }],
    ['alarme exato negado', { exactAlarmAllowed: false }],
    ['zero críticos armados', { criticalArmedIds: ['zzz'] }],
  ])('negativo: %s', (_label, over) => {
    expect(deriveCapability(facts(over as Partial<DeviceFacts>), ['a'])?.capable).toBe(false)
  })

  it('PO-D2-9: bateria otimizada NUNCA gera negativo', () => {
    expect(deriveCapability(facts({ batteryOptimized: true, powerManagerActivity: 'x' }), ['a'])?.capable).toBe(true)
  })

  it('sem dose crítica no horizonte ⇒ null (não emite)', () => {
    expect(deriveCapability(facts(), [])).toBeNull()
  })

  it.each([
    ['notificações', { notificationsAllowed: null }],
    ['ids armados', { criticalArmedIds: null }],
    ['canal (Android)', { alarmChannelBlocked: null }],
    ['alarme exato (Android)', { exactAlarmAllowed: null }],
  ])('fato desconhecido (%s) ⇒ null, nunca negativo', (_label, over) => {
    expect(deriveCapability(facts(over as Partial<DeviceFacts>), ['a'])).toBeNull()
  })

  it('iOS: canal/alarme exato null não bloqueiam', () => {
    RN.Platform.OS = 'ios'
    expect(deriveCapability(facts({ alarmChannelBlocked: null, exactAlarmAllowed: null }), ['a'])?.capable).toBe(true)
  })
})
