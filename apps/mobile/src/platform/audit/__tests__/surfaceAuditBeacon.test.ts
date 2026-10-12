// Spec 084 (PO-4/PO-5) — emissor Android de `surface_transitioned`.
// Prova: occurredAt carimbado na origem (antes do await da sessão) · dono via getSession (local,
// AP-357) · fila com chave PRÓPRIA (INV-4) · detail só {from,to,source} (INV-3) · fail-open.

import { Platform } from 'react-native'

const mockEnqueue = jest.fn().mockResolvedValue(undefined)
const mockFlush = jest.fn().mockResolvedValue({ inserted: 0, remaining: 0 })
jest.mock('../criticalAuditQueue', () => ({
  createCriticalAuditQueue: jest.fn(() => ({ enqueue: (...a) => mockEnqueue(...a), flush: (...a) => mockFlush(...a) })),
  AUDIT_QUEUE_KEY: '@dosiq/audit/queue',
}))

const mockGetSession = jest.fn()
const mockGetUser = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: (...a) => mockGetSession(...a), getUser: (...a) => mockGetUser(...a) } },
}))

import { createCriticalAuditQueue } from '../criticalAuditQueue'
import {
  enqueueSurfaceTransition,
  emitDeliveredTransition,
  drainSurfaceAudit,
  SURFACE_AUDIT_QUEUE_KEY,
} from '../surfaceAuditBeacon'

const USER = '58ff7850-8d96-4db5-9051-0908a115611c'
const INST = '22222222-2222-4222-8222-222222222222'
const T = new Date('2026-10-11T15:00:00.000Z').getTime()

describe('surfaceAuditBeacon', () => {
  const originalOS = Platform.OS
  beforeEach(() => {
    Platform.OS = 'android'
    jest.useFakeTimers()
    jest.setSystemTime(T)
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: USER } } } })
  })
  afterEach(() => {
    Platform.OS = originalOS
    jest.useRealTimers()
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('fila própria: chave distinta da fila dos beacons de alarme (INV-4)', () => {
    expect(SURFACE_AUDIT_QUEUE_KEY).not.toBe('@dosiq/audit/queue')
    // a instância é criada no load do módulo (antes de qualquer clearAllMocks)
    expect(jest.mocked(createCriticalAuditQueue).mock.calls[0][0]).toEqual(expect.objectContaining({ key: SURFACE_AUDIT_QUEUE_KEY }))
  })

  it('enfileira a linha android com detail só {from,to,source}', async () => {
    await enqueueSurfaceTransition({ instanceId: INST, from: 'upcoming', to: 'now', source: 'app' })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    expect(mockEnqueue.mock.calls[0][0]).toEqual({
      userId: USER,
      doseInstanceId: INST,
      event: 'surface_transitioned',
      platform: 'android',
      actor: 'system',
      detail: { from: 'upcoming', to: 'now', source: 'app' },
      occurredAt: new Date(T).toISOString(),
    })
  })

  it('occurredAt carimbado ANTES do await da sessão (INV-5)', async () => {
    mockGetSession.mockImplementation(async () => {
      jest.setSystemTime(T + 3600_000) // a sessão "demora" 1 h
      return { data: { session: { user: { id: USER } } } }
    })
    await enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'now', source: 'alarm' })
    expect(mockEnqueue.mock.calls[0][0].occurredAt).toBe(new Date(T).toISOString())
  })

  it('occurredAt explícito do chamador prevalece (carimbado na origem do handler)', async () => {
    const at = new Date(T - 5000).toISOString()
    await enqueueSurfaceTransition({ instanceId: INST, from: 'now', to: 'late', source: 'boundary', occurredAt: at })
    expect(mockEnqueue.mock.calls[0][0].occurredAt).toBe(at)
  })

  it('dono via getSession (local), nunca getUser (rede — AP-357)', async () => {
    await enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'later', source: 'app' })
    expect(mockGetSession).toHaveBeenCalled()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('sem sessão → não enfileira (órfão proibido, CON-031)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    await enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'now', source: 'app' })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it.each([
    ['to fora do vocabulário', { to: 'done', source: 'app' }],
    ['source inválido', { to: 'now', source: 'armed' }],
    ['sem instância', { to: 'now', source: 'app', instanceId: '' }],
  ])('%s → não enfileira', async (_n, over) => {
    await enqueueSurfaceTransition({ instanceId: INST, from: null, ...over })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('from fora do vocabulário vira null', async () => {
    await enqueueSurfaceTransition({ instanceId: INST, from: 'lixo', to: 'now', source: 'app' })
    expect(mockEnqueue.mock.calls[0][0].detail.from).toBeNull()
  })

  it('iOS → não emite (superfície é só Android)', async () => {
    Platform.OS = 'ios'
    await enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'now', source: 'app' })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('fail-open: getSession e enqueue que lançam não propagam', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('x'))
    await expect(enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'now', source: 'app' })).resolves.toBeUndefined()
    mockEnqueue.mockRejectedValueOnce(new Error('disco'))
    await expect(enqueueSurfaceTransition({ instanceId: INST, from: null, to: 'now', source: 'app' })).resolves.toBeUndefined()
  })

  it('emitDeliveredTransition lê transitionFrom/To do payload, source=boundary', async () => {
    await emitDeliveredTransition({ doseInstanceId: INST, transitionFrom: '', transitionTo: 'later' })
    expect(mockEnqueue.mock.calls[0][0].detail).toEqual({ from: null, to: 'later', source: 'boundary' })
  })

  it('emitDeliveredTransition sem transitionTo (T0, cap, payload antigo) → não emite', async () => {
    await emitDeliveredTransition({ doseInstanceId: INST, transitionFrom: '', transitionTo: '' })
    await emitDeliveredTransition({ doseInstanceId: INST })
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('drainSurfaceAudit drena a fila da superfície com o inserter dado', async () => {
    const insertOne = jest.fn()
    await drainSurfaceAudit(insertOne)
    expect(mockFlush).toHaveBeenCalledWith(insertOne)
  })
})
