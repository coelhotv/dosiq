import notifee, { AndroidVisibility } from '@notifee/react-native'
import { DOSE_ACTIVITY_STATES } from '@dosiq/core'
import { colors } from '@shared/styles/tokens'
import {
  showDoseActivity,
  showDoseDone,
  readSurfaceLabel,
  endDoseActivity,
  ensureSurfaceChannel,
  DOSE_ACTIVITY_CHANNEL_ID,
  LATE_CHRONO_CAP_MINUTES,
  DONE_CARD_TIMEOUT_MS,
  SURFACE_ACTION,
} from '../doseActivitySurfaceService'

afterEach(() => {
  jest.clearAllMocks()
})

const NOW = new Date('2026-03-05T12:00:00.000Z')

// DoseActivityState mínimo (saída de selectActiveDoseActivity / CON-029).
function activity(over = {}) {
  return {
    state: DOSE_ACTIVITY_STATES.UPCOMING,
    instanceId: 'inst-1',
    treatmentId: 'plan-1',
    scheduledFor: '2026-03-05T12:30:00.000Z',
    remainingSeconds: 1800, // +30min
    isCritical: false,
    isRegistered: false,
    medicineLabel: 'Lantus',
    ...over,
  }
}

const doseItem = {
  instanceId: 'inst-1',
  protocolId: 'proto-9',
  medicineId: 'med-7',
  dosagePerIntake: 10,
  intakeUnit: 'UI',
  dosageUnit: 'ui/ml',
  unitsPerMl: 100,
  toleranceMinutes: 120,
  scheduledTime: '17:00',
}

function lastDisplay() {
  return notifee.displayNotification.mock.calls.at(-1)[0]
}

describe('showDoseActivity — canal + estados', () => {
  it('upcoming: título nome+dose, corpo estado+horário, cronômetro regressivo, acento da cor', async () => {
    await showDoseActivity(activity(), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.id).toBe('inst-1:surface')
    expect(n.android.channelId).toBe(DOSE_ACTIVITY_CHANNEL_ID)
    expect(n.title).toContain('Lantus')
    expect(n.title).toContain('10 UI')
    expect(n.body).toBe('Dose crítica chegando · 17:00')
    expect(n.android.showChronometer).toBe(true)
    expect(n.android.chronometerDirection).toBe('down')
    expect(n.android.timestamp).toBe(NOW.getTime() + 1800 * 1000)
    expect(n.android.color).toBe(colors.primary[200])
    expect(n.android.ongoing).toBe(true)
    expect(n.android.smallIcon).toBe('ic_dosiq_mark')
  })

  it('later: cinza, SEM cronômetro, "Próxima dose crítica"', async () => {
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.LATER, remainingSeconds: 7200 }), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.android.showChronometer).toBeUndefined()
    expect(n.body).toBe('Próxima dose crítica · 17:00')
    expect(n.android.color).toBe(colors.neutral[400])
    expect(n.android.actions).toBeUndefined() // later não tem Registrar/Adiar (decisão PO)
  })

  it('upcoming/now/late TÊM ações Registrar/Adiar', async () => {
    for (const state of [DOSE_ACTIVITY_STATES.UPCOMING, DOSE_ACTIVITY_STATES.NOW, DOSE_ACTIVITY_STATES.LATE]) {
      await showDoseActivity(activity({ state, remainingSeconds: state === DOSE_ACTIVITY_STATES.LATE ? -600 : 600 }), {
        now: NOW,
        doseItem,
      })
      const n = lastDisplay()
      expect(n.android.actions.map((a) => a.pressAction.id)).toEqual([SURFACE_ACTION.REGISTER, SURFACE_ACTION.SNOOZE])
    }
  })

  it('now AINDA antes do horário (falta tempo): countdown regressivo continua, teal', async () => {
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.NOW, remainingSeconds: 300 }), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.android.showChronometer).toBe(true)
    expect(n.android.chronometerDirection).toBe('down')
    expect(n.android.timestamp).toBe(NOW.getTime() + 300 * 1000)
    expect(n.body).toBe('Dose crítica agora · 17:00')
    expect(n.android.color).toBe(colors.primary[500])
  })

  it('now JÁ passou do horário (0..+5min): SEM cronômetro, estático "agora"', async () => {
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.NOW, remainingSeconds: -120 }), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.android.showChronometer).toBeUndefined()
    expect(n.body).toBe('Dose crítica agora · 17:00')
    expect(n.android.color).toBe(colors.primary[500])
  })

  it('late dentro do cap: cronômetro progressivo (count-up)', async () => {
    const r = -30 * 60 // 30min atrasada (≤ cap)
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.LATE, remainingSeconds: r }), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.android.showChronometer).toBe(true)
    expect(n.android.chronometerDirection).toBe('up')
    expect(n.android.color).toBe(colors.status.warning)
  })

  it('late ALÉM do cap (semanal/GLP-1): sem cronômetro + corpo estático com daysAgoLabel (CL-3/T021a)', async () => {
    const r = -(LATE_CHRONO_CAP_MINUTES + 60) * 60 // > cap
    await showDoseActivity(
      activity({ state: DOSE_ACTIVITY_STATES.LATE, remainingSeconds: r, scheduledFor: '2026-03-04T12:00:00.000Z' }),
      { now: NOW, doseItem }
    )
    const n = lastDisplay()
    expect(n.android.showChronometer).toBeUndefined()
    expect(n.body).toContain('Dose crítica pendente')
    expect(n.body).toMatch(/ontem|há \d+ dias/)
  })

  it('done: encerra superfície (cancelNotification), não exibe ongoing', async () => {
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.DONE }), { now: NOW, doseItem })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
  })

  it('missed: encerra superfície, não exibe', async () => {
    await showDoseActivity(activity({ state: DOSE_ACTIVITY_STATES.MISSED }), { now: NOW, doseItem })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1:surface')
  })
})

describe('showDoseDone — card de confirmação (spec.md:366)', () => {
  it('card verde não-ongoing, auto-dismiss (timeoutAfter), corpo "Tomada às HH:mm ✓"', async () => {
    await showDoseDone({ instanceId: 'inst-1', medicineLabel: 'Lantus', takenAt: NOW, doseItem })
    const n = lastDisplay()
    expect(n.id).toBe('inst-1:surface')
    expect(n.android.color).toBe(colors.status.successDark)
    expect(n.android.ongoing).toBe(false)
    expect(n.android.autoCancel).toBe(true)
    expect(n.android.timeoutAfter).toBe(DONE_CARD_TIMEOUT_MS)
    expect(n.body).toMatch(/^Tomada às \d{2}:\d{2} ✓$/)
    expect(n.title).toContain('Lantus')
    expect(n.android.actions).toBeUndefined()
  })

  it('sem instanceId → no-op', async () => {
    await showDoseDone({ medicineLabel: 'Lantus' })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
  })

  it('takenAt ausente/inválido → corpo fallback "Dose tomada ✓"', async () => {
    await showDoseDone({ instanceId: 'inst-1', medicineLabel: 'Lantus', takenAt: 'lixo' })
    const n = lastDisplay()
    expect(n.body).toBe('Dose tomada ✓')
  })
})

describe('showDoseActivity — modo discreto (PO-SEC-1) + payload', () => {
  it('discreet=true: título com nome real; privacidade via visibility PRIVATE (SO redige na lock)', async () => {
    await showDoseActivity(activity(), { now: NOW, discreet: true, doseItem })
    const n = lastDisplay()
    expect(n.title).toContain('Lantus')
    expect(n.android.visibility).toBe(AndroidVisibility.PRIVATE)
  })

  it('discreet=false: nome + visibility PUBLIC', async () => {
    await showDoseActivity(activity(), { now: NOW, discreet: false, doseItem })
    const n = lastDisplay()
    expect(n.title).toContain('Lantus')
    expect(n.android.visibility).toBe(AndroidVisibility.PUBLIC)
  })

  it('embute payload de registro (CON-026) + ações Registrar/Adiar', async () => {
    await showDoseActivity(activity(), { now: NOW, doseItem })
    const n = lastDisplay()
    expect(n.data.protocolId).toBe('proto-9')
    expect(n.data.medicineId).toBe('med-7')
    expect(n.data.quantityTaken).toBe('10')
    expect(n.data.doseInstanceId).toBe('inst-1')
    expect(n.data.__surface).toBe('true')
    expect(n.android.actions.map((a) => a.pressAction.id)).toEqual([SURFACE_ACTION.REGISTER, SURFACE_ACTION.SNOOZE])
    // Registrar ABRE o app na modal bulk (launchActivity) — sítio do injetável só lá. Adiar segue
    // silencioso (sem launch). O press do CORPO continua sem launch (AP-207).
    const [register, snooze] = n.android.actions
    expect(register.pressAction.launchActivity).toBe('default')
    expect(snooze.pressAction.launchActivity).toBeUndefined()
    expect(n.data.scheduledTime).toBe('17:00')
  })
})

describe('readSurfaceLabel — auto-gate do card done', () => {
  it('superfície 039 ativa (__surface) → retorna medicineName', async () => {
    notifee.getDisplayedNotifications.mockResolvedValueOnce([
      { id: 'inst-1:surface', notification: { id: 'inst-1:surface', data: { __surface: 'true', medicineName: 'Lantus' } } },
    ])
    expect(await readSurfaceLabel('inst-1')).toBe('Lantus')
  })

  it('nenhuma notif com o id → null', async () => {
    notifee.getDisplayedNotifications.mockResolvedValueOnce([])
    expect(await readSurfaceLabel('inst-1')).toBeNull()
  })

  it('notif do alarme (sem __surface) → null (não confunde com a superfície)', async () => {
    notifee.getDisplayedNotifications.mockResolvedValueOnce([
      { id: 'inst-1:surface', notification: { id: 'inst-1:surface', data: { medicineName: 'Lantus' } } },
    ])
    expect(await readSurfaceLabel('inst-1')).toBeNull()
  })

  it('sem id → null', async () => {
    expect(await readSurfaceLabel(null)).toBeNull()
  })
})

describe('failure modes', () => {
  it('activity null → no-op (sem display, sem cancel)', async () => {
    await showDoseActivity(null, { now: NOW })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
    expect(notifee.cancelNotification).not.toHaveBeenCalled()
  })

  it('activity sem instanceId → no-op', async () => {
    await showDoseActivity(activity({ instanceId: null }), { now: NOW })
    expect(notifee.displayNotification).not.toHaveBeenCalled()
  })

  it('doseItem ausente → quantity default 1, payload não quebra', async () => {
    await showDoseActivity(activity(), { now: NOW })
    const n = lastDisplay()
    expect(n.data.quantityTaken).toBe('1')
    expect(n.data.protocolId).toBe('')
  })

  it('endDoseActivity sem id → no-op', async () => {
    await endDoseActivity(null)
    expect(notifee.cancelNotification).not.toHaveBeenCalled()
  })

  it('endDoseActivity cancela pelo id', async () => {
    await endDoseActivity('inst-9')
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-9:surface')
  })

  it('ensureSurfaceChannel cria canal DEFAULT silencioso (idempotente)', async () => {
    // `channelEnsured` é singleton de módulo (ensure-once no app real); isolar p/ não depender
    // de ordem (outros testes já podem ter garantido o canal).
    jest.resetModules()
    const svc = require('../doseActivitySurfaceService')
    const freshNotifee = require('@notifee/react-native').default
    freshNotifee.createChannel.mockClear()
    await svc.ensureSurfaceChannel()
    await svc.ensureSurfaceChannel()
    expect(freshNotifee.createChannel).toHaveBeenCalledTimes(1)
    expect(freshNotifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: DOSE_ACTIVITY_CHANNEL_ID, sound: undefined })
    )
  })
})
