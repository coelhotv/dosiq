// alarmService.channels.test.ts — criação/escolha de canal Android do alarme (spec 062).
//
// Nasceu como CARACTERIZAÇÃO (FR-012): a criação de canal nunca tinha sido testada (RC3 E-6).
// ⚠️ Asserção sobre argumento passado à lib é regressão de WIRING, não prova de FR-002: o efeito
// no SO (usage=USAGE_ALARM) só se prova por `dumpsys` (PO-2/PO-8, INV-4).

import { Platform } from 'react-native'

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

const originalOS = Platform.OS

afterEach(() => {
  Platform.OS = originalOS
  jest.clearAllMocks()
})

describe('ensureAlarmSetup — Android (comportamento atual)', () => {
  beforeEach(() => {
    Platform.OS = 'android'
  })

  it('cria o canal não crítico e o crítico pelo notifee', async () => {
    const { mod, notifee } = loadFresh()
    await mod.ensureAlarmSetup()
    const ids = notifee.createChannel.mock.calls.map(([c]) => c.id)
    expect(ids).toEqual([mod.ALARM_CHANNEL_ID, mod.ALARM_CRITICAL_CHANNEL_ID])
  })

  it('é idempotente no mesmo processo', async () => {
    const { mod, notifee } = loadFresh()
    await mod.ensureAlarmSetup()
    await mod.ensureAlarmSetup()
    expect(notifee.createChannel).toHaveBeenCalledTimes(2)
  })

  it('escolhe o canal por isCritical', async () => {
    const { mod, notifee } = loadFresh()
    await mod.scheduleAlarm({ doseInstanceId: 'c', scheduledFor: FUTURE(), isCritical: true })
    await mod.scheduleAlarm({ doseInstanceId: 'n', scheduledFor: FUTURE(), isCritical: false })
    const channels = notifee.createTriggerNotification.mock.calls.map(([n]) => n.android.channelId)
    expect(channels).toEqual([mod.ALARM_CRITICAL_CHANNEL_ID, mod.ALARM_CHANNEL_ID])
  })
})

describe('ensureAlarmSetup — iOS', () => {
  it('não cria canal Android', async () => {
    Platform.OS = 'ios'
    const { mod, notifee } = loadFresh()
    await mod.ensureAlarmSetup()
    expect(notifee.createChannel).not.toHaveBeenCalled()
  })
})
