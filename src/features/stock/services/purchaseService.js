import { supabase, getUserId } from '@shared/utils/supabase'
import { validateStockCreate } from '@schemas/stockSchema'

function calculateWeightedAverage(entries = []) {
  const validEntries = entries.filter(
    (entry) => (entry.quantity_bought ?? 0) > 0 && (entry.unit_price ?? 0) > 0
  )

  if (validEntries.length === 0) return 0

  const totalValue = validEntries.reduce(
    (sum, entry) => sum + entry.unit_price * entry.quantity_bought,
    0
  )
  const totalQuantity = validEntries.reduce((sum, entry) => sum + entry.quantity_bought, 0)

  return totalQuantity > 0 ? totalValue / totalQuantity : 0
}

function groupLatestByMedicine(entries = []) {
  return entries.reduce((map, entry) => {
    if (!map[entry.medicine_id]) {
      map[entry.medicine_id] = entry
    }
    return map
  }, {})
}

function groupHistoryByMedicine(entries = []) {
  return entries.reduce((map, entry) => {
    if (!map[entry.medicine_id]) {
      map[entry.medicine_id] = []
    }
    map[entry.medicine_id].push(entry)
    return map
  }, {})
}

export const purchaseService = {
  async getByMedicine(medicineId) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('medicine_id', medicineId)
      .eq('user_id', await getUserId())
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getLatestByMedicineIds(medicineIds = []) {
    if (!medicineIds.length) return {}

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', await getUserId())
      .in('medicine_id', medicineIds)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return groupLatestByMedicine(data || [])
  },

  async getHistoryByMedicineIds(medicineIds = []) {
    if (!medicineIds.length) return {}

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', await getUserId())
      .in('medicine_id', medicineIds)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return groupHistoryByMedicine(data || [])
  },

  async getAverageUnitPriceByMedicineIds(medicineIds = []) {
    if (!medicineIds.length) return {}

    const historyByMedicine = await this.getHistoryByMedicineIds(medicineIds)

    return Object.fromEntries(
      Object.entries(historyByMedicine).map(([medicineId, entries]) => [
        medicineId,
        calculateWeightedAverage(entries),
      ])
    )
  },

  async create(input) {
    const validation = validateStockCreate(input)
    if (!validation.success) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const payload = validation.data
    const { data, error } = await supabase.rpc('create_purchase_with_stock', {
      p_medicine_id: payload.medicine_id,
      p_quantity: payload.quantity,
      p_unit_price: payload.unit_price ?? 0,
      p_purchase_date: payload.purchase_date,
      p_expiration_date: payload.expiration_date,
      p_pharmacy: payload.pharmacy,
      p_laboratory: payload.laboratory,
      p_notes: payload.notes,
    })

    if (error) throw error
    return data
  },
}
