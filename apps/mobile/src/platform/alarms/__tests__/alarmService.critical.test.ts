// alarmService.critical.test.ts — spec 054 F1 / PO-1 (guard) · PO-3 (fallback) · C-1 · C-4
//
// O iOS DESCARTA a notificação inteira quando `critical:true` sai sem autorização (spike S1').
// Por isso a flag + volume só podem sair com dose crítica E Critical Alerts autorizado — e os 3
// emissores (T0, nag, soneca) leem o status no agendamento, inclusive headless (S3).

import notifee, { IOSNotificationSetting } from '@notifee/react-native'

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return {
    ...actual,
    createDoseInstanceRepository: () => ({ setSnoozedUntil: () => Promise.resolve() }),
    createCriticalAuditService: () => ({ emit: () => Promise.resolve() }),
  }
})
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) } },
}))
jest.mock('../snoozeAnchorStore', () => ({
  setSnoozeAnchors: () => Promise.resolve(),
  setSnoozeAttempts: () => Promise.resolve(),
  getSnoozeAttempts: () => Promise.resolve({}),
}))
jest.mock('@platform/doseActivity/liveActivityService', () => ({ endLiveActivity: () => Promise.resolve() }))
jest.mock('@platform/doseActivity/doseActivityScheduler', () => ({ deferDoseActivity: () => Promise.resolve() }))
const mockGetPermissions = jest.fn(() => Promise.resolve({}))
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  getPermissionsAsync: () => mockGetPermissions(),
}))
const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a: any[]) => mockLogEvent(...a) }))

import {
  scheduleAlarm,
  scheduleNag,
  scheduleSnooze,
  getCriticalAlertStatus,
  requestCriticalAlertPermission,
  invalidateCriticalAlertStatus,
  CRITICAL_VOLUME,
} from '../alarmService'

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS
const mockedCreate = notifee.createTriggerNotification as jest.Mock
const mockedSettings = notifee.getNotificationSettings as jest.Mock
const mockedRequest = notifee.requestPermission as jest.Mock

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const withCritical = (value: number) => mockedSettings.mockResolvedValue({ authorizationStatus: 1, ios: { criticalAlert: value } })
const lastIos = () => mockedCreate.mock.calls.at(-1)[0].ios

beforeEach(() => {
  RN.Platform.OS = 'ios'
  invalidateCriticalAlertStatus()
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('buildNotification via scheduleAlarm (PO-1 guard)', () => {
  it('dose crítica + autorizado ⇒ critical, volume 0.8, interruptionLevel critical', async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'i1', scheduledFor: FUTURE(), isCritical: true })
    expect(lastIos()).toEqual(expect.objectContaining({ critical: true, criticalVolume: CRITICAL_VOLUME, interruptionLevel: 'critical' }))
  })

  it('dose crítica SEM autorização ⇒ modo normal, sem critical nem volume (PO-3)', async () => {
    withCritical(IOSNotificationSetting.DISABLED)
    await scheduleAlarm({ doseInstanceId: 'i2', scheduledFor: FUTURE(), isCritical: true })
    expect(lastIos().critical).toBeUndefined()
    expect(lastIos().criticalVolume).toBeUndefined()
    expect(lastIos().interruptionLevel).toBe('timeSensitive')
  })

  it('autorizado mas dose NÃO crítica ⇒ timeSensitive e nem consulta o SO', async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'i3', scheduledFor: FUTURE(), isCritical: false })
    expect(lastIos().critical).toBeUndefined()
    expect(lastIos().interruptionLevel).toBe('timeSensitive')
    expect(mockedSettings).not.toHaveBeenCalled()
  })

  it("isCritical string 'true' NÃO ativa (só booleano true)", async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'i4', scheduledFor: FUTURE(), isCritical: 'true' as any })
    expect(lastIos().critical).toBeUndefined()
  })

  it('Android ⇒ nunca critical, sem consultar o SO', async () => {
    RN.Platform.OS = 'android'
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'i5', scheduledFor: FUTURE(), isCritical: true })
    expect(lastIos().critical).toBeUndefined()
    expect(mockedSettings).not.toHaveBeenCalled()
  })

  it('memo: N agendamentos no mesmo sync ⇒ 1 leitura do SO', async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'a', scheduledFor: FUTURE(), isCritical: true })
    await scheduleAlarm({ doseInstanceId: 'b', scheduledFor: FUTURE(), isCritical: true })
    expect(mockedSettings).toHaveBeenCalledTimes(1)
  })
})

describe('nag e soneca herdam (C-1, ADR-086 §1)', () => {
  it('nag de dose crítica autorizada sai critical', async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleNag({ doseInstanceId: 'n1', isCritical: true })
    expect(lastIos().critical).toBe(true)
  })

  it('nag sem autorização sai normal', async () => {
    withCritical(IOSNotificationSetting.DISABLED)
    await scheduleNag({ doseInstanceId: 'n2', isCritical: true })
    expect(lastIos().critical).toBeUndefined()
  })

  it('soneca de dose crítica autorizada sai critical', async () => {
    withCritical(IOSNotificationSetting.ENABLED)
    const r = await scheduleSnooze({ doseInstanceId: 's1', medicineName: 'Insulina', scheduledFor: new Date().toISOString(), isCritical: true })
    expect(r).not.toBe(false)
    expect(lastIos().critical).toBe(true)
  })
})

describe('getCriticalAlertStatus (failure modes)', () => {
  it('Android ⇒ false sem chamar a API', async () => {
    RN.Platform.OS = 'android'
    expect(await getCriticalAlertStatus()).toBe(false)
    expect(mockedSettings).not.toHaveBeenCalled()
  })

  it('API lança ⇒ false (fail-open p/ modo normal)', async () => {
    mockedSettings.mockRejectedValueOnce(new Error('boom'))
    expect(await getCriticalAlertStatus()).toBe(false)
  })

  it('settings.ios ausente ⇒ false', async () => {
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 1 })
    expect(await getCriticalAlertStatus()).toBe(false)
  })

  it.each([IOSNotificationSetting.NOT_SUPPORTED, IOSNotificationSetting.DISABLED])('%s ⇒ false', async (v) => {
    withCritical(v)
    expect(await getCriticalAlertStatus()).toBe(false)
  })
})

describe('requestCriticalAlertPermission', () => {
  it('pede criticalAlert junto de alert/sound/badge e devolve true se concedido', async () => {
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.ENABLED } })
    expect(await requestCriticalAlertPermission()).toBe(true)
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({ criticalAlert: true, alert: true }))
  })

  it('usuário nega ⇒ false, sem throw', async () => {
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.DISABLED } })
    expect(await requestCriticalAlertPermission()).toBe(false)
  })

  it('API lança ⇒ false', async () => {
    mockedRequest.mockRejectedValueOnce(new Error('x'))
    expect(await requestCriticalAlertPermission()).toBe(false)
  })

  it('Android ⇒ false sem pedir', async () => {
    RN.Platform.OS = 'android'
    expect(await requestCriticalAlertPermission()).toBe(false)
    expect(mockedRequest).not.toHaveBeenCalled()
  })

  it('concessão invalida o memo: próximo agendamento relê o SO', async () => {
    withCritical(IOSNotificationSetting.DISABLED)
    await scheduleAlarm({ doseInstanceId: 'm1', scheduledFor: FUTURE(), isCritical: true })
    mockedRequest.mockResolvedValueOnce({ ios: { criticalAlert: IOSNotificationSetting.ENABLED } })
    await requestCriticalAlertPermission()
    withCritical(IOSNotificationSetting.ENABLED)
    await scheduleAlarm({ doseInstanceId: 'm2', scheduledFor: FUTURE(), isCritical: true })
    expect(lastIos().critical).toBe(true)
  })
})

// 054 + 065 US5: o pedido combinado precisa contar na cobertura do push e medir o crítico.
describe('requestCriticalAlertPermission — eventos de decisão', () => {
  const names = () => mockLogEvent.mock.calls.map((c) => c[0])

  it('instalação nova (push e crítico não perguntados) ⇒ push granted + crítico granted', async () => {
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: -1, ios: { criticalAlert: IOSNotificationSetting.NOT_SUPPORTED } })
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.ENABLED } })
    await requestCriticalAlertPermission()
    expect(names()).toEqual(['notification_permission_granted', 'critical_alert_permission_granted'])
  })

  it('push já decidido ⇒ só o evento do crítico (negado)', async () => {
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 0, ios: { criticalAlert: IOSNotificationSetting.NOT_SUPPORTED } })
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 0, ios: { criticalAlert: IOSNotificationSetting.DISABLED } })
    await requestCriticalAlertPermission()
    expect(names()).toEqual(['critical_alert_permission_denied'])
  })

  it('crítico já decidido (sem diálogo) ⇒ nenhum evento', async () => {
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.DISABLED } })
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.DISABLED } })
    await requestCriticalAlertPermission()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('leitura prévia falha ⇒ pedido segue, sem evento (não inventa decisão)', async () => {
    mockedSettings.mockRejectedValueOnce(new Error('x'))
    mockedRequest.mockResolvedValueOnce({ authorizationStatus: 1, ios: { criticalAlert: IOSNotificationSetting.ENABLED } })
    expect(await requestCriticalAlertPermission()).toBe(true)
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

// 054 FR-009 emenda: classificação por gravidade (fonte da faixa do card).
describe('getCriticalAlarmDeviceStatus', () => {
  const { getCriticalAlarmDeviceStatus } = require('../alarmService')
  const mockedChannel = notifee.getChannel as jest.Mock
  const settings = (authorizationStatus: number, criticalAlert?: number) =>
    mockedSettings.mockResolvedValueOnce({ authorizationStatus, ios: criticalAlert == null ? undefined : { criticalAlert } })

  it('iOS crítico autorizado ⇒ active (mesmo com push negado — S6)', async () => {
    settings(0, IOSNotificationSetting.ENABLED)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'active' })
  })
  it('iOS push negado + crítico não ⇒ blocked', async () => {
    settings(0, IOSNotificationSetting.DISABLED)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'push' })
  })
  it('iOS push ok + crítico negado ⇒ degraded/settings', async () => {
    settings(1, IOSNotificationSetting.DISABLED)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'degraded', fix: 'settings' })
  })
  it('iOS push ok + crítico nunca perguntado ⇒ degraded/request', async () => {
    settings(1, IOSNotificationSetting.NOT_SUPPORTED)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'degraded', fix: 'request' })
  })
  it('Android push negado ⇒ blocked', async () => {
    RN.Platform.OS = 'android'
    settings(0)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'push', canRequest: true })
  })
  it('Android canal em NONE ⇒ blocked', async () => {
    RN.Platform.OS = 'android'
    settings(1)
    mockedChannel.mockResolvedValueOnce({ importance: 0 })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'channel' })
  })
  it('Android canal ainda não criado ⇒ active', async () => {
    RN.Platform.OS = 'android'
    settings(1)
    mockedChannel.mockResolvedValueOnce(null)
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'active' })
  })
  it('leitura lança ⇒ unknown', async () => {
    mockedSettings.mockRejectedValueOnce(new Error('x'))
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'unknown' })
  })
})

// 054 C-23: só crítico permitido deixa authorizationStatus AUTHORIZED com o alerta desligado.
describe('isPushUsable / classificação com alerta desligado', () => {
  const { isPushUsable, getCriticalAlarmDeviceStatus } = require('../alarmService')

  it('iOS AUTHORIZED + alert DISABLED ⇒ não utilizável', () => {
    expect(isPushUsable({ authorizationStatus: 1, ios: { alert: IOSNotificationSetting.DISABLED } })).toBe(false)
  })
  it('iOS AUTHORIZED + alert ENABLED ⇒ utilizável', () => {
    expect(isPushUsable({ authorizationStatus: 1, ios: { alert: IOSNotificationSetting.ENABLED } })).toBe(true)
  })
  it('🔴 iOS só crítico negado + alerta desligado ⇒ blocked (não "degraded")', async () => {
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 1, ios: { alert: IOSNotificationSetting.DISABLED, criticalAlert: IOSNotificationSetting.DISABLED } })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'push' })
  })
})

// 054 C-25: canal do alarme em "Silencioso" (Android) e leitura do canal REAL.
describe('getCriticalAlarmDeviceStatus — canal Android (C-25)', () => {
  const { getCriticalAlarmDeviceStatus } = require('../alarmService')
  const mockedChannel = notifee.getChannel as jest.Mock
  beforeEach(() => {
    RN.Platform.OS = 'android'
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 1 })
  })

  it.each([1, 2])('🔴 importância %s (Silencioso) ⇒ degraded channel_silenced, não "ativo"', async (importance) => {
    mockedChannel.mockResolvedValueOnce({ importance })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'degraded', fix: 'settings', reason: 'channel_silenced' })
  })

  it('🔴 DEFAULT (3) = "Exibir na tela" desligado ⇒ degraded channel_no_popup (C-32)', async () => {
    mockedChannel.mockResolvedValueOnce({ importance: 3 })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'degraded', fix: 'settings', reason: 'channel_no_popup' })
  })

  it('HIGH (4) ⇒ active', async () => {
    mockedChannel.mockResolvedValueOnce({ importance: 4 })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'active' })
  })

  it('🔴 lê o -v3 primeiro; sem -v3, cai no -v2 (não depende do sinalizador do processo)', async () => {
    mockedChannel.mockResolvedValueOnce(null).mockResolvedValueOnce({ importance: 0 })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'channel' })
    expect(mockedChannel.mock.calls.map((c) => c[0])).toEqual(['dose-alarm-critical-v3', 'dose-alarm-critical-v2'])
  })
})

// 054 C-33: instalação nova ⇒ pedir no SO, não mandar aos Ajustes.
describe('getCriticalAlarmDeviceStatus — nada decidido ainda (C-33)', () => {
  const { getCriticalAlarmDeviceStatus } = require('../alarmService')

  it('🔴 iOS push e crítico nunca perguntados ⇒ degraded request (sheet pede os dois)', async () => {
    RN.Platform.OS = 'ios'
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: -1, ios: { criticalAlert: -1 } })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'degraded', fix: 'request' })
  })

  it('🔴 Android push não concedido ⇒ sempre canRequest (canAskAgain do expo não é confiável)', async () => {
    RN.Platform.OS = 'android'
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 0 })
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied', canAskAgain: false })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'push', canRequest: true })
  })

  it('iOS push negado com crítico decidido ⇒ blocked sem canRequest (Ajustes)', async () => {
    RN.Platform.OS = 'ios'
    mockedSettings.mockResolvedValueOnce({ authorizationStatus: 0, ios: { criticalAlert: 0 } })
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied', canAskAgain: false })
    expect(await getCriticalAlarmDeviceStatus()).toEqual({ kind: 'blocked', reason: 'push' })
  })
})
