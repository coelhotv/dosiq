import notifee, { TriggerType } from '@notifee/react-native'
import { scheduleAlarm, cancelAlarm, scheduleNag, cancelAll } from '../alarmService'

const mockedCreateTriggerNotification = notifee.createTriggerNotification as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

describe('scheduleAlarm', () => {
  it('agenda trigger TIMESTAMP com allowWhileIdle e id = doseInstanceId (idempotência)', async () => {
    await scheduleAlarm({ doseInstanceId: 'inst-1', medicineName: 'Losartana', scheduledFor: FUTURE() })
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    const [notification, trigger] = mockedCreateTriggerNotification.mock.calls[0]
    expect(notification.id).toBe('inst-1')
    expect(trigger.type).toBe(TriggerType.TIMESTAMP)
    expect(trigger.alarmManager).toEqual({ allowWhileIdle: true })
    expect(notification.android.actions).toHaveLength(3) // Tomei + Soneca + Pular
    expect(notification.android.actions.map((a) => a.pressAction.id)).toEqual([
      'dose-taken',
      'dose-snooze',
      'dose-skip',
    ])
    expect(notification.android.fullScreenAction).toBeTruthy()
    // Loop do som + notif persistente (não some até dispensar)
    expect(notification.android.loopSound).toBe(true)
    expect(notification.android.ongoing).toBe(true)
  })

  it('NÃO agenda timestamp no passado', async () => {
    await scheduleAlarm({ doseInstanceId: 'inst-past', scheduledFor: new Date(Date.now() - 1000).toISOString() })
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })

  it('NÃO agenda scheduledFor inválido', async () => {
    await scheduleAlarm({ doseInstanceId: 'inst-bad', scheduledFor: 'not-a-date' })
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('cancelAlarm', () => {
  it('cancela o principal + os 3 nags', async () => {
    await cancelAlarm('inst-1')
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1')
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:nag:1')
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:nag:3')
  })
})

describe('cancelAll', () => {
  it('cancela só triggers do Notifee (preserva expo push)', async () => {
    await cancelAll()
    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledTimes(1)
    expect(notifee.cancelNotification).not.toHaveBeenCalled()
  })
})

describe('scheduleNag', () => {
  it('agenda próximo nag dentro da tolerância', async () => {
    await scheduleNag({
      doseInstanceId: 'inst-1',
      scheduledFor: new Date(Date.now() - 60 * 1000).toISOString(), // 1min atrás
      toleranceMinutes: 120,
      currentNagAttempt: 0,
    })
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    const [notification] = mockedCreateTriggerNotification.mock.calls[0]
    expect(notification.id).toBe('inst-1:nag:1')
    expect(notification.data.nagAttempt).toBe('1')
  })

  it('para após 3 tentativas', async () => {
    await scheduleNag({ doseInstanceId: 'inst-1', currentNagAttempt: 3 })
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })

  it('não insiste além da tolerância (D — dinâmico, não 120 fixo)', async () => {
    await scheduleNag({
      doseInstanceId: 'inst-1',
      scheduledFor: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30min atrás
      toleranceMinutes: 10, // janela curta já estourada
      currentNagAttempt: 0,
    })
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})
