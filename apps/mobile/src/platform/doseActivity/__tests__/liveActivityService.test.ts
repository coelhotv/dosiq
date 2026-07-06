// liveActivityService — mapeamento DoseActivityState→params nativos (F3 iOS). Guard de plataforma.

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: {
    DoseActivityBridge: {
      start: jest.fn().mockResolvedValue('act-id'),
      update: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      done: jest.fn().mockResolvedValue(undefined),
    drainPendingActions: jest.fn().mockResolvedValue([{ action: 'snooze', instanceId: 'i1' }]),
    },
  },
}))

import { NativeModules } from 'react-native'
import { DOSE_ACTIVITY_STATES } from '@dosiq/core'
import {
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  showDoneLiveActivity,
  drainPendingActions,
} from '../liveActivityService'

const native = NativeModules.DoseActivityBridge
afterEach(() => jest.clearAllMocks())

const activity = { instanceId: 'inst-1', state: DOSE_ACTIVITY_STATES.NOW, groupSize: 2, isCritical: true }
const doseItem = {
  scheduledFor: '2026-03-05T12:00:00.000Z',
  medicineName: 'Lantus',
  treatmentPlanId: 'plan-1',
  scheduledTime: '09:00',
  dosagePerIntake: 10,
  intakeUnit: 'ui',
}

describe('liveActivityService — params', () => {
  it('start mapeia estado/alvo/grupo/treatment + nome e dose SEPARADOS + HH:mm + discreet', async () => {
    const id = await startLiveActivity(activity, doseItem)
    expect(id).toBe('act-id')
    const p = native.start.mock.calls[0][0]
    expect(p.instanceId).toBe('inst-1')
    expect(p.state).toBe('now')
    expect(p.treatmentId).toBe('plan-1')
    expect(p.groupSize).toBe(2)
    expect(p.scheduledAtMs).toBe(new Date('2026-03-05T12:00:00.000Z').getTime())
    expect(p.medicineName).toBe('Lantus') // nome separado (mock: nome + subtítulo de dose)
    expect(p.doseLabel.length).toBeGreaterThan(0) // dose formatada (R-272 / formatDoseItem)
    expect(p.scheduledTime).toBe('09:00')
    expect(p.discreet).toBe(false) // default = mostra nome (decisão PO 2026-06-29; toggle LGPD = backlog)
  })

  it('showDone chama native.done com doneAtLabel HH:mm', async () => {
    await showDoneLiveActivity({ instanceId: 'inst-1', takenAt: new Date('2026-03-05T19:02:00.000Z') })
    expect(native.done).toHaveBeenCalledTimes(1)
    const p = native.done.mock.calls[0][0]
    expect(p.state).toBe('done')
    expect(p.doneAtLabel).toMatch(/^\d{2}:\d{2}$/)
  })

  it('update usa o mesmo mapeamento', async () => {
    await updateLiveActivity(activity, doseItem)
    expect(native.update).toHaveBeenCalledTimes(1)
    expect(native.update.mock.calls[0][0].state).toBe('now')
  })

  it('end encerra; activity sem instanceId → no-op no start', async () => {
    await endLiveActivity()
    expect(native.end).toHaveBeenCalledTimes(1)
    await startLiveActivity({ state: 'now' }, doseItem)
    expect(native.start).not.toHaveBeenCalled()
  })

  it('drainPendingActions retorna a fila', async () => {
    const q = await drainPendingActions()
    expect(q).toEqual([{ action: 'snooze', instanceId: 'i1' }])
  })
})
