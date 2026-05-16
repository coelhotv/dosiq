// medicineService.js — CRUD web via factory canônica @dosiq/core (Fase 1 G2 web).
//
// Preset web injeta selects (stock+purchases) + transforms (avg_price).
// Schemas/validações via @dosiq/core — compartilhados web↔mobile.
//
// VALIDAÇÃO ZOD: dados validados antes de enviar ao Supabase.
// Erros retornam mensagens PT-BR; nenhum payload inválido chega ao backend.

import { createMedicineRepository } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'
import { calculateAvgUnitPrice } from '@stock/services/costAnalysisService'

// purchases é fonte canônica de custo médio; fallback para stock mantém compatibilidade
// enquanto migration de dados históricos não está completa.
function getPriceEntries(medicine) {
  if (Array.isArray(medicine.purchases) && medicine.purchases.length > 0) {
    return medicine.purchases
  }
  return medicine.stock || []
}

function withAvgPrice(medicine) {
  return {
    ...medicine,
    avg_price: calculateAvgUnitPrice(getPriceEntries(medicine)) || null,
  }
}

export const medicineService = createMedicineRepository({
  client: supabase,
  getUserId,
  listSelect: `
    *,
    stock(*),
    purchases(*)
  `,
  detailSelect: `
    *,
    stock(*),
    purchases(*)
  `,
  listTransform: (rows) => rows.map(withAvgPrice),
  detailTransform: withAvgPrice,
})
