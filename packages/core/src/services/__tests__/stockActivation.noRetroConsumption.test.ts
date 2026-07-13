// stockActivation.noRetroConsumption.test.ts — spec 044, PO-3 (guard do épico).
//
// A promessa mais fácil de quebrar por acidente na F4b: "ligar o estoque não mexe no passado".
// O teste aqui NÃO é sobre a tela — é sobre o dado. Registra doses com o estoque DESLIGADO,
// ativa o controle informando o saldo, e verifica que:
//   1. a contagem de logs e de dose_instances é EXATAMENTE a mesma antes e depois (o guard);
//   2. o saldo final é o informado — as doses passadas NÃO foram descontadas dele;
//   3. a dose registrada DEPOIS da ativação decrementa normalmente (o FIFO ligou pra frente).

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createStockActivationService } from '../stockActivationService'

/** Banco de brinquedo: só o que o PO-3 promete proteger. */
function makeWorld({ pastLogs }: { pastLogs: number }) {
  const db = {
    logs: Array.from({ length: pastLogs }, (_, i) => ({ id: `log-${i}` })),
    doseInstances: Array.from({ length: pastLogs }, (_, i) => ({ id: `inst-${i}`, status: 'taken' })),
    balance: 0,
    trackingEnabled: false,
  }

  const profileRepo = {
    getStockTracking: vi.fn(async () => ({
      stock_tracking_enabled: db.trackingEnabled,
      stock_paused_at: null,
    })),
    setStockTracking: vi.fn(async (enabled: boolean) => {
      db.trackingEnabled = enabled
      return { stock_tracking_enabled: enabled, stock_paused_at: null }
    }),
  }

  const stockRepo = {
    getTotalQuantity: vi.fn(async () => db.balance),
    getStockSummaryMap: vi.fn(async () => ({ 'med-1': db.balance })),
    adjustToBalance: vi.fn(async (_medicineId: string, newBalance: number) => {
      const before = db.balance
      db.balance = newBalance
      return { delta: newBalance - before, before, after: newBalance }
    }),
    decreaseStock: vi.fn(async (_medicineId: string, quantity: number) => {
      // Só decrementa se o FIFO estiver ligado — é o que as RPCs atômicas fazem dentro da
      // transação desde a F1 (elas leem a preferência antes de tocar em estoque).
      if (db.trackingEnabled) db.balance -= quantity
      return { ok: true }
    }),
  }

  /** Registrar dose = append de log + instância; estoque só se o tracking estiver ligado. */
  async function registerDose(quantity: number) {
    db.logs.push({ id: `log-${db.logs.length}` })
    db.doseInstances.push({ id: `inst-${db.doseInstances.length}`, status: 'taken' })
    await stockRepo.decreaseStock('med-1', quantity)
  }

  return { db, profileRepo, stockRepo, registerDose }
}

describe('PO-3 — ativar o estoque NÃO retro-consome as doses passadas', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('contagem de logs/instâncias antes == depois, e o saldo informado permanece intacto', async () => {
    const { db, profileRepo, stockRepo } = makeWorld({ pastLogs: 12 })
    const service = createStockActivationService({
      profileRepo: profileRepo as any,
      stockRepo: stockRepo as any,
    })

    const logsBefore = db.logs.length
    const instancesBefore = db.doseInstances.length

    // O usuário conta 24 comprimidos na caixa e ativa.
    await service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 24 }])

    // 1. O GUARD: o passado não foi tocado.
    expect(db.logs.length).toBe(logsBefore)
    expect(db.doseInstances.length).toBe(instancesBefore)

    // 2. O saldo é o informado — as 12 doses de antes NÃO foram descontadas dele.
    expect(db.balance).toBe(24)
    expect(db.trackingEnabled).toBe(true)
  })

  it('a dose registrada DEPOIS da ativação decrementa (o FIFO ligou daqui pra frente)', async () => {
    const { db, profileRepo, stockRepo, registerDose } = makeWorld({ pastLogs: 12 })
    const service = createStockActivationService({
      profileRepo: profileRepo as any,
      stockRepo: stockRepo as any,
    })

    await service.activateWithInitialBalance([{ medicineId: 'med-1', quantity: 24 }])
    await registerDose(1)

    expect(db.balance).toBe(23)
    expect(db.logs.length).toBe(13) // a dose nova entrou; nenhuma antiga sumiu
  })

  it('doses registradas ANTES da ativação não decrementaram nada (baseline do modo dose-only)', async () => {
    const { db, registerDose } = makeWorld({ pastLogs: 0 })

    await registerDose(1)
    await registerDose(1)

    // Estoque desligado: as RPCs curto-circuitam a camada de estoque (F1).
    expect(db.balance).toBe(0)
    expect(db.logs.length).toBe(2)
  })
})
