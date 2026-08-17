import AsyncStorage from '@react-native-async-storage/async-storage'
import notifee from '@notifee/react-native'

interface LogData {
  protocol_id?: string | null
  medicine_id?: string
  taken_at?: string
  quantity_taken?: number
}
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

// 067 A2: a trilha/aviso da anomalia é efeito colateral fail-open — mockada p/ asserir que foi
// chamada sem arrastar notifee/expo-device/supabase reais para dentro deste teste.
const mockReportOutOfWindow = jest.fn((..._a: any[]) => Promise.resolve({ tracked: true, notified: true }))
jest.mock('../outOfWindowNotice', () => ({
  reportOutOfWindowAlarm: (...a: any[]) => mockReportOutOfWindow(...a),
}))

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

  // FR-006 pelo caminho PASSIVO (RC6 #796): o cutoff do nag é `scheduledFor + tolerance`, e num
  // disparo ADIANTADO `now` está MUITO antes dele — sem esta guarda o alarme torto se reagendava
  // em loop até a hora real da dose. As guardas de ação/takeover barram a escrita, não o incômodo.
  it('disparo ADIANTADO ignorado → NÃO reagenda nag (senão incomoda em loop até a hora da dose)', async () => {
    const res = await handleAlarmAction(
      evt(undefined, {
        ...BASE,
        nagAttempt: '0',
        // dose daqui a 3h37 (o delta do incidente de 2026-08-14), piso de 90min
        scheduledFor: new Date(Date.now() + 217 * 60000).toISOString(),
        earlyWindowMinutes: '90',
      })
    )
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
    expect((res as { refused?: string }).refused).toBe('out_of_window')
  })

  it('dose ADIANTADA mas DENTRO do piso → nag segue normal', async () => {
    const res = await handleAlarmAction(
      evt(undefined, {
        ...BASE,
        nagAttempt: '0',
        scheduledFor: new Date(Date.now() + 30 * 60000).toISOString(), // 30min < piso 90
        earlyWindowMinutes: '90',
      })
    )
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

// ─────────────────────────────────────────────────────────────────────────────
// 067 A2 (FR-005 / PO-1) — o funil de registro RECUSA fora da janela.
//
// É a última barreira antes da escrita clínica: as ações da NOTIFICAÇÃO não passam pelo
// `openAlarmScreen`, então sem esta guarda um disparo torto continua virando dose registrada —
// exatamente o caminho que destruiu a dose de 13:30 do incidente de 2026-08-14.
// ─────────────────────────────────────────────────────────────────────────────
describe('067 A2 — recusa de registro fora da janela', () => {
  const iso = (min: number) => new Date(Date.now() + min * 60000).toISOString()
  // Dose 3h37 no futuro, piso de 90min (protocolo 6/6h): o alarme não é desta dose.
  const ADIANTADA = { ...BASE, scheduledFor: iso(217), earlyWindowMinutes: '90' }
  const DENTRO = { ...BASE, scheduledFor: iso(-5), earlyWindowMinutes: '90' }

  it('🔴 "Pular" fora da janela NÃO grava skipped_user (a transição do incidente)', async () => {
    const res = await registerSkip(ADIANTADA)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(res).toMatchObject({ success: false, refused: 'out_of_window', direction: 'early' })
    // Princípio IX: motivo legível, nunca "nada aconteceu".
    expect(String((res as { message?: string }).message)).toMatch(/fora do horário/i)
  })

  it('🔴 "Tomei" fora da janela NÃO chama registerDose', async () => {
    const res = await registerTaken(ADIANTADA)
    expect(mockRegisterDose).not.toHaveBeenCalled()
    expect(res).toMatchObject({ success: false, refused: 'out_of_window' })
  })

  it('recusa AINDA silencia o alarme — a paciente agiu, o som tem de parar', async () => {
    await registerSkip(ADIANTADA)
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1')
  })

  it('recusa emite trilha + aviso (fail-open, nunca silenciosa)', async () => {
    await registerSkip(ADIANTADA)
    expect(mockReportOutOfWindow).toHaveBeenCalledTimes(1)
    const [arg] = mockReportOutOfWindow.mock.calls[0] as unknown as [any]
    expect(arg.direction).toBe('early')
    expect(arg.deltaSeconds).toBeLessThan(0) // negativo = adiantado
  })

  it('LOTE agrupado é recusado INTEIRO — meio registro é pior que nenhum', async () => {
    const grouped = {
      ...ADIANTADA,
      isGrouped: 'true',
      groupedDoses: JSON.stringify([
        { instanceId: 'i1', medicineId: 'm1', dosagePerIntake: 1 },
        { instanceId: 'i2', medicineId: 'm2', dosagePerIntake: 2 },
      ]),
    }
    const res = await registerSkip(grouped)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(res).toMatchObject({ refused: 'out_of_window' })
    await registerTaken(grouped)
    expect(mockRegisterDose).not.toHaveBeenCalled()
  })

  it('DENTRO da janela o fluxo segue idêntico (não-regressão do caminho feliz)', async () => {
    const res = await registerSkip(DENTRO)
    expect(mockFrom).toHaveBeenCalledWith('dose_instances')
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'skipped_user' })
    expect(res).toEqual({ success: true })
    expect(mockReportOutOfWindow).not.toHaveBeenCalled()
  })

  it('payload SEM scheduledFor não afirma nada — registro segue funcionando', async () => {
    // Notificação legada/sem horário: a guarda não pode inventar recusa (ficaria impossível
    // registrar dose em payload antigo).
    const res = await registerTaken(BASE)
    expect(mockRegisterDose).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ success: true })
  })

  it('🔴 dose ATRASADA (missed) continua registrável — recusar seria regressão, não guarda', async () => {
    // `register_dose_atomic` aceita ancorar instância `missed` de propósito
    // (`status IN ('pending','missed','skipped_user')`). Quem vê o alarme 3h depois e toca "Tomei"
    // REALMENTE tomou a dose: bloquear deixaria uma dose tomada fora do registro clínico — o oposto
    // do objetivo da spec. O lado atrasado é tratado pelo cancelamento da notificação vencida e,
    // no Slice B, pela regra do instante DECLARADO no banco.
    const ATRASADA = { ...BASE, scheduledFor: iso(-300), toleranceMinutes: '120', earlyWindowMinutes: '90' }
    const res = await registerTaken(ATRASADA)
    expect(mockRegisterDose).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ success: true })
    // E não gera telemetria de anomalia: expiração normal não é disparo torto.
    expect(mockReportOutOfWindow).not.toHaveBeenCalled()
  })

  it('smoke do DevHub (__dev) continua curto-circuitando antes da guarda', async () => {
    const res = await registerSkip({ ...ADIANTADA, __dev: true })
    expect(res).toEqual({ success: true, dev: true })
    expect(mockReportOutOfWindow).not.toHaveBeenCalled()
  })
})
