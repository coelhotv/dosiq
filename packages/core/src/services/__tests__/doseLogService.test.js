import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'

// Mock do repositório de ocorrências (snap/getById/revert) — isola o core das queries.
const mockRepo = {
  findAnchorInstance: vi.fn(),
  getById: vi.fn(),
  revertToUnregistered: vi.fn(),
}
vi.mock('../../repositories/createDoseInstanceRepository.js', () => ({
  createDoseInstanceRepository: () => mockRepo,
}))

import { createDoseLogService, DEFAULT_TOLERANCE_MINUTES } from '../doseLogService.js'

const mockUserId = 'user-123'
const getUserId = async () => mockUserId
const MED = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROTO = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'

function makeClient(rpcImpl) {
  return { rpc: vi.fn(rpcImpl) }
}

beforeEach(() => {
  mockRepo.findAnchorInstance.mockReset()
  mockRepo.getById.mockReset()
  mockRepo.revertToUnregistered.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('createDoseLogService', () => {
  it('exige client e getUserId na factory', () => {
    expect(() => createDoseLogService({})).toThrow('client')
    expect(() => createDoseLogService({ client: { rpc: vi.fn() } })).toThrow('getUserId')
  })

  describe('registerDose', () => {
    const baseLog = { medicine_id: MED, taken_at: new Date().toISOString(), quantity_taken: 1 }

    it('âncora direta é estrita e delega à RPC atômica', async () => {
      const client = makeClient(async () => ({
        data: { id: 'log-1', dose_instance_id: 'inst-1' },
        error: null,
      }))
      const service = createDoseLogService({ client, getUserId })

      const result = await service.registerDose(baseLog, { instanceId: 'inst-1' })

      expect(client.rpc).toHaveBeenCalledWith(
        'register_dose_atomic',
        expect.objectContaining({
          p_user_id: mockUserId,
          p_medicine_id: MED,
          p_dose_instance_id: 'inst-1',
          p_strict_anchor: true,
        })
      )
      expect(result.dose_instance_id).toBe('inst-1')
      // Âncora explícita NÃO dispara snap
      expect(mockRepo.findAnchorInstance).not.toHaveBeenCalled()
    })

    it('sem instanceId mas com protocol_id faz snap best-effort', async () => {
      mockRepo.findAnchorInstance.mockResolvedValue({ id: 'inst-snap' })
      const client = makeClient(async () => ({ data: { id: 'log-2', dose_instance_id: 'inst-snap' }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      await service.registerDose({ ...baseLog, protocol_id: PROTO })

      expect(mockRepo.findAnchorInstance).toHaveBeenCalledWith({ protocolId: PROTO, takenAt: baseLog.taken_at })
      expect(client.rpc).toHaveBeenCalledWith(
        'register_dose_atomic',
        expect.objectContaining({ p_dose_instance_id: 'inst-snap', p_strict_anchor: false })
      )
    })

    it('propaga falha de estoque da RPC (sem log órfão — tudo revertido no banco)', async () => {
      const client = makeClient(async () => ({ data: null, error: new Error('Estoque insuficiente') }))
      const service = createDoseLogService({ client, getUserId })

      await expect(service.registerDose(baseLog)).rejects.toThrow('Estoque insuficiente')
    })

    it('double-click: RPC estrita aborta ocorrência já registrada → propaga erro', async () => {
      const client = makeClient(async () => ({ data: null, error: new Error('Ocorrência já registrada ou indisponível') }))
      const service = createDoseLogService({ client, getUserId })

      await expect(service.registerDose(baseLog, { instanceId: 'inst-1' })).rejects.toThrow('já registrada')
    })

    it('rejeita payload inválido sem chamar a RPC', async () => {
      const client = makeClient(async () => ({ data: {}, error: null }))
      const service = createDoseLogService({ client, getUserId })

      await expect(service.registerDose({ medicine_id: 'nao-uuid', quantity_taken: 1, taken_at: new Date().toISOString() }))
        .rejects.toThrow('Erro de validação')
      expect(client.rpc).not.toHaveBeenCalled()
    })
  })

  describe('undoDose', () => {
    it('com log atrelado delega à delete_dose_log_atomic', async () => {
      mockRepo.getById.mockResolvedValue({ id: 'inst-1', medicine_log_id: 'log-1', scheduled_for: new Date().toISOString(), tolerance_minutes: 30 })
      const client = makeClient(async () => ({ data: { success: true }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      const result = await service.undoDose('inst-1')

      expect(result.success).toBe(true)
      expect(client.rpc).toHaveBeenCalledWith('delete_dose_log_atomic', {
        p_user_id: mockUserId,
        p_log_id: 'log-1',
        p_default_tolerance_minutes: DEFAULT_TOLERANCE_MINUTES,
      })
    })

    it('ocorrência inexistente lança erro', async () => {
      mockRepo.getById.mockResolvedValue(null)
      const client = makeClient(async () => ({ data: null, error: null }))
      const service = createDoseLogService({ client, getUserId })

      await expect(service.undoDose('inst-x')).rejects.toThrow('não encontrado')
      expect(client.rpc).not.toHaveBeenCalled()
    })
  })

  describe('updateOrphanLog', () => {
    it('delega à RPC com campos parciais (null = preserva no banco)', async () => {
      const client = makeClient(async () => ({ data: { id: 'log-1', quantity_taken: 3 }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      const result = await service.updateOrphanLog('log-1', { quantity_taken: 3 })

      expect(result.quantity_taken).toBe(3)
      expect(client.rpc).toHaveBeenCalledWith(
        'update_dose_log_atomic',
        expect.objectContaining({ p_log_id: 'log-1', p_quantity_taken: 3, p_medicine_id: null, p_notes: null })
      )
    })

    it('propaga erro da RPC transacional (rollback no banco)', async () => {
      const client = makeClient(async () => ({ data: null, error: new Error('Estoque insuficiente') }))
      const service = createDoseLogService({ client, getUserId })

      await expect(service.updateOrphanLog('log-1', { quantity_taken: 99 })).rejects.toThrow('Estoque insuficiente')
    })

    it('limpar notes (null explícito) envia p_has_notes=true para a RPC', async () => {
      const client = makeClient(async () => ({ data: { id: 'log-1', notes: null }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      await service.updateOrphanLog('log-1', { notes: null })

      expect(client.rpc).toHaveBeenCalledWith(
        'update_dose_log_atomic',
        expect.objectContaining({ p_notes: null, p_has_notes: true, p_has_protocol: false })
      )
    })
  })

  describe('deleteOrphanLog', () => {
    it('delega à delete_dose_log_atomic', async () => {
      const client = makeClient(async () => ({ data: { success: true }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      const result = await service.deleteOrphanLog('log-1')

      expect(result.success).toBe(true)
      expect(client.rpc).toHaveBeenCalledWith(
        'delete_dose_log_atomic',
        expect.objectContaining({ p_log_id: 'log-1', p_default_tolerance_minutes: DEFAULT_TOLERANCE_MINUTES })
      )
    })
  })

  describe('registerDoseMany', () => {
    const mk = (q) => ({ medicine_id: MED, taken_at: new Date().toISOString(), quantity_taken: q })

    it('falha parcial: 2ª dose sem estoque não reverte 1ª e 3ª', async () => {
      let call = 0
      const client = makeClient(async () => {
        call += 1
        if (call === 2) return { data: null, error: new Error('Estoque insuficiente') }
        return { data: { id: `log-${call}` }, error: null }
      })
      const service = createDoseLogService({ client, getUserId })

      const results = await service.registerDoseMany([mk(1), mk(2), mk(3)])

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toMatch(/Estoque/)
      expect(results[2].success).toBe(true)
      expect(client.rpc).toHaveBeenCalledTimes(3)
    })

    it('ecoa instanceId em cada resultado (decopla side-effects de índice)', async () => {
      const client = makeClient(async () => ({ data: { id: 'log-1' }, error: null }))
      const service = createDoseLogService({ client, getUserId })

      const results = await service.registerDoseMany([{ ...mk(1), instance_id: 'inst-9' }])

      expect(results[0].instanceId).toBe('inst-9')
      expect(client.rpc).toHaveBeenCalledWith(
        'register_dose_atomic',
        expect.objectContaining({ p_dose_instance_id: 'inst-9', p_strict_anchor: false })
      )
    })

    it('lista vazia lança erro', async () => {
      const client = makeClient(async () => ({ data: {}, error: null }))
      const service = createDoseLogService({ client, getUserId })
      await expect(service.registerDoseMany([])).rejects.toThrow('Nenhuma dose')
    })
  })
})
