// alarmService.snoozeWindow.test.ts — 067 A2 / US3 / PO-5
//
// Contexto medido no incidente (2026-08-14): `snoozed` às 09:47 foi seguido de `alarm_fired` às
// 09:52. A soneca PROPAGOU o disparo torto, porque agenda +5min a partir do DISPARO, não do horário
// real da dose. Pior: persistia `snoozed_until`, e com isso o próximo `syncAlarms` respeitava a
// soneca errada e não re-armava o alarme das 13:30.
//
// Arquivo separado do `alarmService.test.ts` de propósito: a soneca precisa de mocks de
// repositório/supabase/trilha que o teste do agendamento não usa — misturar tornaria os dois frágeis.

import notifee from '@notifee/react-native'

const mockSetSnoozedUntil = jest.fn((..._a: any[]) => Promise.resolve())
const mockEmit = jest.fn((..._a: any[]) => Promise.resolve())
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return {
    ...actual,
    createDoseInstanceRepository: () => ({ setSnoozedUntil: (...a: any[]) => mockSetSnoozedUntil(...a) }),
    createCriticalAuditService: () => ({ emit: (...a: any[]) => mockEmit(...a) }),
  }
})

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) } },
}))

const mockReportOutOfWindow = jest.fn((..._a: any[]) => Promise.resolve({ tracked: true, notified: true }))
jest.mock('../outOfWindowNotice', () => ({
  reportOutOfWindowAlarm: (...a: any[]) => mockReportOutOfWindow(...a),
}))

const mockTriggerResync = jest.fn()
jest.mock('../alarmResyncBus', () => ({
  triggerAlarmResync: () => mockTriggerResync(),
  onAlarmResync: () => () => {},
}))

import { scheduleSnooze } from '../alarmService'

const iso = (min: number) => new Date(Date.now() + min * 60000).toISOString()

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('scheduleSnooze — soneca sobre alarme FORA DA JANELA (FR-006)', () => {
  const ADIANTADA = {
    doseInstanceId: 'inst-1',
    medicineName: 'Amoxicilina',
    scheduledFor: iso(217), // 3h37 no futuro — o delta do incidente
    toleranceMinutes: 120,
    earlyWindowMinutes: 90,
    currentSnoozeAttempt: 0,
    isCritical: true,
  }

  it('🔴 NÃO reagenda +5min a partir do disparo torto', async () => {
    const ok = await scheduleSnooze(ADIANTADA)
    expect(ok).toBe(false)
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })

  it('🔴 NÃO persiste snoozed_until — senão o próximo sync não re-armaria o alarme correto', async () => {
    await scheduleSnooze(ADIANTADA)
    expect(mockSetSnoozedUntil).not.toHaveBeenCalled()
  })

  it('cancela o alarme e pede RESYNC a partir do banco (corrige em vez de repetir)', async () => {
    await scheduleSnooze(ADIANTADA)
    expect(notifee.cancelNotification).toHaveBeenCalledWith('inst-1')
    expect(mockTriggerResync).toHaveBeenCalledTimes(1)
  })

  it('registra a anomalia (trilha + aviso) — recusa nunca é silenciosa', async () => {
    await scheduleSnooze(ADIANTADA)
    expect(mockReportOutOfWindow).toHaveBeenCalledTimes(1)
    const [arg] = mockReportOutOfWindow.mock.calls[0] as unknown as [any]
    expect(arg.direction).toBe('early')
  })
})

describe('scheduleSnooze — não-regressão da soneca legítima (AC-3.2)', () => {
  const DENTRO = {
    doseInstanceId: 'inst-2',
    medicineName: 'Losartana',
    scheduledFor: iso(-3), // dose de 3min atrás: soneca normal
    toleranceMinutes: 120,
    earlyWindowMinutes: 90,
    currentSnoozeAttempt: 0,
    isCritical: true,
  }

  it('reagenda, persiste snoozed_until e emite `snoozed` como antes', async () => {
    const ok = await scheduleSnooze(DENTRO)
    expect(ok).not.toBe(false)
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
    expect(mockSetSnoozedUntil).toHaveBeenCalledTimes(1)
    expect(mockReportOutOfWindow).not.toHaveBeenCalled()
    expect(mockTriggerResync).not.toHaveBeenCalled()
  })

  it('🔴 soneca REPETIDA nunca cai no piso (dispara depois do horário, por construção)', async () => {
    // snoozeAttempt=2: o disparo já está +10min depois do agendado. Se o piso fosse avaliado sobre o
    // instante do disparo em vez do lado adiantado, a 3ª soneca seria recusada — regressão sutil.
    const ok = await scheduleSnooze({ ...DENTRO, currentSnoozeAttempt: 2, scheduledFor: iso(-10) })
    expect(ok).not.toBe(false)
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1)
  })

  it('soneca de dose ATRASADA segue no comportamento pré-existente (não é a anomalia da US3)', async () => {
    const ok = await scheduleSnooze({ ...DENTRO, scheduledFor: iso(-300) })
    expect(ok).not.toBe(false)
    expect(mockSetSnoozedUntil).toHaveBeenCalledTimes(1)
    expect(mockReportOutOfWindow).not.toHaveBeenCalled()
  })

  it('teto de 3 sonecas preservado', async () => {
    const ok = await scheduleSnooze({ ...DENTRO, currentSnoozeAttempt: 3 })
    expect(ok).toBe(false)
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled()
  })

  it('payload legado sem earlyWindowMinutes: piso 120 fail-closed, soneca normal segue OK', async () => {
    const { earlyWindowMinutes, ...legado } = DENTRO
    const ok = await scheduleSnooze(legado as any)
    expect(ok).not.toBe(false)
    expect(mockSetSnoozedUntil).toHaveBeenCalledTimes(1)
  })
})
