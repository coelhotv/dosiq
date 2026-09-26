// stockAddedEvent.test.ts — casca `stock_added` do stockService (spec 065 PR C2 / PO-5)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

jest.mock('@dosiq/core', () => {
  const purchaseRepo = { createPurchase: jest.fn(), createLiquidPurchase: jest.fn(), updatePurchase: jest.fn() }
  return {
    ...jest.requireActual('@dosiq/core'),
    createStockRepository: () => ({ adjustToBalance: jest.fn() }),
    createPurchaseRepository: () => purchaseRepo,
    __purchaseRepo: purchaseRepo,
  }
})

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}))

import { stockService } from '../stockService'

const mockRepo = jest.requireMock('@dosiq/core').__purchaseRepo

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('stockService — stock_added = compra', () => {
  it('compra emite stock_added com medicine_id, sem treatment_id (Decisão 6)', async () => {
    mockRepo.createPurchase.mockResolvedValue({ id: 'pu-1' })
    await stockService.createPurchase({ medicine_id: 'm-1', quantity: 30 }, { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('stock_added', { surface: 'mobile', medicine_id: 'm-1' })
  })

  it('líquido com N frascos → UM evento, não N', async () => {
    mockRepo.createLiquidPurchase.mockResolvedValue([{}, {}, {}])
    await stockService.createLiquidPurchase({ medicineId: 'm-2', numBottles: 3 }, { surface: 'mobile' })
    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('stock_added', { surface: 'mobile', medicine_id: 'm-2' })
  })

  it('RPC falha → nada emitido', async () => {
    mockRepo.createLiquidPurchase.mockRejectedValue(new Error('frasco 2'))
    await expect(stockService.createLiquidPurchase({ medicineId: 'm-2' }, { surface: 'mobile' })).rejects.toThrow()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('sem surface → chave ausente (A-1)', async () => {
    mockRepo.createPurchase.mockResolvedValue({})
    await stockService.createPurchase({ medicine_id: 'm-1' })
    expect(mockLogEvent).toHaveBeenCalledWith('stock_added', { medicine_id: 'm-1' })
  })

  it('edição de compra NÃO emite (não repõe estoque)', async () => {
    mockRepo.updatePurchase.mockResolvedValue({})
    await stockService.updatePurchase('pu-1', {})
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})
