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

// Supabase mock: auth + from(insert/select/single, update/eq) + rpc.
const mockInsertSingle = jest.fn()
const mockRpc = jest.fn(() => ({ error: null }))
const mockGetUser = jest.fn(() => ({ data: { user: { id: 'user-1' } }, error: null }))

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: mockInsertSingle })) })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
    })),
    rpc: (...args) => mockRpc(...args),
  },
}))

import { registerDose } from '../doseService'

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
