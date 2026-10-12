import notifee from '@notifee/react-native'
import { deriveDoseActivityState } from '@dosiq/core'
import {
  armDoseActivity,
  advanceDoseActivity,
  reconcileDoseActivityFromAlarm,
  finishDoseActivity,
} from '../doseActivityScheduler'

// Spec 084: o emissor é fronteira (fila + sessão). Aqui só importa O QUE o scheduler pede para emitir.
const mockEnqueueSurface = jest.fn().mockResolvedValue(undefined)
const mockEmitDelivered = jest.fn().mockResolvedValue(undefined)
jest.mock('@platform/audit/surfaceAuditBeacon', () => ({
  enqueueSurfaceTransition: (...a) => mockEnqueueSurface(...a),
  emitDeliveredTransition: (...a) => mockEmitDelivered(...a),
}))

// Superfície por notificação é Android-only (spec 101 C-27); casos que testam iOS trocam dentro do teste.
const RNPlatform = require('react-native').Platform
const ORIGINAL_OS = RNPlatform.OS
beforeEach(() => { RNPlatform.OS = 'android' })
afterAll(() => { RNPlatform.OS = ORIGINAL_OS })

afterEach(() => jest.clearAllMocks())

const NOW = new Date('2026-03-05T12:00:00.000Z')
const M = 60000
const iso = (offMin) => new Date(NOW.getTime() + offMin * M).toISOString()

// DoseItem mínimo crítico (saída buildDoseItemsFromInstances).
const doseItem = (over = {}) => ({
  instanceId: 'inst-1',
  scheduledFor: iso(30), // +30min → upcoming
  status: 'pending',
  critical: true,
  toleranceMinutes: null,
  treatmentPlanId: 'plan-1',
  protocolId: 'proto-9',
  medicineId: 'med-7',
  medicineName: 'Lantus',
  dosagePerIntake: 10,
  intakeUnit: 'UI',
  dosageUnit: 'ui/ml',
  unitsPerMl: 100,
  scheduledTime: '17:00',
  ...over,
})

const mockedCreateTriggerNotification = notifee.createTriggerNotification as jest.Mock

function lastTrigger() {
  return mockedCreateTriggerNotification.mock.calls.at(-1)
}

describe('armDoseActivity — exibe atual + agenda próximo boundary', () => {
  it('exibe o estado atual e agenda o PRÓXIMO boundary como trigger (allowWhileIdle)', async () => {
    const di = doseItem()
    const act = deriveDoseActivityState(di, NOW) // upcoming (+30min)
    await armDoseActivity(act, di, { now: NOW, discreet: true })

    // estado atual exibido já
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1)
    // próximo boundary = upcoming→now em T−10min = NOW+20min
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 20 * M)
    expect(trigger.alarmManager).toEqual({ allowWhileIdle: true })
    expect(payload.id).toBe('inst-1:surface')
    expect(payload.data.__surface).toBe('true')
  })

  it('done → encerra superfície (cancel notif + trigger), sem exibir/agendar', async () => {
    const di = doseItem()
    const act = deriveDoseActivityState(doseItem({ status: 'taken', isRegistered: true }), NOW)
    await armDoseActivity(act, di, { now: NOW })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:surface')
  })

  it('activity null / sem doseItem → no-op', async () => {
    await armDoseActivity(null, doseItem(), { now: NOW })
    await armDoseActivity(deriveDoseActivityState(doseItem(), NOW), null, { now: NOW })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('advanceDoseActivity — encadeia o próximo boundary (headless, self-contained)', () => {
  it('reconstrói do data e agenda o próximo boundary', async () => {
    const data = {
      __surface: 'true',
      doseInstanceId: 'inst-1',
      scheduledFor: iso(5), // +5min
      toleranceMinutes: '',
      isCritical: 'true',
      treatmentId: 'plan-1',
      protocolId: 'proto-9',
      medicineId: 'med-7',
      medicineName: 'Lantus',
      quantityTaken: '10',
      intakeUnit: 'UI',
      dosageUnit: 'ui/ml',
      dosagePerPill: '',
      unitsPerMl: '100',
      scheduledTime: '17:00',
      discreet: 'true',
    }
    await advanceDoseActivity(data, NOW)
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    const [, trigger] = lastTrigger()
    // boundaries de T=NOW+5: T−10/T−60/T−240 (passado); próximo > NOW = T0 (horário) = NOW+5min
    // (re-exibe "agora" estático p/ parar o countdown; coexiste com o alarme via id próprio).
    expect(trigger.timestamp).toBe(NOW.getTime() + 5 * M)
  })

  it('data sem __surface → no-op', async () => {
    await advanceDoseActivity({ doseInstanceId: 'x' }, NOW)
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('reconcileDoseActivityFromAlarm — marca-passo do alarme mantém a cadeia', () => {
  // data de alarme single crítico (buildSingleAlarmData + merge do scheduleAlarm, tudo string)
  const alarmData = (over = {}) => ({
    doseInstanceId: 'inst-1',
    scheduledFor: iso(5), // +5min → now (janela ±10)
    toleranceMinutes: '120',
    isCritical: 'true',
    medicineName: 'Lantus',
    quantityTaken: '10',
    intakeUnit: 'UI',
    dosageUnit: 'ui/ml',
    unitsPerMl: '100',
    scheduledTime: '17:00',
    protocolId: 'proto-9',
    medicineId: 'med-7',
    ...over,
  })

  it('alarme crítico entregue → re-exibe estado atual + re-agenda próximo boundary (re-arm)', async () => {
    await reconcileDoseActivityFromAlarm(alarmData(), NOW)
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1) // estado atual (now)
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1) // próximo = now→late
    const [payload, trigger] = lastTrigger()
    expect(payload.id).toBe('inst-1:surface')
    // scheduledFor=+5; boundaries futuros > NOW: T0(+5)? não, +5 == agora-relativo... próximo > NOW = T0+?
    expect(trigger.timestamp).toBeGreaterThan(NOW.getTime())
  })

  it('alarme agrupado → no-op (superfície é por-dose)', async () => {
    await reconcileDoseActivityFromAlarm(alarmData({ isGrouped: 'true' }), NOW)
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })

  it('alarme não-crítico → no-op (superfície só p/ crítica)', async () => {
    await reconcileDoseActivityFromAlarm(alarmData({ isCritical: 'false' }), NOW)
    expect(notifee.displayNotification).not.toHaveBeenCalled()
  })

  it('boundary terminal (missed) → agenda trigger de encerramento (__surfaceEnd)', async () => {
    // scheduledFor bem no passado além da tolerância → próximo boundary é missed/terminal
    const data = {
      __surface: 'true',
      doseInstanceId: 'inst-1',
      scheduledFor: iso(-200), // -200min, tol default 120 → já missed
      toleranceMinutes: '',
      isCritical: 'true',
      scheduledTime: '17:00',
      discreet: 'false',
    }
    await advanceDoseActivity(data, NOW)
    // não há boundary futuro (tudo no passado) → nenhum agendamento
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// Spec 101 — soneca: superfície some até `snoozedUntil` e reaparece em `now`.
// ─────────────────────────────────────────────
describe('soneca na superfície (spec 101)', () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS
  beforeEach(() => {
    Platform.OS = 'android'
  })
  afterEach(() => {
    Platform.OS = originalOS
  })
  const { deferDoseActivity } = require('../doseActivityScheduler')
  const snoozeData = (over = {}) => ({
    doseInstanceId: 'inst-1',
    scheduledFor: iso(-35), // dose de 35 min atrás (relógio original diria late)
    toleranceMinutes: '120',
    isCritical: 'true',
    medicineName: 'Lantus',
    scheduledTime: '17:00',
    snoozedUntil: String(NOW.getTime() + 5 * M),
    ...over,
  })

  it('🔴 PO-101-1: defer ⇒ encerra card + trigger e arma 1 trigger em snoozedUntil com payload now', async () => {
    await deferDoseActivity(snoozeData(), NOW.getTime())
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:surface')
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 5 * M)
    expect(payload.data.state).toBe('now')
    expect(payload.data.__surfaceEnd).toBeUndefined()
    expect(payload.data.snoozedUntil).toBe(String(NOW.getTime() + 5 * M)) // advance segue ancorado
  })

  it('R1: soneca antecipada (t0+5) não agenda END nos boundaries antes da âncora', async () => {
    await deferDoseActivity(snoozeData({ scheduledFor: iso(42), snoozedUntil: String(NOW.getTime() + 47 * M) }), NOW.getTime())
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 47 * M)
    expect(payload.data.state).toBe('now')
  })

  it('defer fora do Android / não-crítica / sem âncora → no-op', async () => {
    Platform.OS = 'ios'
    await deferDoseActivity(snoozeData(), NOW.getTime())
    Platform.OS = 'android'
    await deferDoseActivity(snoozeData({ isCritical: 'false' }), NOW.getTime())
    await deferDoseActivity(snoozeData({ snoozedUntil: '' }), NOW.getTime())
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).not.toHaveBeenCalled()
  })

  it('🔴 PO-101-1/AC-1.4: alarme de soneca entregue em snoozedUntil ⇒ reaparece em now (não late)', async () => {
    const at = new Date(NOW.getTime() + 5 * M)
    await reconcileDoseActivityFromAlarm(snoozeData(), at)
    const shown = (notifee.displayNotification as jest.Mock).mock.calls.at(-1)[0]
    expect(shown.data.state).toBe('now')
    expect(shown.body).toContain('Dose crítica agora')
    // próximo boundary = âncora+10 → relógio original (late)
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(at.getTime() + 10 * M)
    expect(payload.data.state).toBe('late')
  })

  it('advance com snoozedUntil em ISO (vindo do banco) também ancora', async () => {
    const data = { ...snoozeData({ snoozedUntil: new Date(NOW.getTime() + 5 * M).toISOString() }), __surface: 'true' }
    await advanceDoseActivity(data, NOW)
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 5 * M)
    expect(payload.data.state).toBe('now')
  })
})

describe('C-27 — superfície por notificação não roda no iOS', () => {
  it('🔴 reconcile do alarme entregue (iOS) ⇒ nada exibido nem agendado', async () => {
    RNPlatform.OS = 'ios'
    const notifee = require('@notifee/react-native').default
    const { reconcileDoseActivityFromAlarm } = require('../doseActivityScheduler')
    await reconcileDoseActivityFromAlarm({
      doseInstanceId: 'inst-1', isCritical: 'true', medicineName: 'Glatus',
      scheduledFor: new Date(Date.now() - 60000).toISOString(),
    })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('spec 084 — F-A: o card agendado mostra o estado NOVO do boundary', () => {
  it('upcoming→now em T−10: payload now, com a transição no data', async () => {
    const di = doseItem() // +30 → upcoming
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 20 * M)
    expect(payload.data.state).toBe('now')
    expect(payload.data.transitionFrom).toBe('upcoming')
    expect(payload.data.transitionTo).toBe('now')
  })

  it('T0 re-exibe now: transitionTo vazio (não emite na entrega)', async () => {
    const di = doseItem({ scheduledFor: iso(5) }) // now; próximo = T0
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 5 * M)
    expect(payload.data.state).toBe('now')
    expect(payload.data.transitionTo).toBe('')
  })

  it('tol default (120): o boundary do cutoff ENCERRA (antes reexibia late para sempre)', async () => {
    const di = doseItem({ scheduledFor: iso(-60) }) // late; próximo = T+120 (cutoff = cap)
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    const [payload, trigger] = lastTrigger()
    expect(trigger.timestamp).toBe(NOW.getTime() + 60 * M)
    expect(payload.data.__surfaceEnd).toBe('true')
    expect(payload.data.transitionFrom).toBe('late')
    expect(payload.data.transitionTo).toBe('missed')
  })
})

describe('spec 084 — arm emite só quando o estado exibido muda (INV-2)', () => {
  const displayed = (state) =>
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue(
      state ? [{ id: 'inst-1:surface', notification: { id: 'inst-1:surface', data: { __surface: 'true', state } } }] : []
    )
  afterEach(() => displayed(null))

  it('1ª aparição (nada exibido) ⇒ 1 emissão source=app, from=null', async () => {
    const di = doseItem()
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(mockEnqueueSurface).toHaveBeenCalledTimes(1)
    expect(mockEnqueueSurface.mock.calls[0][0]).toEqual(
      expect.objectContaining({ instanceId: 'inst-1', from: null, to: 'upcoming', source: 'app', occurredAt: NOW.toISOString() })
    )
  })

  it('re-exibição N× do mesmo estado (resync) ⇒ zero emissão', async () => {
    displayed('upcoming')
    const di = doseItem()
    for (let i = 0; i < 4; i++) await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(mockEnqueueSurface).not.toHaveBeenCalled()
    expect(notifee.displayNotification).toHaveBeenCalledTimes(4) // a re-exibição continua acontecendo
  })

  it('exibido later, derive upcoming ⇒ emite from=later', async () => {
    displayed('later')
    const di = doseItem()
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(mockEnqueueSurface.mock.calls[0][0]).toEqual(expect.objectContaining({ from: 'later', to: 'upcoming' }))
  })

  it('reconcile pelo alarme ⇒ source=alarm', async () => {
    const data = {
      doseInstanceId: 'inst-1', isCritical: 'true', scheduledFor: iso(0), toleranceMinutes: '', medicineName: 'Lantus',
    }
    await reconcileDoseActivityFromAlarm(data, NOW)
    expect(mockEnqueueSurface.mock.calls[0][0]).toEqual(expect.objectContaining({ to: 'now', source: 'alarm' }))
  })

  it('getDisplayedNotifications lança ⇒ emite (duplicata > perda, spec A3)', async () => {
    ;(notifee.getDisplayedNotifications as jest.Mock).mockRejectedValueOnce(new Error('x'))
    const di = doseItem()
    await armDoseActivity(deriveDoseActivityState(di, NOW), di, { now: NOW })
    expect(mockEnqueueSurface).toHaveBeenCalledTimes(1)
  })

  it('missed com card exibido ⇒ emite missed; sem card ⇒ não (evita repetir a cada resync)', async () => {
    const di = doseItem({ scheduledFor: iso(-200) })
    const act = deriveDoseActivityState(di, NOW)
    await armDoseActivity(act, di, { now: NOW })
    expect(mockEnqueueSurface).not.toHaveBeenCalled()
    displayed('late')
    await armDoseActivity(act, di, { now: NOW })
    expect(mockEnqueueSurface.mock.calls[0][0]).toEqual(expect.objectContaining({ from: 'late', to: 'missed', source: 'app' }))
  })
})

describe('spec 084 — entrega do boundary: encadeia PRIMEIRO, emite depois (INV-1)', () => {
  const data = (over = {}) => ({
    __surface: 'true', doseInstanceId: 'inst-1', scheduledFor: iso(30), toleranceMinutes: '', isCritical: 'true',
    medicineName: 'Lantus', state: 'later', transitionFrom: '', transitionTo: 'later', ...over,
  })

  it('advance agenda o próximo boundary e emite com o data entregue', async () => {
    await advanceDoseActivity(data(), NOW)
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    expect(mockEmitDelivered).toHaveBeenCalledWith(expect.objectContaining({ transitionTo: 'later' }), NOW.toISOString())
    const order = [
      (notifee.createTriggerNotification as jest.Mock).mock.invocationCallOrder[0],
      mockEmitDelivered.mock.invocationCallOrder[0],
    ]
    expect(order[0]).toBeLessThan(order[1])
  })

  it('🔴 guard PO-1: emissão que lança não quebra o advance e o próximo boundary fica agendado', async () => {
    mockEmitDelivered.mockRejectedValueOnce(new Error('boom'))
    await expect(advanceDoseActivity(data(), NOW)).resolves.toBeUndefined()
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
  })

  it('finishDoseActivity (END do missed) encerra a superfície e emite', async () => {
    const end = { __surfaceEnd: 'true', doseInstanceId: 'inst-1', transitionFrom: 'late', transitionTo: 'missed' }
    await finishDoseActivity(end, NOW)
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
    expect(mockEmitDelivered).toHaveBeenCalledWith(end, NOW.toISOString())
  })

  it('finishDoseActivity com emissão que lança ainda encerra', async () => {
    mockEmitDelivered.mockRejectedValueOnce(new Error('boom'))
    await expect(finishDoseActivity({ __surfaceEnd: 'true', doseInstanceId: 'inst-1' }, NOW)).resolves.toBeUndefined()
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('inst-1:surface')
  })
})
