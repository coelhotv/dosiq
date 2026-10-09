// Spec 101 C-13 (smoke iOS 2026-10-09): o push-to-start da recriação acorda o app EM BACKGROUND; o
// bridge chamava `start` (que encerrava a LA do servidor e falhava no `request`) e ainda guardava a dose
// como "LA viva" — no foreground seguinte só fazia `update` numa LA inexistente.
const mockStart = jest.fn()
const mockUpdate = jest.fn()
const mockEnd = jest.fn()
jest.mock('../liveActivityService', () => ({
  drainPendingActions: jest.fn().mockResolvedValue([]),
  startLiveActivity: (...a: any[]) => mockStart(...a),
  updateLiveActivity: (...a: any[]) => mockUpdate(...a),
  endLiveActivity: (...a: any[]) => mockEnd(...a),
  showDoneLiveActivity: jest.fn(),
  liveActivitySupported: true,
}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() } } }))
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
jest.mock('@platform/alarms/alarmService', () => ({ scheduleSnooze: jest.fn() }))
const mockItems = [{ instanceId: 'i1', medicineName: 'Lantus', scheduledFor: '2026-03-05T12:00:00.000Z', critical: true, status: 'pending' }]
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  buildDoseItemsFromInstances: () => mockItems,
  selectActiveDoseActivity: () => ({ instanceId: 'i1', state: 'now' }),
}))

import { deriveAndDrive } from '../DoseLiveActivityBridge'

const base = { userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' }

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('deriveAndDrive — C-13 (LA recriada pelo servidor)', () => {
  it('🔴 C-13a: app em background ⇒ não inicia nem encerra LA (a do servidor sobrevive)', async () => {
    const r = await deriveAndDrive({ ...base, prevInstanceId: null, foreground: false })
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockEnd).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(r).toBeNull() // nada armado por este processo
  })

  it('🔴 C-13b: start falhou ⇒ não marca a dose como armada (próximo derive tenta de novo)', async () => {
    mockStart.mockResolvedValueOnce(null)
    const r = await deriveAndDrive({ ...base, prevInstanceId: null, foreground: true })
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(r).toBeNull()
  })

  it('start ok ⇒ dose armada', async () => {
    mockStart.mockResolvedValueOnce('act-1')
    const r = await deriveAndDrive({ ...base, prevInstanceId: null, foreground: true })
    expect(r).toBe('i1')
  })

  it('🔴 C-13b: mesma dose mas nenhuma LA nativa para atualizar ⇒ inicia', async () => {
    mockUpdate.mockResolvedValueOnce(0)
    mockStart.mockResolvedValueOnce('act-2')
    const r = await deriveAndDrive({ ...base, prevInstanceId: 'i1', foreground: true })
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(r).toBe('i1')
  })

  it('mesma dose com LA viva ⇒ só update, sem recriar', async () => {
    mockUpdate.mockResolvedValueOnce(1)
    const r = await deriveAndDrive({ ...base, prevInstanceId: 'i1', foreground: true })
    expect(mockStart).not.toHaveBeenCalled()
    expect(r).toBe('i1')
  })
})
