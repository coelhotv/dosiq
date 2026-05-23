// purchaseService.js — Adapter web sobre createPurchaseRepository (S3.2 G3).
//
// G3: a lógica de compras (queries + média ponderada) foi extraída para
// createPurchaseRepository em @dosiq/core. Este adapter injeta client/getUserId
// da sessão web e expõe a API histórica do web delegando à factory.
//
// Nota: getByMedicine agora embute o lote (`stock(quantity)`) e calcula
// `remaining` por compra (igual mobile) — campo aditivo, consumidores antigos
// seguem funcionando. A média ponderada usa computeAverageUnitPrice canônico
// de @dosiq/core (lê quantity_bought ?? quantity).

import { supabase, getUserId } from '@shared/utils/supabase'
import { createPurchaseRepository } from '@dosiq/core'

const purchaseRepo = createPurchaseRepository({ client: supabase, getUserId })

export const purchaseService = {
  getByMedicine: (medicineId) => purchaseRepo.getPurchasesByMedicine(medicineId),
  getLatestByMedicineIds: (medicineIds) =>
    purchaseRepo.getLatestPurchasesByMedicineIds(medicineIds),
  getHistoryByMedicineIds: (medicineIds) =>
    purchaseRepo.getHistoryByMedicineIds(medicineIds),
  getAverageUnitPriceByMedicineIds: (medicineIds) =>
    purchaseRepo.getAverageUnitPriceByMedicineIds(medicineIds),
  create: (input) => purchaseRepo.createPurchase(input),
}
