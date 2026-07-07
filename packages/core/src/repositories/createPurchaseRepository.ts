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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { validateStockCreate } from '../schemas/stockSchema'
import { computeAverageUnitPrice } from '../utils/stock'

interface ValidationError {
  field: string
  message: string
}

function fmtZodErr(errors: ValidationError[]) {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ')
}

interface CreatePurchaseRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

/**
 * Cria um repositório CRUD de compras parametrizado por plataforma.
 */
// Retorno anotado explicitamente (TS2742 — declaration emit não nomeia o tipo
// inferido do `.select()` dinâmico sem referenciar caminho interno de @dosiq/shared-data).
export function createPurchaseRepository({ client, getUserId }: CreatePurchaseRepositoryDeps): Record<string, (...args: any[]) => Promise<any>> {
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
    async getPurchasesByMedicine(medicineId: string) {
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
    async getLatestPurchasesByMedicineIds(medicineIds: string[]) {
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
      return (data || []).reduce((map: Record<string, any>, p: any) => {
        if (!map[p.medicine_id]) map[p.medicine_id] = p
        return map
      }, {})
    },

    /**
     * Histórico completo por medicineId (mapa medicineId → array de compras).
     * Web expõe; incluído pra paridade.
     */
    async getHistoryByMedicineIds(medicineIds: string[]) {
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
      return (data || []).reduce((map: Record<string, any[]>, p: any) => {
        if (!map[p.medicine_id]) map[p.medicine_id] = []
        map[p.medicine_id].push(p)
        return map
      }, {})
    },

    /**
     * Preço médio unitário ponderado por medicineId (mapa medicineId → preço).
     * Reusa computeAverageUnitPrice de @dosiq/core (lê quantity_bought ?? quantity).
     */
    async getAverageUnitPriceByMedicineIds(medicineIds: string[]) {
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
    async createPurchase(input: Record<string, unknown>) {
      const validation = validateStockCreate(input)
      if (!validation.success || !validation.data) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors ?? [])}`)
      const p = validation.data

      // NULL explícito (não omitir a key): o RPC espera receber NULL nos opcionais.
      // supabase gen tipa Args nullable como `| undefined` — cast local TODO(040-strict).
      const rpcArgs = {
        p_medicine_id: p.medicine_id,
        p_quantity: p.quantity,
        p_unit_price: p.unit_price ?? 0,
        p_purchase_date: p.purchase_date,
        p_expiration_date: p.expiration_date ?? null,
        p_pharmacy: p.pharmacy ?? null,
        p_laboratory: p.laboratory ?? null,
        p_notes: p.notes ?? null,
        p_injection_container: p.injection_container ?? null,
      }
      const { data, error } = await client.rpc('create_purchase_with_stock', rpcArgs as never)

      if (error) throw error
      return data
    },

    /**
     * Desmembra a compra de um líquido em N frascos: N chamadas a `createPurchase`
     * (1 purchase + 1 lote `stock` cada, `original_quantity = quantity = volumePerBottle`),
     * com `unit_price` = custo POR ML. FIFO opera frasco a frasco. Compensa centavos no
     * último frasco p/ o total reconstruído (Σ unit_price·volume) fechar exato (022 Fase B).
     *
     * @throws {Error} se numBottles/volumePerBottle inválidos ou validação Zod falhar.
     */
    async createLiquidPurchase(input: {
      medicineId: string
      numBottles: number
      volumePerBottle: number
      totalPrice?: number
      purchaseDate: string
      expirationDate?: string | null
      pharmacy?: string | null
      laboratory?: string | null
      notes?: string | null
      injectionContainer?: string | null
    }) {
      const {
        medicineId,
        numBottles,
        volumePerBottle,
        totalPrice = 0,
        purchaseDate,
        expirationDate = null,
        pharmacy = null,
        laboratory = null,
        notes = null,
        injectionContainer = null,
      } = input || {}

      // Guards de input degenerado (R-270): evitam loop vazio e divisão por zero.
      if (!Number.isInteger(numBottles) || numBottles <= 0) {
        throw new Error('Número de frascos deve ser um inteiro maior que zero')
      }
      if (typeof volumePerBottle !== 'number' || volumePerBottle <= 0) {
        throw new Error('Volume por frasco deve ser maior que zero')
      }
      if (typeof totalPrice !== 'number' || totalPrice < 0) {
        throw new Error('Preço total não pode ser negativo')
      }

      const round2 = (x: number) => Number(x.toFixed(2))
      const round4 = (x: number) => Number(x.toFixed(4))

      // Math.floor (não round2) p/ truncar: garante que pricePerBottle nunca exceda a fração
      // do total. Senão, em centavos baixos (ex: R$0,04 / 6 frascos) o arredondamento p/ cima
      // tornaria compensatedLast negativo → unit_price negativo (review #651).
      const pricePerBottle = Math.floor((totalPrice / numBottles) * 100) / 100
      // Último frasco absorve o resíduo (sempre >= 0) p/ fechar o total exato.
      const compensatedLast = round2(totalPrice - pricePerBottle * (numBottles - 1))
      const unitPriceMl = round4(pricePerBottle / volumePerBottle)
      const compensatedUnitPriceMl = round4(compensatedLast / volumePerBottle)

      const results = []
      for (let i = 0; i < numBottles; i++) {
        const isLast = i === numBottles - 1
        // Reusa createPurchase (validação Zod + RPC create_purchase_with_stock por lote).
        const data = await repo.createPurchase({
          medicine_id: medicineId,
          quantity: volumePerBottle,
          unit_price: isLast ? compensatedUnitPriceMl : unitPriceMl,
          purchase_date: purchaseDate,
          expiration_date: expirationDate,
          pharmacy,
          laboratory,
          notes,
          injection_container: injectionContainer,
        })
        results.push(data)
      }
      return results
    },

    /**
     * Edita uma purchase existente — APENAS metadados (preço, datas, farmácia,
     * lab, notas). NÃO altera `quantity_bought`: a quantidade está amarrada ao
     * lote em `stock` (saldo + FIFO) e qualquer correção de saldo passa pelo
     * fluxo dedicado "Acertar saldo" (PO-6). Editar quantidade aqui causaria
     * desync silencioso (sem trigger no DB que propague).
     */
    async updatePurchase(id: string, input: Record<string, unknown>) {
      const userId = await getUserId()
      const validation = validateStockCreate(input)
      if (!validation.success || !validation.data) throw new Error(`Erro de validação: ${fmtZodErr(validation.errors ?? [])}`)
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
          // 012 B4 (ADR-068): apresentação do lote editável na própria compra.
          injection_container: p.injection_container ?? null,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      // Propaga o container ao lote `stock` vinculado (fonte do rendimento por-lote).
      const { error: stockErr } = await client
        .from('stock')
        .update({ injection_container: p.injection_container ?? null })
        .eq('purchase_id', id)
        .eq('user_id', userId)
      if (stockErr) throw stockErr

      return data
    },
  }

  return repo
}
