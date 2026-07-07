import AsyncStorage from '@react-native-async-storage/async-storage'
import notifee from '@notifee/react-native'

type LogData = Record<string, unknown>
type RegisterDoseOpts = { instanceId?: string | null }

const mockRegisterDose = jest.fn((_logData: LogData, _opts?: RegisterDoseOpts) =>
  Promise.resolve({ success: true, data: { id: 'log-1' } }),
)
jest.mock('@dose/services/doseService', () => ({
  registerDose: (logData: LogData, opts?: RegisterDoseOpts) => mockRegisterDose(logData, opts),
}))

const mockEq = jest.fn(() => Promise.resolve({ error: null }))
const mockUpdate = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn((_table?: string) => ({ update: mockUpdate }))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { from: (table?: string) => mockFrom(table) },
}))

const mockNavigate = jest.fn()
jest.mock('@navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    navigate: (screen?: unknown, params?: unknown) => mockNavigate(screen, params),
  },
}))
jest.mock('@navigation/routes', () => ({ ROUTES: { TODAY: 'Hoje' } }))

import { handleAlarmAction, registerTaken, registerSkip } from '../quickDoseRegistration'
import { SURFACE_ACTION } from '@platform/doseActivity/doseActivitySurfaceService'

function evt(pressActionId: string | undefined, data: Record<string, unknown>) {
  return { detail: { pressAction: { id: pressActionId }, notification: { data } } }
}

const BASE = {
  doseInstanceId: 'inst-1',
  protocolId: 'proto-1',
  medicineId: 'med-1',
  quantityTaken: '2',
  medicineName: 'Losartana',
  toleranceMinutes: '120',
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('handleAlarmAction — Tomei', () => {
  it('registra pela via canônica registerDose com instanceId, SEM update cru de status', async () => {
    const res = await handleAlarmAction(evt('dose-taken', BASE))
    expect(mockRegisterDose).toHaveBeenCalledTimes(1)
    const [logData, opts] = mockRegisterDose.mock.calls[0]
    expect(opts).toEqual({ instanceId: 'inst-1' })
    expect(logData.medicine_id).toBe('med-1')
    expect(logData.protocol_id).toBe('proto-1')
    expect(logData.quantity_taken).toBe(2)
    expect(typeof logData.taken_at).toBe('string')
    // NUNCA update cru de dose_instances no caminho "Tomei"
    expect(mockFrom).not.toHaveBeenCalled()
    expect(res).toEqual({ handled: true, action: 'dose-taken' })
  })

  it('invalida snapshots REAIS (today/stock/treatments), não chaves fantasmas', async () => {
    await handleAlarmAction(evt('dose-taken', BASE))
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@dosiq/today-snapshot',
      '@dosiq/stock-snapshot',
      '@dosiq/treatments-snapshot',
    ])
  })
})

describe('handleAlarmAction — Pular', () => {
  it('seta status=skipped_user sem log nem registerDose', async () => {
    const res = await handleAlarmAction(evt('dose-skip', BASE))
    expect(mockRegisterDose).not.toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith('dose_instances')
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'skipped_user' })
    expect(mockEq).toHaveBeenCalledWith('id', 'inst-1')
    expect((res as { action: string }).action).toBe('dose-skip')
  })

  it('invalida today + treatments (sem stock, não consome)', async () => {
    await handleAlarmAction(evt('dose-skip', BASE))
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@dosiq/today-snapshot',
      '@dosiq/treatments-snapshot',
    ])
  })
})

describe('handleAlarmAction — ignorado', () => {
  it('agenda nag reativo', async () => {
    const res = await handleAlarmAction(evt(undefined, { ...BASE, nagAttempt: '0', scheduledFor: new Date(Date.now() - 1000).toISOString() }))
    expect(notifee.createTriggerNotification).toHaveBeenCalled()
    expect((res as { action: string }).action).toBe('nag')
  })

  it('sem doseInstanceId → não trata', async () => {
    const res = await handleAlarmAction(evt('dose-taken', {}))
    expect(res).toEqual({ handled: false })
    expect(mockRegisterDose).not.toHaveBeenCalled()
  })
})

describe('handleAlarmAction — Soneca', () => {
  it('re-agenda a mesma dose (snooze) e retorna action dose-snooze', async () => {
    const res = await handleAlarmAction(evt('dose-snooze', { ...BASE, snoozeAttempt: '0' }))
    expect(notifee.createTriggerNotification).toHaveBeenCalled()
    expect(mockRegisterDose).not.toHaveBeenCalled()
    expect((res as { action: string }).action).toBe('dose-snooze')
  })

  it('estourou o teto (3) → não re-agenda', async () => {
    await handleAlarmAction(evt('dose-snooze', { ...BASE, snoozeAttempt: '3' }))
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('handleAlarmAction — superfície 039 "Registrar" abre modal bulk', () => {
  it('plano (treatmentId) → navega bulk-plan, NÃO registra silencioso', async () => {
    const data = { ...BASE, treatmentId: 'plan-9', scheduledTime: '17:00', treatmentPlanName: 'Insulina' }
    const res = await handleAlarmAction(evt(SURFACE_ACTION.REGISTER, data))
    expect(res).toEqual({ handled: true, action: 'surface-open-register' })
    expect(mockNavigate).toHaveBeenCalledWith('Hoje', {
      screen: 'bulk-plan',
      planId: 'plan-9',
      at: '17:00',
      treatmentPlanName: 'Insulina',
    })
    expect(mockRegisterDose).not.toHaveBeenCalled()
  })

  it('avulsa (sem treatmentId) → navega dose-individual', async () => {
    const data = { doseInstanceId: 'inst-1', protocolId: 'proto-1', scheduledTime: '08:00' }
    await handleAlarmAction(evt(SURFACE_ACTION.REGISTER, data))
    expect(mockNavigate).toHaveBeenCalledWith('Hoje', { screen: 'dose-individual', protocolId: 'proto-1', at: '08:00' })
    expect(mockRegisterDose).not.toHaveBeenCalled()
  })
})

describe('cancela o alarme ANTES de registrar (silencia já)', () => {
  it('Tomei: cancelNotification (notif exibida / loop) é chamado', async () => {
    await registerTaken(BASE)
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1')
    expect(mockRegisterDose).toHaveBeenCalledTimes(1)
  })

  it('__dev: cancela mas NÃO toca o DB (registerDose/from não chamados)', async () => {
    const res = await registerTaken({ ...BASE, __dev: 'true' })
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1')
    expect(mockRegisterDose).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true, dev: true })
  })

  it('Pular __dev: cancela sem update cru de dose_instances', async () => {
    const res = await registerSkip({ doseInstanceId: 'inst-1', __dev: 'true' })
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true, dev: true })
  })
})
