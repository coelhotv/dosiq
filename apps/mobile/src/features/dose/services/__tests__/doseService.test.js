// doseService.test.js — âncora determinística por instanceId vs snap (F4.3c)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

// Spies do repo de instâncias (criado no load do módulo via createDoseInstanceRepository).
// Prefixo `mock` exigido pelo guard de hoisting do jest.mock.
const mockMarkTaken = jest.fn()
const mockFindAnchorInstance = jest.fn()

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  createDoseInstanceRepository: () => ({
    markTaken: (...a) => mockMarkTaken(...a),
    findAnchorInstance: (...a) => mockFindAnchorInstance(...a),
  }),
}))

jest.mock('../../../../platform/analytics/firebaseAnalytics', () => ({ logEvent: jest.fn() }))
jest.mock('@shared/utils/debugLog', () => ({ debugLog: jest.fn() }))

// Cancel-on-resolve cross-superfície (036): doseService cancela o alarme local da
// instância resolvida. Best-effort — falha não pode derrubar o registro.
const mockCancelAlarm = jest.fn()
jest.mock('../../../../platform/alarms/alarmService', () => ({
  cancelAlarm: (...a) => mockCancelAlarm(...a),
}))

// Supabase mock: auth + from(insert/select/single, update/eq) + rpc.
const mockInsertSingle = jest.fn()
const mockRpc = jest.fn(() => ({ error: null }))
const mockGetUser = jest.fn(() => ({ data: { user: { id: 'user-1' } }, error: null }))
// Batch (registerDoseMany): `.insert([]).select('...')` é aguardado direto → {data,error}.
// Individual: `.insert({}).select('...').single()`. select() serve os dois (tem single + data/error).
const mockBatch = { data: [], error: null }

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: mockInsertSingle, data: mockBatch.data, error: mockBatch.error })) })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
    })),
    rpc: (...args) => mockRpc(...args),
  },
}))

import { registerDose, registerDoseMany } from '../doseService'

const PID = '11111111-1111-4111-8111-111111111111'
const MID = '22222222-2222-4222-8222-222222222222'
const LOG = { id: 'log-1', taken_at: '2026-05-30T08:00:00.000Z', quantity_taken: 1, medicine_id: MID, protocol_id: PID }
const INPUT = { protocol_id: PID, medicine_id: MID, taken_at: '2026-05-30T08:00:00.000Z', quantity_taken: 1 }

beforeEach(() => {
  jest.clearAllMocks()
  mockInsertSingle.mockResolvedValue({ data: LOG, error: null })
  mockRpc.mockReturnValue({ error: null })
  mockGetUser.mockReturnValue({ data: { user: { id: 'user-1' } }, error: null })
  mockMarkTaken.mockResolvedValue(true)
  mockFindAnchorInstance.mockResolvedValue({ id: 'inst-snap' })
  mockCancelAlarm.mockResolvedValue(undefined)
})

describe('registerDose — âncora por instanceId (F4.3c)', () => {
  it('com instanceId → markTaken DIRETO na ocorrência, sem snap', async () => {
    const res = await registerDose(INPUT, { instanceId: 'inst-direct' })
    expect(res.success).toBe(true)
    expect(mockMarkTaken).toHaveBeenCalledWith('inst-direct', 'log-1')
    expect(mockFindAnchorInstance).not.toHaveBeenCalled()
  })

  it('sem instanceId → snap por tolerância (findAnchorInstance + markTaken)', async () => {
    const res = await registerDose(INPUT)
    expect(res.success).toBe(true)
    expect(mockFindAnchorInstance).toHaveBeenCalledWith({ protocolId: PID, takenAt: LOG.taken_at })
    expect(mockMarkTaken).toHaveBeenCalledWith('inst-snap', 'log-1')
  })

  it('instanceId com markTaken falho → NÃO cai no snap (log fica avulso)', async () => {
    mockMarkTaken.mockResolvedValueOnce(false)
    const res = await registerDose(INPUT, { instanceId: 'inst-direct' })
    expect(res.success).toBe(true) // log é a fonte de verdade — registro não falha
    expect(mockMarkTaken).toHaveBeenCalledWith('inst-direct', 'log-1')
    expect(mockFindAnchorInstance).not.toHaveBeenCalled()
  })

  it('âncora é best-effort — falha não derruba o registro', async () => {
    mockMarkTaken.mockRejectedValueOnce(new Error('db down'))
    const res = await registerDose(INPUT, { instanceId: 'inst-direct' })
    expect(res.success).toBe(true)
  })
})

describe('registerDoseMany — âncora por instance_id (F4.3d)', () => {
  beforeEach(() => {
    mockBatch.data = [
      { id: 'log-a', taken_at: INPUT.taken_at, quantity_taken: 1, medicine_id: MID, protocol_id: PID },
      { id: 'log-b', taken_at: INPUT.taken_at, quantity_taken: 1, medicine_id: MID, protocol_id: PID },
    ]
    mockBatch.error = null
  })

  it('cada entrada com instance_id → markTaken direto na ocorrência (sem snap)', async () => {
    const res = await registerDoseMany([
      { ...INPUT, instance_id: 'inst-a' },
      { ...INPUT, instance_id: 'inst-b' },
    ])
    expect(res.success).toBe(true)
    expect(mockMarkTaken).toHaveBeenCalledWith('inst-a', 'log-a')
    expect(mockMarkTaken).toHaveBeenCalledWith('inst-b', 'log-b')
    expect(mockFindAnchorInstance).not.toHaveBeenCalled()
  })

  it('entrada sem instance_id → snap por tolerância (fallback)', async () => {
    mockBatch.data = [{ id: 'log-a', taken_at: INPUT.taken_at, quantity_taken: 1, medicine_id: MID, protocol_id: PID }]
    const res = await registerDoseMany([{ ...INPUT }]) // sem instance_id
    expect(res.success).toBe(true)
    expect(mockFindAnchorInstance).toHaveBeenCalledWith({ protocolId: PID, takenAt: INPUT.taken_at })
  })
})

describe('cancel-on-resolve cross-superfície (036/AP-235)', () => {
  it('registerDose com instanceId → cancela o alarme daquela instância', async () => {
    await registerDose(INPUT, { instanceId: 'inst-direct' })
    expect(mockCancelAlarm).toHaveBeenCalledWith('inst-direct')
  })

  it('registerDose sem instanceId → não chama cancelAlarm (PRN/avulso, sem alarme)', async () => {
    await registerDose(INPUT)
    expect(mockCancelAlarm).not.toHaveBeenCalled()
  })

  it('cancelAlarm é best-effort — falha não derruba o registro', async () => {
    mockCancelAlarm.mockRejectedValueOnce(new Error('notifee down'))
    const res = await registerDose(INPUT, { instanceId: 'inst-direct' })
    expect(res.success).toBe(true)
  })

  it('registerDoseMany → cancela o alarme de cada instância resolvida', async () => {
    mockBatch.data = [
      { id: 'log-a', taken_at: INPUT.taken_at, quantity_taken: 1, medicine_id: MID, protocol_id: PID },
      { id: 'log-b', taken_at: INPUT.taken_at, quantity_taken: 1, medicine_id: MID, protocol_id: PID },
    ]
    mockBatch.error = null
    await registerDoseMany([
      { ...INPUT, instance_id: 'inst-a' },
      { ...INPUT, instance_id: 'inst-b' },
    ])
    expect(mockCancelAlarm).toHaveBeenCalledWith('inst-a')
    expect(mockCancelAlarm).toHaveBeenCalledWith('inst-b')
  })
})
