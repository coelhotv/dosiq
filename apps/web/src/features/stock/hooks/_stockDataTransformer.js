import { parseLocalDate } from '@utils/dateUtils'
import { calculateDailyIntake } from '@dosiq/core'

/**
 * Transforma dados brutos de medicamentos, protocolos e estoque em itens processados.
 * Extraído de useStockData.js para reduzir linhas e complexidade.
 */
export function transformStockItems(medicines, protocols, stockMap, purchaseHistoryMap, getStockStatus, getBarPercentage) {
  if (medicines.length === 0) return []

  const activeMedicineIds = new Set(
    protocols.filter((p) => p.active !== false).map((p) => p.medicine_id)
  )

  // Mapa: medicineId → protocolo primário (primeiro ativo)
  const primaryProtocolMap = {}
  protocols
    .filter((p) => p.active !== false)
    .forEach((p) => {
      if (!primaryProtocolMap[p.medicine_id]) {
        primaryProtocolMap[p.medicine_id] = {
          name: p.name,
          time_schedule: p.time_schedule || [],
          dosage_per_intake: p.dosage_per_intake || 0,
        }
      }
    })

  return medicines.map((medicine) => {
    const stock = stockMap[medicine.id] || {
      entries: [],
      total: 0,
    }
    const purchases = purchaseHistoryMap[medicine.id] || []
    // Líquidos (022): consumo convertido p/ ml (gotas/UI ÷ units_per_ml) para
    // bater com o estoque (em ml). calculateDailyIntake é liquid-aware no core.
    const dailyIntake = calculateDailyIntake(medicine.id, protocols, medicine)
    const daysRemaining = dailyIntake > 0 ? stock.total / dailyIntake : Infinity
    const stockStatus = getStockStatus(stock.total, daysRemaining)
    const barPercentage = getBarPercentage(stock.total, daysRemaining)

    const purchaseEntries = [...purchases].sort(
      (a, b) => parseLocalDate(b.purchase_date) - parseLocalDate(a.purchase_date)
    )
    const latestEntry = purchaseEntries[0] || null
    const lastPurchase = latestEntry
      ? {
          date: latestEntry.purchase_date,
          unitPrice: latestEntry.unit_price ?? null,
          quantity: latestEntry.quantity_bought,
          pharmacy: latestEntry.pharmacy ?? null,
          laboratory: latestEntry.laboratory ?? null,
        }
      : null

    return {
      medicine: {
        id: medicine.id,
        name: medicine.name,
        dosage_per_pill: medicine.dosage_per_pill,
        dosage_unit: medicine.dosage_unit || 'mg',
        units_per_ml: medicine.units_per_ml ?? null,
        type: medicine.type || 'medicamento',
      },
      entries: stock.entries,
      purchases: purchaseEntries,
      totalQuantity: stock.total,
      dailyIntake,
      daysRemaining,
      stockStatus,
      hasActiveProtocol: activeMedicineIds.has(medicine.id),
      primaryProtocol: primaryProtocolMap[medicine.id] || null,
      barPercentage,
      lastPurchase,
    }
  })
}
