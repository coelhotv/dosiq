// Spec 101 (FR-010 / PO-101-11): "Adiar" vindo da Live Activity → confirmação com o HH:MM devolvido pelo
// agendamento; recusa nunca mostra a mensagem de sucesso.
const mockDrain = jest.fn()
jest.mock('../liveActivityService', () => ({
  drainPendingActions: () => mockDrain(),
  startLiveActivity: jest.fn(),
  updateLiveActivity: jest.fn(),
  endLiveActivity: jest.fn(),
  showDoneLiveActivity: jest.fn(),
  liveActivitySupported: true,
}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) } },
}))
jest.mock('@platform/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@platform/consent/useConsentSuppressed', () => ({ useConsentSuppressed: () => false }))
jest.mock('@dashboard/services/dashboardService', () => ({
  getActiveProtocols: jest.fn().mockResolvedValue([]),
  getUserSettings: jest.fn(),
  getMedicinesData: jest.fn().mockResolvedValue({}),
}))
jest.mock('@navigation/navigateToDose', () => ({ navigateToDose: jest.fn() }))
jest.mock('../pushToStartRegistration', () => ({ registerPushToStart: jest.fn(), resetPushToStartDedupe: jest.fn() }))
jest.mock('../syncActivityToken', () => ({ syncActivityToken: jest.fn(), forgetSyncedToken: jest.fn() }))
jest.mock('@platform/analytics/reminderEvents', () => ({ emitReminderOpened: jest.fn() }))
const mockSnooze = jest.fn()
jest.mock('@platform/alarms/alarmService', () => ({ scheduleSnooze: (...a: any[]) => mockSnooze(...a) }))
const mockItems = [{ instanceId: 'i1', medicineName: 'Lantus', scheduledFor: '2026-03-05T12:00:00.000Z', critical: true }]
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  buildDoseItemsFromInstances: () => mockItems,
}))

import { processPendingActions, snoozeToastMessage } from '../DoseLiveActivityBridge'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('processPendingActions — Adiar da LA (spec 101)', () => {
  it('🔴 PO-101-11: soneca aceita ⇒ onSnoozeResult recebe o fireAt do agendamento', async () => {
    const fireAt = new Date(2026, 2, 5, 9, 35).getTime() // 09:35 local
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i1' }])
    mockSnooze.mockResolvedValueOnce({ fireAt })
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(onSnoozeResult).toHaveBeenCalledWith('i1', { fireAt })
    expect(snoozeToastMessage({ fireAt })).toBe('Alarme reagendado para 09:35')
  })

  it('🔴 PO-101-11: soneca recusada ⇒ mensagem de recusa, nunca a de sucesso', async () => {
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i1' }])
    mockSnooze.mockResolvedValueOnce(false)
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(onSnoozeResult).toHaveBeenCalledWith('i1', false)
    expect(snoozeToastMessage(false)).not.toContain('reagendado')
  })

  it('dose não resolvida ⇒ não agenda e reporta recusa', async () => {
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'desconhecida' }])
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(mockSnooze).not.toHaveBeenCalled()
    expect(onSnoozeResult).toHaveBeenCalledWith('desconhecida', false)
  })
})
