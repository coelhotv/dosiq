// createPurchaseRepository.js — Factory CRUD canônico de compras (Fase 3 S3.2 G2).
//
// Espelha o pattern de createProtocolRepository (Fase 2 G2).
// Fonte de verdade do comportamento: stockService mobile consolidado (S3.1).
// Validação Zod create é canônica (via @dosiq/core stockSchema).
//
// Métodos (nomes mobile — sem param userId, resolvido via getUserId injetado):
// - getPurchasesByMedicine(medicineId)               → embed stock(quantity), map remaining
// - getLatestPurchasesByMedicineIds(medicineIds)     → mapa medicineId → última compra
// - getHistoryByMedicineIds(medicineIds)             → mapa medicineId → array (web; paridade)
// - getAverageUnitPriceByMedicineIds(medicineIds)    → preço médio ponderado (computeAverageUnitPrice)
// - createPurchase(input)                            → validateStockCreate + RPC create_purchase_with_stock
// - updatePurchase(id, input)                        → update metadados (NÃO quantity_bought)

import { validateStockCreate } from '../schemas/stockSchema.js'
import { computeAverageUnitPrice } from '../utils/stock.js'

function fmtZodErr(errors) {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ')
}

/**
 * Cria um repositório CRUD de compras parametrizado por plataforma.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase.
 * @param {Function} deps.getUserId  Async () => string. Resolve user_id da sessão.
 */
export function createPurchaseRepository({ client, getUserId }) {
  if (!client) throw new Error('createPurchaseRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createPurchaseRepository: getUserId deve ser função async')
  }

  const repo = {
    /**
     * Histórico de compras de um medicamento.
     * Embed do lote em `stock` (FK stock.purchase_id → purchases.id) pra expor o
     * saldo restante de cada compra. `remaining` = soma das entries do lote
     * (normalmente 1). Sem isso o PurchaseCard mostrava sempre "0 restantes".
     */
    async getPurchasesByMedicine(medicineId) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('purchases')
        .select('*, stock(quantity)')
        .eq('medicine_id', medicineId)
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((p) => ({
        ...p,
        remaining: (p.stock || []).reduce((acc, s) => acc + (Number(s.quantity) || 0), 0),
      }))
    },

    /**
     * Última compra de cada medicineId (mapa medicineId → purchase).
     */
    async getLatestPurchasesByMedicineIds(medicineIds) {
      if (!medicineIds || medicineIds.length === 0) return {}
      const userId = await getUserId()
      const { data, error } = await client
        .from('purchases')
        .select('*')
        .eq('user_id', userId)
        .in('medicine_id', medicineIds)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).reduce((map, p) => {
        if (!map[p.medicine_id]) map[p.medicine_id] = p
        return map
      }, {})
    },

    /**
     * Histórico completo por medicineId (mapa medicineId → array de compras).
     * Web expõe; incluído pra paridade.
     */
    async getHistoryByMedicineIds(medicineIds) {
      if (!medicineIds || medicineIds.length === 0) return {}
      const userId = await getUserId()
      const { data, error } = await client
        .from('purchases')
        .select('*')
        .eq('user_id', userId)
        .in('medicine_id', medicineIds)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).reduce((map, p) => {
        if (!map[p.medicine_id]) map[p.medicine_id] = []
        map[p.medicine_id].push(p)
        return map
      }, {})
    },

    /**
     * Preço médio unitário ponderado por medicineId (mapa medicineId → preço).
     * Reusa computeAverageUnitPrice de @dosiq/core (lê quantity_bought ?? quantity).
     */
    async getAverageUnitPriceByMedicineIds(medicineIds) {
      if (!medicineIds || medicineIds.length === 0) return {}
      const historyByMedicine = await repo.getHistoryByMedicineIds(medicineIds)
      return Object.fromEntries(
        Object.entries(historyByMedicine).map(([medicineId, entries]) => [
          medicineId,
          computeAverageUnitPrice(entries),
        ]),
      )
    },

    /**
     * Cria compra + atualiza saldo (atômico via RPC).
     * @throws {Error} se validation Zod falhar
     */
    async createPurchase(input) {
      const validation = validateStockCreate(input)
      if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
      const p = validation.data

      const { data, error } = await client.rpc('create_purchase_with_stock', {
        p_medicine_id: p.medicine_id,
        p_quantity: p.quantity,
        p_unit_price: p.unit_price ?? 0,
        p_purchase_date: p.purchase_date,
        p_expiration_date: p.expiration_date,
        p_pharmacy: p.pharmacy,
        p_laboratory: p.laboratory,
        p_notes: p.notes,
      })

      if (error) throw error
      return data
    },

    /**
     * Edita uma purchase existente — APENAS metadados (preço, datas, farmácia,
     * lab, notas). NÃO altera `quantity_bought`: a quantidade está amarrada ao
     * lote em `stock` (saldo + FIFO) e qualquer correção de saldo passa pelo
     * fluxo dedicado "Acertar saldo" (PO-6). Editar quantidade aqui causaria
     * desync silencioso (sem trigger no DB que propague).
     */
    async updatePurchase(id, input) {
      const userId = await getUserId()
      const validation = validateStockCreate(input)
      if (!validation.success) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors)}`)
      const p = validation.data

      const { data, error } = await client
        .from('purchases')
        .update({
          unit_price: p.unit_price ?? 0,
          purchase_date: p.purchase_date,
          expiration_date: p.expiration_date,
          pharmacy: p.pharmacy,
          laboratory: p.laboratory,
          notes: p.notes,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    },
  }

  return repo
}
