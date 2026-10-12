// Spec 084 (PO-1): o handler headless roteia a entrega do boundary para o scheduler, que encadeia e
// depois emite. Prova o roteamento (surface → advance, END → finish, alarme → reconcile + beacon) e
// que uma falha no caminho não derruba o handler.

const mockAdvance = jest.fn().mockResolvedValue(undefined)
const mockFinish = jest.fn().mockResolvedValue(undefined)
const mockReconcile = jest.fn().mockResolvedValue(undefined)
jest.mock('../../doseActivity/doseActivityScheduler', () => ({
  advanceDoseActivity: (...a) => mockAdvance(...a),
  finishDoseActivity: (...a) => mockFinish(...a),
  reconcileDoseActivityFromAlarm: (...a) => mockReconcile(...a),
}))
const mockBeacon = jest.fn().mockResolvedValue(undefined)
jest.mock('../../audit/criticalAuditBeacon', () => ({ beaconAlarmDelivered: (...a) => mockBeacon(...a) }))
jest.mock('../../../features/_dev/devDoseActivityBgSpike', () => ({ onSpikeDelivered: jest.fn() }))

import notifee, { EventType } from '@notifee/react-native'
import { registerAlarmBackgroundHandler } from '../registerAlarmBackgroundHandler'

let handler
beforeAll(() => {
  registerAlarmBackgroundHandler()
  handler = (notifee.onBackgroundEvent as jest.Mock).mock.calls[0][0]
})
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

const delivered = (data) => handler({ type: EventType.DELIVERED, detail: { notification: { data } } })

describe('registerAlarmBackgroundHandler — DELIVERED (spec 084)', () => {
  it('boundary da superfície → advanceDoseActivity (que encadeia e emite)', async () => {
    const data = { __surface: 'true', doseInstanceId: 'i1', transitionTo: 'upcoming' }
    await delivered(data)
    expect(mockAdvance).toHaveBeenCalledWith(data)
    expect(mockFinish).not.toHaveBeenCalled()
  })

  it('END do missed → finishDoseActivity (encerra + rastro)', async () => {
    const data = { __surfaceEnd: 'true', doseInstanceId: 'i1', transitionTo: 'missed' }
    await delivered(data)
    expect(mockFinish).toHaveBeenCalledWith(data)
  })

  it('alarme entregue → reconcile + beacon de alarme (fila própria deles)', async () => {
    const data = { doseInstanceId: 'i1', isCritical: 'true' }
    await delivered(data)
    expect(mockReconcile).toHaveBeenCalledWith(data)
    expect(mockBeacon).toHaveBeenCalledWith(data)
  })

  it('falha no scheduler não propaga para o SO (handler fail-open)', async () => {
    mockAdvance.mockRejectedValueOnce(new Error('boom'))
    await expect(delivered({ __surface: 'true', doseInstanceId: 'i1' })).resolves.toBeUndefined()
  })
})
