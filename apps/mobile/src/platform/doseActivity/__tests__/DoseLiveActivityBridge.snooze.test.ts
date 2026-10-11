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
let mockOnline = true
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      // Offline: getUser valida no servidor e falha; getSession é local.
      getUser: () => (mockOnline ? Promise.resolve({ data: { user: { id: 'u1' } } }) : Promise.resolve({ data: { user: null } })),
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}))
let mockCached: any = null
jest.mock('../activeDoseItemCache', () => ({
  cacheActiveDoseItem: jest.fn(),
  getCachedDoseItem: () => Promise.resolve(mockCached),
}))
let mockWindowFails = false
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
jest.mock('@platform/alarms/alarmService', () => ({ scheduleSnooze: (...a: any[]) => mockSnooze(...a), MAX_SNOOZE_ATTEMPTS: 3 }))
let mockAttempts: Record<string, number> = {}
jest.mock('@platform/alarms/snoozeAnchorStore', () => ({
  getSnoozeAnchors: () => Promise.resolve({}),
  getSnoozeAttempts: () => Promise.resolve(mockAttempts),
  mergeSnoozeAnchors: (items: any[]) => items,
}))
const mockItems = [{ instanceId: 'i1', medicineName: 'Lantus', scheduledFor: '2026-03-05T12:00:00.000Z', critical: true, protocolId: 'p1', dosagePerIntake: 10, intakeUnit: 'UI', unitsPerMl: 100, dosageUnit: 'ui/ml', scheduledTime: '09:00' }]
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  createDoseInstanceRepository: () => ({ getWindow: jest.fn(() => (mockWindowFails ? Promise.reject(new Error('offline')) : Promise.resolve([]))) }),
  buildDoseItemsFromInstances: () => mockItems,
}))

import { processPendingActions, snoozeToastMessage } from '../DoseLiveActivityBridge'

afterEach(() => {
  mockOnline = true
  mockCached = null
  mockWindowFails = false
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
    expect(onSnoozeResult).toHaveBeenCalledWith('i1', { fireAt }, { reason: null })
    expect(snoozeToastMessage({ fireAt })).toBe('Alarme reagendado para 09:35')
  })

  it('🔴 PO-101-11: soneca recusada ⇒ mensagem de recusa, nunca a de sucesso', async () => {
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i1' }])
    mockSnooze.mockResolvedValueOnce(false)
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(onSnoozeResult).toHaveBeenCalledWith('i1', false, { reason: null })
    expect(snoozeToastMessage(false)).not.toContain('reagendado')
  })

  it('🔴 C-28: recusa pelo teto ⇒ toast explica o limite', async () => {
    mockAttempts = { i1: 3 }
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i1' }])
    mockSnooze.mockResolvedValueOnce(false)
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    mockAttempts = {}
    expect(onSnoozeResult).toHaveBeenCalledWith('i1', false, { reason: 'limit' })
    expect(snoozeToastMessage(false, { reason: 'limit' })).toBe('Limite de 3 sonecas atingido. Tome ou pule a dose.')
  })

  it('dose não resolvida ⇒ não agenda e reporta recusa', async () => {
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'desconhecida' }])
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(mockSnooze).not.toHaveBeenCalled()
    expect(onSnoozeResult).toHaveBeenCalledWith('desconhecida', false, { reason: null })
  })

  it('🔴 C-31: offline (sem sessão validada nem banco) ⇒ soneca agenda com sessão local + DoseItem gravado', async () => {
    mockOnline = false
    mockWindowFails = true
    mockCached = { instanceId: 'i9', medicineName: 'Glatus', scheduledFor: '2026-03-05T12:00:00.000Z', toleranceMinutes: 120, critical: true }
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i9' }])
    mockSnooze.mockResolvedValueOnce({ fireAt: 1 })
    const onSnoozeResult = jest.fn()
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult })
    expect(mockSnooze).toHaveBeenCalledWith(expect.objectContaining({ doseInstanceId: 'i9', medicineName: 'Glatus', scheduledFor: '2026-03-05T12:00:00.000Z' }))
    expect(onSnoozeResult).toHaveBeenCalledWith('i9', { fireAt: 1 }, { reason: null })
  })

  it('C-31: offline ⇒ "Registrar" NÃO roda com a sessão local (PO-SEC-2)', async () => {
    mockOnline = false
    const { navigateToDose } = require('@navigation/navigateToDose')
    mockDrain.mockResolvedValueOnce([{ action: 'register', instanceId: 'i1' }])
    await processPendingActions('America/Sao_Paulo', {})
    expect(navigateToDose).not.toHaveBeenCalled()
  })

  it('🔴 C-32: soneca do Adiar leva o data completo do alarme (corpo da notificação + Tomei)', async () => {
    mockDrain.mockResolvedValueOnce([{ action: 'snooze', instanceId: 'i1' }])
    mockSnooze.mockResolvedValueOnce({ fireAt: 1 })
    await processPendingActions('America/Sao_Paulo', { onSnoozeResult: jest.fn() })
    expect(mockSnooze.mock.calls[0][0].data).toMatchObject({
      protocolId: 'p1', quantityTaken: '10', intakeUnit: 'UI', unitsPerMl: '100', scheduledTime: '09:00', doseInstanceId: 'i1',
    })
  })
})
