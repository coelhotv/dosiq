import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock do repositório (mesma isolação do doseLogService.test.js principal).
vi.mock('../../repositories/createDoseInstanceRepository.js', () => ({
  createDoseInstanceRepository: () => ({
    findAnchorInstance: vi.fn(),
    getById: vi.fn(),
    revertToUnregistered: vi.fn(),
  }),
}))

import { createDoseLogService } from '../doseLogService.js'

const getUserId = async () => 'user-123'
const MED = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

afterEach(() => vi.clearAllMocks())

describe('registerDose — propaga injection_site à RPC (PO-1, anti AP-214)', () => {
  const baseLog = { medicine_id: MED, taken_at: new Date().toISOString(), quantity_taken: 1 }

  it('passa p_injection_site quando o log tem sítio', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { id: 'log-1' }, error: null })) }
    const service = createDoseLogService({ client, getUserId })

    await service.registerDose({ ...baseLog, injection_site: 'coxa_d' })

    expect(client.rpc).toHaveBeenCalledWith(
      'register_dose_atomic',
      expect.objectContaining({ p_injection_site: 'coxa_d' })
    )
  })

  it('passa p_injection_site = null para dose sem sítio (oral/flow sem form — PO-6)', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { id: 'log-2' }, error: null })) }
    const service = createDoseLogService({ client, getUserId })

    await service.registerDose(baseLog)

    expect(client.rpc).toHaveBeenCalledWith(
      'register_dose_atomic',
      expect.objectContaining({ p_injection_site: null })
    )
  })

  it('rejeita sítio fora do enum antes da RPC (Zod — PO-7)', async () => {
    const client = { rpc: vi.fn() }
    const service = createDoseLogService({ client, getUserId })

    await expect(
      service.registerDose({ ...baseLog, injection_site: 'Coxa_D' })
    ).rejects.toThrow(/validação|inválido/i)
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe('updateOrphanLog — edita sítio pós-registro com flag de presença (PO-8/FR-011)', () => {
  const LOG_ID = 'b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380a22'

  it('envia p_injection_site + p_has_injection_site=true quando o campo está no update', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { id: LOG_ID }, error: null })) }
    const service = createDoseLogService({ client, getUserId })

    await service.updateOrphanLog(LOG_ID, { injection_site: 'gluteo_d' })

    expect(client.rpc).toHaveBeenCalledWith(
      'update_dose_log_atomic',
      expect.objectContaining({ p_injection_site: 'gluteo_d', p_has_injection_site: true })
    )
  })

  it('limpa o sítio (null) ainda com p_has_injection_site=true — distingue "não enviado" de "apagar"', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { id: LOG_ID }, error: null })) }
    const service = createDoseLogService({ client, getUserId })

    await service.updateOrphanLog(LOG_ID, { injection_site: null })

    expect(client.rpc).toHaveBeenCalledWith(
      'update_dose_log_atomic',
      expect.objectContaining({ p_injection_site: null, p_has_injection_site: true })
    )
  })

  it('p_has_injection_site=false quando o update não menciona o campo (COALESCE preserva)', async () => {
    const client = { rpc: vi.fn(async () => ({ data: { id: LOG_ID }, error: null })) }
    const service = createDoseLogService({ client, getUserId })

    await service.updateOrphanLog(LOG_ID, { quantity_taken: 2 })

    expect(client.rpc).toHaveBeenCalledWith(
      'update_dose_log_atomic',
      expect.objectContaining({ p_has_injection_site: false })
    )
  })
})

describe('getLastInjectionSite — último global por taken_at (PO-2/PO-2a)', () => {
  // Builder encadeável que captura os filtros aplicados e devolve um resultado fixo.
  function makeQueryClient(result) {
    const calls = {}
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((col, val) => {
        calls[col] = val
        return builder
      }),
      not: vi.fn((col, op) => {
        calls[`not_${col}`] = op
        return builder
      }),
      order: vi.fn((col, opts) => {
        calls.order = { col, opts }
        return builder
      }),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => result),
    }
    const client = { from: vi.fn(() => builder), __calls: calls }
    return client
  }

  it('retorna o sítio mais recente, ordenando por taken_at DESC sem filtro de medicine', async () => {
    const client = makeQueryClient({ data: { injection_site: 'abdomen_e' }, error: null })
    const service = createDoseLogService({ client, getUserId })

    const last = await service.getLastInjectionSite()

    expect(last).toBe('abdomen_e')
    expect(client.from).toHaveBeenCalledWith('medicine_logs')
    // GLOBAL: filtra por user, NÃO por medicine_id/protocol_id
    expect(client.__calls.user_id).toBe('user-123')
    expect(client.__calls.medicine_id).toBeUndefined()
    expect(client.__calls.protocol_id).toBeUndefined()
    // ordena por taken_at DESC (não created_at) — tolerante a log retroativo (PO-2a)
    expect(client.__calls.order.col).toBe('taken_at')
    expect(client.__calls.order.opts.ascending).toBe(false)
    // só considera logs COM sítio
    expect(client.__calls.not_injection_site).toBe('is')
  })

  it('retorna null quando não há nenhum log com sítio (empty — PO-2)', async () => {
    const client = makeQueryClient({ data: null, error: null })
    const service = createDoseLogService({ client, getUserId })

    expect(await service.getLastInjectionSite()).toBeNull()
  })

  it('propaga erro da query', async () => {
    const client = makeQueryClient({ data: null, error: new Error('db down') })
    const service = createDoseLogService({ client, getUserId })

    await expect(service.getLastInjectionSite()).rejects.toThrow('db down')
  })
})
