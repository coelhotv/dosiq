import { parseLocalDate } from '@utils/dateUtils'
import { calculateDailyIntake, isBiologicallyExpired, biologicalExpiryDaysLeft, parseISO, stockDoseMetrics } from '@dosiq/core'

/**
 * Transforma dados brutos de medicamentos, protocolos e estoque em itens processados.
 * Extraído de useStockData.js para reduzir linhas e complexidade.
 */
function _getLotContainer(entries) {
  const lotEntries = entries || []
  return (
    lotEntries
      .filter((e) => e.quantity > 0 && e.opened_at && e.injection_container)
      .reduce((oldest, e) => (!oldest || e.opened_at < oldest.opened_at ? e : oldest), null)
      ?.injection_container ||
    lotEntries.find((e) => e.injection_container)?.injection_container ||
    null
  )
}

function _getLastPurchase(purchases) {
  const purchaseEntries = [...(purchases || [])].sort(
    (a, b) => parseLocalDate(b.purchase_date) - parseLocalDate(a.purchase_date)
  )
  const latestEntry = purchaseEntries[0] || null
  return {
    purchaseEntries,
    lastPurchase: latestEntry
      ? {
          date: latestEntry.purchase_date,
          unitPrice: latestEntry.unit_price ?? null,
          quantity: latestEntry.quantity_bought,
          pharmacy: latestEntry.pharmacy ?? null,
          laboratory: latestEntry.laboratory ?? null,
        }
      : null,
  }
}

function _getTtlAlert(entries, medicine) {
  if (!medicine.shelf_life_days) return null

  // Lote com quantidade > 0 e opened_at mais ANTIGO
  const openedLot = (entries || [])
    .filter((e) => e.quantity > 0 && e.opened_at)
    .reduce((oldest, e) => (!oldest || e.opened_at < oldest.opened_at ? e : oldest), null)

  if (!openedLot) return null

  const expired = isBiologicallyExpired(openedLot, medicine)
  const daysLeft = biologicalExpiryDaysLeft(openedLot, medicine)

  if (expired) {
    const opened = parseISO(openedLot.opened_at)
    const daysOpen = Number.isNaN(opened.getTime())
      ? null
      : Math.floor((Date.now() - opened.getTime()) / 86400000)
    return {
      type: 'expired',
      message: daysOpen != null
        ? `Aberto há ${daysOpen} dia${daysOpen !== 1 ? 's' : ''} — vencido (validade após aberto)`
        : 'Validade pós-abertura vencida',
    }
  }

  if (daysLeft != null && daysLeft <= 3) {
    const dias = Math.ceil(daysLeft)
    return {
      type: 'expiring',
      message: dias <= 0
        ? 'Vence hoje (validade após aberto)'
        : `Vence em ${dias} dia${dias !== 1 ? 's' : ''} (validade após aberto)`,
    }
  }

  return null
}

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
    // bater com o estoque (em ml). calculateDailyIntake is liquid-aware no core.
    const dailyIntake = calculateDailyIntake(medicine.id, protocols, medicine)
    const daysRemaining = dailyIntake > 0 ? stock.total / dailyIntake : Infinity
    const stockStatus = getStockStatus(stock.total, daysRemaining)
    const barPercentage = getBarPercentage(stock.total, daysRemaining)

    // 012 B4 / ADR-067: doses físicas restantes (número exibido p/ freq ≠ diário).
    // Cor/barra seguem runway (daysRemaining); diário mantém "N dias" (sem regressão).
    const medProtocols = protocols.filter((p) => p.medicine_id === medicine.id && p.active !== false)
    const { dosesRemaining, isDaily } = stockDoseMetrics(stock.total, medProtocols, medicine)

    const lotContainer = _getLotContainer(stock.entries)
    const { purchaseEntries, lastPurchase } = _getLastPurchase(purchases)
    const ttlAlert = _getTtlAlert(stock.entries, medicine)

    return {
      medicine: {
        id: medicine.id,
        name: medicine.name,
        dosage_per_pill: medicine.dosage_per_pill,
        dosage_unit: medicine.dosage_unit || 'mg',
        concentration_volume_ml: medicine.concentration_volume_ml ?? null,
        units_per_ml: medicine.units_per_ml ?? null,
        type: medicine.type || 'medicamento',
        // Forma farmacêutica p/ ícone canônico (getMedicineIconName) no card
        presentation: medicine.presentation ?? null,
        shelf_life_days: medicine.shelf_life_days ?? null,
        // 012 B4 (ADR-068): apresentação derivada do lote ativo (não mais do medicine).
        injection_container: lotContainer,
      },
      entries: stock.entries,
      purchases: purchaseEntries,
      totalQuantity: stock.total,
      dailyIntake,
      daysRemaining,
      dosesRemaining,
      isDailyStock: isDaily,
      stockStatus,
      hasActiveProtocol: activeMedicineIds.has(medicine.id),
      primaryProtocol: primaryProtocolMap[medicine.id] || null,
      barPercentage,
      lastPurchase,
      ttlAlert,
    }
  })
}
