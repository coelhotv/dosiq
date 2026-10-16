// 054 C-23: no iOS, só Alertas Críticos permitidos ⇒ status AUTHORIZED com alerta desligado.
// O app não pode chamar isso de "notificações ligadas" nem registrar token de push.
import * as Notifications from 'expo-notifications'

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getNotificationChannelAsync: jest.fn(),
  AndroidImportance: { NONE: 1, MIN: 2, LOW: 3, DEFAULT: 4, HIGH: 5 },
}))
jest.mock('../registerPushToken', () => ({ registerPushToken: jest.fn(() => Promise.resolve()) }))
const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a: any[]) => mockLogEvent(...a) }))

import { getPushPermissionStatus, ensurePushPermission } from '../pushPermission'
import { registerPushToken } from '../registerPushToken'
import { enablePushAtIntent, getPushChannelState, requestPushOrOpenSettings } from '../pushPermission'

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS
const get = Notifications.getPermissionsAsync as jest.Mock
const req = Notifications.requestPermissionsAsync as jest.Mock

beforeEach(() => {
  RN.Platform.OS = 'ios'
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('pushPermission — push efetivo (054 C-23)', () => {
  it('🔴 iOS granted + alerta desligado (só crítico) ⇒ NÃO está ligado', async () => {
    get.mockResolvedValue({ status: 'granted', canAskAgain: true, ios: { allowsAlert: false } })
    expect(await getPushPermissionStatus()).toEqual({ status: 'denied', canAskAgain: false, granted: false })
  })

  it('🔴 ensurePushPermission não registra token nem pede de novo: manda para Ajustes', async () => {
    get.mockResolvedValue({ status: 'granted', canAskAgain: true, ios: { allowsAlert: false } })
    expect(await enablePushAtIntent({ supabase: {} })).toEqual({ granted: false, blocked: true })
    expect(req).not.toHaveBeenCalled()
    expect(registerPushToken).not.toHaveBeenCalled()
  })

  it('iOS granted + alerta ligado ⇒ ligado', async () => {
    get.mockResolvedValue({ status: 'granted', canAskAgain: true, ios: { allowsAlert: true } })
    expect((await getPushPermissionStatus()).granted).toBe(true)
  })

  it('allowsAlert ausente (null) não rebaixa', async () => {
    get.mockResolvedValue({ status: 'granted', canAskAgain: true, ios: { allowsAlert: null } })
    expect((await getPushPermissionStatus()).granted).toBe(true)
  })

  it('Android ignora o campo do iOS', async () => {
    RN.Platform.OS = 'android'
    get.mockResolvedValue({ status: 'granted', canAskAgain: true })
    expect((await ensurePushPermission()).granted).toBe(true)
  })

  it('prompt concedido mas sem alerta ⇒ evento de NEGAÇÃO', async () => {
    get.mockResolvedValue({ status: 'undetermined', canAskAgain: true })
    req.mockResolvedValue({ status: 'granted', canAskAgain: false, ios: { allowsAlert: false } })
    expect((await ensurePushPermission()).granted).toBe(false)
    expect(mockLogEvent.mock.calls[0][0]).toBe('notification_permission_denied')
  })
})

describe('pushPermission — canal do push comum no Android (054 C-31)', () => {
  const channel = Notifications.getNotificationChannelAsync as jest.Mock
  beforeEach(() => { RN.Platform.OS = 'android' })

  it('🔴 canal desligado (NONE) ⇒ blocked, mesmo com permissão geral', async () => {
    channel.mockResolvedValue({ importance: 1 })
    expect(await getPushChannelState()).toBe('blocked')
  })

  it('canal em Silencioso (LOW/MIN) ⇒ silenced', async () => {
    channel.mockResolvedValue({ importance: 3 })
    expect(await getPushChannelState()).toBe('silenced')
    channel.mockResolvedValue({ importance: 2 })
    expect(await getPushChannelState()).toBe('silenced')
  })

  it('canal ligado ⇒ ok; ausente ou erro ⇒ unknown (não afirmar nada)', async () => {
    channel.mockResolvedValue({ importance: 5 })
    expect(await getPushChannelState()).toBe('ok')
    channel.mockResolvedValue(null)
    expect(await getPushChannelState()).toBe('unknown')
    channel.mockRejectedValue(new Error('x'))
    expect(await getPushChannelState()).toBe('unknown')
  })

  it('iOS não tem canais ⇒ ok, sem ler nada', async () => {
    RN.Platform.OS = 'ios'
    expect(await getPushChannelState()).toBe('ok')
    expect(channel).not.toHaveBeenCalled()
  })
})

describe('requestPushOrOpenSettings — Android sempre pede (054 C-33)', () => {
  const { Linking } = RN
  beforeEach(() => { RN.Platform.OS = 'android' })

  it('🔴 pede ao SO mesmo com canAskAgain:false; concedido registra token', async () => {
    req.mockResolvedValue({ status: 'granted', canAskAgain: true })
    expect(await requestPushOrOpenSettings({ supabase: {} })).toBe(true)
    expect(req).toHaveBeenCalled()
    expect(registerPushToken).toHaveBeenCalled()
  })

  it('🔴 negado na hora (sem diálogo) ⇒ abre Ajustes', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    req.mockResolvedValue({ status: 'denied', canAskAgain: false })
    expect(await requestPushOrOpenSettings({ supabase: {} })).toBe(false)
    expect(spy).toHaveBeenCalled()
  })

  it('negado pela pessoa no diálogo (demorou) ⇒ não abre Ajustes', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    const now = jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(5000)
    req.mockResolvedValue({ status: 'denied', canAskAgain: false })
    expect(await requestPushOrOpenSettings({ supabase: {} })).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    now.mockRestore()
  })
})
