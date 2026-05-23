// stockService.js — Adapter web sobre as factories de @dosiq/core (S3.2 G3).
//
// G3: a lógica CRUD de estoque foi extraída para createStockRepository /
// createPurchaseRepository em @dosiq/core (fonte única web↔mobile). Este módulo
// é um adapter fino que injeta o client/getUserId da sessão web e expõe a API
// histórica do web (add/decrease/increase/...) delegando aos métodos da factory
// (nomes canônicos mobile: createPurchase/decreaseStock/increaseStock).
//
// Mantido como adapter (e não removido) pra preservar todos os callers web +
// cachedServices + testes sem churn. Validação Zod é canônica via @dosiq/core.

import { supabase, getUserId } from '@shared/utils/supabase'
import { createStockRepository, createPurchaseRepository } from '@dosiq/core'

const stockRepo = createStockRepository({ client: supabase, getUserId })
const purchaseRepo = createPurchaseRepository({ client: supabase, getUserId })

export const stockService = {
  getByMedicine: (medicineId) => stockRepo.getByMedicine(medicineId),
  getTotalQuantity: (medicineId) => stockRepo.getTotalQuantity(medicineId),
  getStockSummary: (medicineId) => stockRepo.getStockSummary(medicineId),
  getLowStockMedicines: (threshold) => stockRepo.getLowStockMedicines(threshold),
  // `add` = criar compra (cria entrada real em stock via RPC create_purchase_with_stock)
  add: (stock) => purchaseRepo.createPurchase(stock),
  decrease: (medicineId, quantity, medicineLogId) =>
    stockRepo.decreaseStock(medicineId, quantity, medicineLogId),
  increase: (medicineId, quantity, options) =>
    stockRepo.increaseStock(medicineId, quantity, options),
  delete: (id) => stockRepo.delete(id),
}
