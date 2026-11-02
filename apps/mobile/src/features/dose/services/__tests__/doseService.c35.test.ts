// 082 D2 (C-35 · PO-D2-6): registro aceito pelo app desarma alarme, soneca e superfície e marca a dose
// como resolvida ANTES do cancel. Recusa não desarma nada. (`resolved` da trilha sai do core.)

const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v)
  }),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k)
  }),
}))

jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: jest.fn() }))
jest.mock('@platform/analytics/medicineForm', () => ({ getMedicinePresentations: jest.fn(async () => ({})) }))
jest.mock('@shared/utils/debugLog', () => ({ debugLog: jest.fn() }))

const mockOrder: string[] = []
jest.mock('@platform/alarms/alarmService', () => ({
  cancelAlarm: jest.fn(async (id) => {
    mockOrder.push(`cancel:${id}`)
  }),
}))
jest.mock('@platform/doseActivity/doseActivitySurfaceService', () => ({
  endDoseActivity: jest.fn(async (id) => {
    mockOrder.push(`end:${id}`)
  }),
  showDoseDone: jest.fn(),
  readSurfaceLabel: jest.fn(async () => null),
}))
jest.mock('@platform/doseActivity/resolvedDoseStore', () => {
  const actual = jest.requireActual('@platform/doseActivity/resolvedDoseStore')
  return {
    ...actual,
    markDosesResolved: jest.fn(async (ids) => {
      mockOrder.push(`mark:${ids.join(',')}`)
      return actual.markDosesResolved(ids)
    }),
  }
})

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
  },
}))

const mockRegister = jest.fn()
const mockRegisterMany = jest.fn()
const mockUndo = jest.fn()
const mockGetById = jest.fn()
jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return {
    ...actual,
    createDoseLogService: () => ({
      registerDose: (...a) => mockRegister(...a),
      registerDoseMany: (...a) => mockRegisterMany(...a),
      undoDose: (...a) => mockUndo(...a),
    }),
    createDoseInstanceRepository: () => ({ getById: (...a) => mockGetById(...a) }),
  }
})

import { registerDose, registerDoseMany, undoDose } from '../doseService'
import { isDoseResolved } from '@platform/doseActivity/resolvedDoseStore'
import { SNOOZE_ANCHOR_KEY, SNOOZE_ATTEMPT_KEY } from '@platform/alarms/snoozeAnchorStore'

const RN = require('react-native')
const ORIGINAL_OS = RN.Platform.OS
const PID = '11111111-1111-4111-8111-111111111111'
const MID = '22222222-2222-4222-8222-222222222222'
const INPUT = { protocol_id: PID, medicine_id: MID, taken_at: '2026-05-30T08:00:00.000Z', quantity_taken: 1 }
const LOG = { id: 'log-1', medicine_id: MID, protocol_id: PID }

beforeEach(() => {
  RN.Platform.OS = 'android'
  mockRegister.mockResolvedValue(LOG)
  mockStore.set(SNOOZE_ANCHOR_KEY, JSON.stringify({ i1: Date.now() + 60000, other: Date.now() + 60000 }))
  mockStore.set(SNOOZE_ATTEMPT_KEY, JSON.stringify({ i1: 2, other: 1 }))
})

afterEach(() => {
  RN.Platform.OS = ORIGINAL_OS
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockStore.clear()
  mockOrder.length = 0
})

describe('registerDose — C-35', () => {
  it('marca resolvida ANTES do cancel, desarma alarme+superfície e limpa só a soneca da dose', async () => {
    const res = await registerDose(INPUT, { instanceId: 'i1' })
    expect(res.success).toBe(true)
    expect(mockOrder).toEqual(['mark:i1', 'cancel:i1', 'end:i1'])
    expect(await isDoseResolved('i1')).toBe(true)
    expect(Object.keys(JSON.parse(mockStore.get(SNOOZE_ANCHOR_KEY)!))).toEqual(['other'])
    expect(Object.keys(JSON.parse(mockStore.get(SNOOZE_ATTEMPT_KEY)!))).toEqual(['other'])
  })

  it('registro RECUSADO (fora da janela/erro) não desarma nada', async () => {
    mockRegister.mockRejectedValueOnce(Object.assign(new Error('Fora da janela permitida'), { code: 'P0002' }))
    const res = await registerDose(INPUT, { instanceId: 'i1' })
    expect(res.success).toBe(false)
    expect(mockOrder).toEqual([])
    expect(await isDoseResolved('i1')).toBe(false)
  })

  it('"já registrada" (P0001) também desarma e marca', async () => {
    mockRegister.mockRejectedValueOnce(Object.assign(new Error('Ocorrência já registrada ou indisponível'), { code: 'P0001' }))
    await registerDose(INPUT, { instanceId: 'i1' })
    expect(mockOrder).toEqual(['mark:i1', 'cancel:i1', 'end:i1'])
  })

  it('sem instanceId (avulso) ⇒ no-op', async () => {
    await registerDose(INPUT, { instanceId: null })
    expect(mockOrder).toEqual([])
  })
})

describe('registerDoseMany (hero card da Hoje) — C-35', () => {
  it('desarma por dose de sucesso; falha do lote não desarma', async () => {
    mockRegisterMany.mockResolvedValueOnce([
      { success: true, instanceId: 'i1', data: LOG },
      { success: false, instanceId: 'i2', error: 'x' },
    ])
    await registerDoseMany([{ ...INPUT, instance_id: 'i1' }, { ...INPUT, instance_id: 'i2' }])
    expect(mockOrder).toEqual(['mark:i1', 'cancel:i1', 'end:i1'])
  })
})

describe('undoDose — C-35', () => {
  it('desfazer retira a marca (a dose volta a poder armar a superfície)', async () => {
    await registerDose(INPUT, { instanceId: 'i1' })
    mockGetById.mockResolvedValueOnce({ id: 'i1', medicine_id: MID, protocol_id: PID })
    expect((await undoDose('i1')).success).toBe(true)
    expect(await isDoseResolved('i1')).toBe(false)
  })
})
