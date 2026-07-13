// stockActivationService.test.ts — spec 044 T017 (PO-3)
//
// O guard central: ativar o estoque NÃO retro-consome. O serviço só pode tocar `stock`
// (ajustes append-only) e a preferência — nunca logs / dose_instances.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { INITIAL_BALANCE_REASON, createStockActivationService } from '../stockActivationService'

function makeDeps() {
  const profileRepo = {
    getStockTracking: vi.fn(async () => ({ stock_tracking_enabled: false, stock_paused_at: null })),
    setStockTracking: vi.fn(async (enabled: boolean) => ({
      stock_tracking_enabled: enabled,
      stock_paused_at: null,
    })),
  }
  const stockRepo = {
    adjustToBalance: vi.fn(async (_id: string, balance: number) => ({ delta: balance, before: 0, after: balance })),
    getStockSummaryMap: vi.fn(async () => ({})),
    delete: vi.fn(),
  }
  return { profileRepo, stockRepo }
}

describe('createStockActivationService', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('escreve o saldo informado de cada medicamento e só então liga a preferência', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    const result = await service.activateWithInitialBalance([
      { medicineId: 'med-1', quantity: 24 },
      { medicineId: 'med-2', quantity: 60 },
    ])

    expect(stockRepo.adjustToBalance).toHaveBeenCalledTimes(2)
    expect(stockRepo.adjustToBalance).toHaveBeenCalledWith('med-1', 24, INITIAL_BALANCE_REASON)
    expect(stockRepo.adjustToBalance).toHaveBeenCalledWith('med-2', 60, INITIAL_BALANCE_REASON)
    expect(profileRepo.setStockTracking).toHaveBeenCalledWith(true)
    expect(result).toEqual({ countedMedicineIds: ['med-1', 'med-2'], skipped: 0 })

    // Ordem: saldo ANTES da preferência (senão o FIFO liga sobre saldo parcial).
    const adjustOrder = stockRepo.adjustToBalance.mock.invocationCallOrder[1]
    const enableOrder = profileRepo.setStockTracking.mock.invocationCallOrder[0]
    expect(adjustOrder).toBeLessThan(enableOrder)
  })

  it('skip por item: medicamento fora da lista não vira ajuste nenhum', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    // "Não quero contar este" = simplesmente não entra na lista.
    await service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 24 }])

    expect(stockRepo.adjustToBalance).toHaveBeenCalledTimes(1)
    expect(stockRepo.adjustToBalance).not.toHaveBeenCalledWith('med-2', expect.anything(), expect.anything())
  })

  it('ativa sem NENHUM saldo informado (não exige preencher todos)', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    const result = await service.activateWithInitialBalance([])

    expect(stockRepo.adjustToBalance).not.toHaveBeenCalled()
    expect(profileRepo.setStockTracking).toHaveBeenCalledWith(true)
    expect(result.countedMedicineIds).toEqual([])
  })

  it('saldo zero é informado de verdade (0 ≠ pulado)', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    await service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 0 }])

    expect(stockRepo.adjustToBalance).toHaveBeenCalledWith('med-1', 0, INITIAL_BALANCE_REASON)
  })

  it('quantidade degenerada (NaN / negativa / sem id) é descartada — nunca vira RPC', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    const result = await service.activateWithInitialBalance([
      { medicineId: 'med-1', quantity: Number.NaN },
      { medicineId: 'med-2', quantity: -5 },
      { medicineId: '', quantity: 10 },
      { medicineId: 'med-4', quantity: 12 },
    ])

    expect(stockRepo.adjustToBalance).toHaveBeenCalledTimes(1)
    expect(stockRepo.adjustToBalance).toHaveBeenCalledWith('med-4', 12, INITIAL_BALANCE_REASON)
    expect(result.skipped).toBe(3)
  })

  it('falha ao escrever um saldo deixa a preferência OFF (nunca liga o FIFO sobre saldo parcial)', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    stockRepo.adjustToBalance.mockRejectedValueOnce(new Error('rede caiu'))
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    await expect(
      service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 24 }]),
    ).rejects.toThrow('rede caiu')

    expect(profileRepo.setStockTracking).not.toHaveBeenCalled()
  })

  it('SEM RETRO-CONSUMO (PO-3): nenhum repositório de log/dose_instance é sequer alcançável', async () => {
    const { profileRepo, stockRepo } = makeDeps()
    const service = createStockActivationService({ profileRepo: profileRepo as any, stockRepo: stockRepo as any })

    await service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 24 }])

    // O serviço recebe SÓ profileRepo + stockRepo: não há superfície por onde apagar/reprocessar
    // uma dose passada. As únicas escritas são o ajuste de saldo e a preferência.
    expect(Object.keys(stockRepo).filter((k) => (stockRepo as any)[k].mock?.calls.length)).toEqual([
      'adjustToBalance',
    ])
    expect(stockRepo.delete).not.toHaveBeenCalled()
  })
})
