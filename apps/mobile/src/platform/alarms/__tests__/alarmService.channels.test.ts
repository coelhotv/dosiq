// alarmService.channels.test.ts — criação/escolha de canal Android do alarme (spec 062).
//
// Nasceu como CARACTERIZAÇÃO (FR-012): a criação de canal nunca tinha sido testada (RC3 E-6).
// ⚠️ Asserção sobre argumento passado à lib é regressão de WIRING, não prova de FR-002: o efeito
// no SO (usage=USAGE_ALARM) só se prova por `dumpsys` (PO-2/PO-8, INV-4).

import { Platform } from 'react-native'
import { ANDROID_PUSH_CHANNEL } from '@dosiq/core'

const mockSetChannel = jest.fn()
jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: (...a) => mockSetChannel(...a),
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
}))

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

// Flags de módulo (`criticalChannelEnsured` etc.) vivem por processo → cada teste carrega o
// módulo do zero, junto com o mock do notifee da mesma instância.
function loadFresh() {
  let mod: typeof import('../alarmService')
  let notifee: any
  jest.isolateModules(() => {
    notifee = require('@notifee/react-native').default
    mod = require('../alarmService')
  })
  return { mod: mod!, notifee }
}

const channelsOf = (notifee) => notifee.createTriggerNotification.mock.calls.map(([n]) => n.android.channelId)

const originalOS = Platform.OS

beforeEach(() => {
  mockSetChannel.mockResolvedValue(null)
})

afterEach(() => {
  Platform.OS = originalOS
  jest.clearAllMocks()
  mockSetChannel.mockReset()
})

describe('canal crítico vigente (D-1)', () => {
  beforeEach(() => {
    Platform.OS = 'android'
  })

  it('-v3 nasce pelo expo-notifications com USAGE_ALARM (wiring; prova é o dumpsys)', async () => {
    const { mod, notifee } = loadFresh()
    // INV-1/F0-Q5: o vigente nunca é um id já usado (recriar id apagado herda a config antiga)
    expect(mod.LEGACY_SWEEP_CHANNEL_IDS).not.toContain(mod.ALARM_CRITICAL_CHANNEL_ID)
    await expect(mod.ensureAlarmCriticalChannel()).resolves.toBe(true)
    const [id, cfg] = mockSetChannel.mock.calls[0]
    expect(id).toBe(mod.ALARM_CRITICAL_CHANNEL_ID)
    expect(cfg.audioAttributes).toEqual({ usage: 4, contentType: 4 })
    expect(cfg.sound).toBe('alarm_dose.wav')
    // nunca queimar o -v3 pelo notifee (Q5: id recriado herda a config antiga)
    expect(notifee.createChannel).not.toHaveBeenCalled()
  })

  it('setup não cria mais o canal não crítico (D-2)', async () => {
    const { mod, notifee } = loadFresh()
    await mod.ensureAlarmSetup()
    expect(mockSetChannel).toHaveBeenCalledTimes(1)
    expect(notifee.createChannel).not.toHaveBeenCalled()
  })

  it('idempotente: 1 criação por processo', async () => {
    const { mod } = loadFresh()
    await mod.ensureAlarmSetup()
    await mod.ensureAlarmSetup()
    expect(mockSetChannel).toHaveBeenCalledTimes(1)
  })

  it('todo alarme Android vai no canal vigente, crítico ou não (D-2)', async () => {
    const { mod, notifee } = loadFresh()
    await mod.scheduleAlarm({ doseInstanceId: 'c', scheduledFor: FUTURE(), isCritical: true })
    await mod.scheduleAlarm({ doseInstanceId: 'n', scheduledFor: FUTURE(), isCritical: false })
    expect(channelsOf(notifee)).toEqual([mod.ALARM_CRITICAL_CHANNEL_ID, mod.ALARM_CRITICAL_CHANNEL_ID])
  })

  it('alarme leva a marca do dosiq (D-7)', async () => {
    const { mod, notifee } = loadFresh()
    await mod.scheduleAlarm({ doseInstanceId: 'c', scheduledFor: FUTURE(), isCritical: true })
    const [n] = notifee.createTriggerNotification.mock.calls[0]
    expect(n.android.smallIcon).toBe('ic_dosiq_mark')
    expect(n.android.color).toBe('#006A5E')
    // iOS segue na categoria antiga (string, não canal)
    expect(n.ios.categoryId).toBe(mod.ALARM_CHANNEL_ID)
  })
})

describe('fallback quando o expo falha (E-2 / FR-006)', () => {
  beforeEach(() => {
    Platform.OS = 'android'
  })

  it('expo rejeita ⇒ alarme ainda agenda, no -v2 criado pelo notifee', async () => {
    mockSetChannel.mockRejectedValue(new Error('oem'))
    const { mod, notifee } = loadFresh()
    await expect(mod.ensureAlarmCriticalChannel()).resolves.toBe(false)
    await mod.scheduleAlarm({ doseInstanceId: 'c', scheduledFor: FUTURE(), isCritical: true })
    expect(channelsOf(notifee)).toEqual([mod.LEGACY_CRITICAL_CHANNEL_ID])
    expect(notifee.createChannel.mock.calls.map(([c]) => c.id)).toContain(mod.LEGACY_CRITICAL_CHANNEL_ID)
    expect(notifee.createChannel.mock.calls.map(([c]) => c.id)).not.toContain(mod.ALARM_CRITICAL_CHANNEL_ID)
  })

  it('falha transitória: o setup seguinte re-tenta e passa ao -v3', async () => {
    mockSetChannel.mockRejectedValueOnce(new Error('oem')).mockResolvedValue(null)
    const { mod, notifee } = loadFresh()
    await mod.scheduleAlarm({ doseInstanceId: 'a', scheduledFor: FUTURE(), isCritical: true })
    await mod.scheduleAlarm({ doseInstanceId: 'b', scheduledFor: FUTURE(), isCritical: true })
    expect(channelsOf(notifee)).toEqual([mod.LEGACY_CRITICAL_CHANNEL_ID, mod.ALARM_CRITICAL_CHANNEL_ID])
  })
})

describe('migrateLegacyAlarmChannels (D-3)', () => {
  beforeEach(() => {
    Platform.OS = 'android'
  })

  const deleted = (notifee) => notifee.deleteChannel.mock.calls.map(([id]) => id)
  const onChannel = (channelId) => ({ notification: { android: { channelId } } })

  it('lista fechada: legados de alarme ⊂ varredura, que inclui só a superfície antiga a mais (E-3)', () => {
    const { mod } = loadFresh()
    expect([...mod.LEGACY_SWEEP_CHANNEL_IDS]).toEqual([...mod.LEGACY_ALARM_CHANNEL_IDS, 'dose-activity-v1'])
    expect(mod.LEGACY_ALARM_CHANNEL_IDS).not.toContain(mod.ALARM_CRITICAL_CHANNEL_ID)
    expect(mod.LEGACY_SWEEP_CHANNEL_IDS).not.toContain('dose-activity-v2')
    expect(mod.LEGACY_SWEEP_CHANNEL_IDS).not.toContain(ANDROID_PUSH_CHANNEL.DEFAULT)
  })

  it('inclui todo id de alarme que já existiu em código (histórico do git, não suposição)', () => {
    const { mod } = loadFresh()
    for (const id of ['dose-alarm', 'dose-alarm-v3', 'dose-alarm-critical-v1', 'dose-alarm-critical-v2']) {
      expect(mod.LEGACY_ALARM_CHANNEL_IDS).toContain(id)
    }
  })

  it('varre todos os legados e garante o -v3 antes (C-1: sem alarme agendado no processo)', async () => {
    const { mod, notifee } = loadFresh()
    await mod.migrateLegacyAlarmChannels()
    expect(mockSetChannel).toHaveBeenCalledTimes(1)
    expect(deleted(notifee)).toEqual([...mod.LEGACY_SWEEP_CHANNEL_IDS])
  })

  it('varredura limpa roda 1× por processo', async () => {
    const { mod, notifee } = loadFresh()
    await mod.migrateLegacyAlarmChannels()
    await mod.migrateLegacyAlarmChannels()
    expect(notifee.deleteChannel).toHaveBeenCalledTimes(mod.LEGACY_SWEEP_CHANNEL_IDS.length)
  })

  it('-v3 não garantido ⇒ não deleta nada (o -v2 é o canal vivo)', async () => {
    mockSetChannel.mockRejectedValue(new Error('oem'))
    const { mod, notifee } = loadFresh()
    await mod.migrateLegacyAlarmChannels()
    expect(notifee.deleteChannel).not.toHaveBeenCalled()
  })

  it('expo E fallback -v2 falhando juntos ⇒ não lança e não deleta (RC6 #867)', async () => {
    mockSetChannel.mockRejectedValue(new Error('oem'))
    const { mod, notifee } = loadFresh()
    notifee.createChannel.mockRejectedValueOnce(new Error('oem'))
    await expect(mod.migrateLegacyAlarmChannels()).resolves.toBeUndefined()
    expect(notifee.deleteChannel).not.toHaveBeenCalled()
  })

  it('pula id com notificação exibida e tenta de novo na próxima chamada (Q7 / E-4)', async () => {
    const { mod, notifee } = loadFresh()
    notifee.getDisplayedNotifications.mockResolvedValueOnce([onChannel(mod.LEGACY_CRITICAL_CHANNEL_ID)])
    await mod.migrateLegacyAlarmChannels()
    expect(deleted(notifee)).not.toContain(mod.LEGACY_CRITICAL_CHANNEL_ID)
    expect(deleted(notifee)).toContain('dose-alarm')
    notifee.deleteChannel.mockClear()
    await mod.migrateLegacyAlarmChannels()
    expect(deleted(notifee)).toContain(mod.LEGACY_CRITICAL_CHANNEL_ID)
  })

  it('pula id com trigger pendente (E-1)', async () => {
    const { mod, notifee } = loadFresh()
    notifee.getTriggerNotifications.mockResolvedValueOnce([onChannel(mod.LEGACY_CRITICAL_CHANNEL_ID)])
    await mod.migrateLegacyAlarmChannels()
    expect(deleted(notifee)).not.toContain(mod.LEGACY_CRITICAL_CHANNEL_ID)
  })

  it.each(['getDisplayedNotifications', 'getTriggerNotifications'])('%s lança ⇒ 0 deleções, sem lançar', async (fn) => {
    const { mod, notifee } = loadFresh()
    notifee[fn].mockRejectedValueOnce(new Error('x'))
    await expect(mod.migrateLegacyAlarmChannels()).resolves.toBeUndefined()
    expect(notifee.deleteChannel).not.toHaveBeenCalled()
  })

  it('deleteChannel lança num id ⇒ demais seguem e a varredura re-tenta', async () => {
    const { mod, notifee } = loadFresh()
    notifee.deleteChannel.mockRejectedValueOnce(new Error('x'))
    await expect(mod.migrateLegacyAlarmChannels()).resolves.toBeUndefined()
    expect(notifee.deleteChannel).toHaveBeenCalledTimes(mod.LEGACY_SWEEP_CHANNEL_IDS.length)
    notifee.deleteChannel.mockClear()
    await mod.migrateLegacyAlarmChannels()
    expect(notifee.deleteChannel).toHaveBeenCalledTimes(mod.LEGACY_SWEEP_CHANNEL_IDS.length)
  })

  it('item exibido sem notification/android não quebra', async () => {
    const { mod, notifee } = loadFresh()
    notifee.getDisplayedNotifications.mockResolvedValueOnce([null, {}, { notification: null }])
    await mod.migrateLegacyAlarmChannels()
    expect(notifee.deleteChannel).toHaveBeenCalledTimes(mod.LEGACY_SWEEP_CHANNEL_IDS.length)
  })

  it('soneca e nag (caminhos headless) nunca deletam canal (E-1)', async () => {
    const { mod, notifee } = loadFresh()
    notifee.getTriggerNotifications.mockResolvedValue([onChannel(mod.LEGACY_CRITICAL_CHANNEL_ID)])
    await mod.scheduleSnooze({ doseInstanceId: 'd', medicineName: 'X', scheduledFor: new Date().toISOString(), toleranceMinutes: 120 })
    await mod.scheduleNag({ doseInstanceId: 'd' })
    expect(notifee.deleteChannel).not.toHaveBeenCalled()
  })
})

describe('iOS', () => {
  it('não cria nem deleta canal', async () => {
    Platform.OS = 'ios'
    const { mod, notifee } = loadFresh()
    await mod.ensureAlarmSetup()
    await mod.migrateLegacyAlarmChannels()
    expect(mockSetChannel).not.toHaveBeenCalled()
    expect(notifee.createChannel).not.toHaveBeenCalled()
    expect(notifee.deleteChannel).not.toHaveBeenCalled()
  })
})
