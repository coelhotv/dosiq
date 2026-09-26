// medicineEvents.test.ts — casca de analytics do medicineService (spec 065 PR C2 / PO-5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

jest.mock('@dosiq/core', () => {
  const repo = { getAll: jest.fn(), getById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
  return { createMedicineRepository: () => repo, __repo: repo }
})

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))

import { medicineService } from '../medicineService'

const mockRepo = jest.requireMock('@dosiq/core').__repo

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('medicineService — eventos de medicamento', () => {
  it('create emite medicine_added com o id da LINHA escrita, nunca o nome', async () => {
    mockRepo.create.mockResolvedValue({ id: 'm-1', name: 'Losartana' })
    await medicineService.create({ name: 'Losartana' }, { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_added', { surface: 'mobile', medicine_id: 'm-1' })
  })

  it('update emite medicine_edited', async () => {
    mockRepo.update.mockResolvedValue({ id: 'm-1' })
    await medicineService.update('m-1', { units_per_ml: 5 }, { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_edited', { surface: 'mobile', medicine_id: 'm-1' })
  })

  it('delete emite medicine_deleted com o id do argumento', async () => {
    mockRepo.delete.mockResolvedValue(undefined)
    await medicineService.delete('m-9', { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_deleted', { surface: 'mobile', medicine_id: 'm-9' })
  })

  it('repo lança → nada emitido e o erro propaga', async () => {
    mockRepo.create.mockRejectedValue(new Error('23505'))
    mockRepo.delete.mockRejectedValue(new Error('23503'))
    await expect(medicineService.create({}, { surface: 'mobile' })).rejects.toThrow('23505')
    await expect(medicineService.delete('m-1', { surface: 'mobile' })).rejects.toThrow('23503')
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('sem surface → a chave fica FORA do payload (A-1, sem default)', async () => {
    mockRepo.create.mockResolvedValue({ id: 'm-1' })
    await medicineService.create({})
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_added', { medicine_id: 'm-1' })
  })

  it('linha sem id no update → cai no id do argumento', async () => {
    mockRepo.update.mockResolvedValue(null)
    await medicineService.update('m-2', {}, { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledWith('medicine_edited', { surface: 'mobile', medicine_id: 'm-2' })
  })
})
