import { parseLocalDate } from '@utils/dateUtils'
import { calculateDailyIntake, isBiologicallyExpired, biologicalExpiryDaysLeft, parseISO } from '@dosiq/core'

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

    // ── 012 Fase A: alerta de validade biológica (TTL pós-abertura) ──────────
    // Eixo PARALELO — não interfere no stockStatus de volume.
    // Busca o lote aberto (opened_at não-nulo) com quantity > 0 mais antigo.
    // Apenas medicamentos com shelf_life_days produzem alerta (helpers retornam false/null caso contrário).
    let ttlAlert = null
    if (medicine.shelf_life_days) {
      // Lote com quantidade > 0 e opened_at mais ANTIGO — é o primeiro a expirar
      // (entries chegam em created_at desc; .find() pegaria o mais recente e
      // subnotificaria o vencimento do frasco aberto antes).
      const openedLot = (stock.entries || [])
        .filter((e) => e.quantity > 0 && e.opened_at)
        .reduce((oldest, e) => (!oldest || e.opened_at < oldest.opened_at ? e : oldest), null)
      if (openedLot) {
        const expired = isBiologicallyExpired(openedLot, medicine)
        const daysLeft = biologicalExpiryDaysLeft(openedLot, medicine)
        if (expired) {
          // Dias abertos calculados direto de opened_at (review Gemini #658:
          // derivar de daysLeft já arredondado dobrava o arredondamento e inflava o texto)
          const opened = parseISO(openedLot.opened_at)
          const daysOpen = Number.isNaN(opened.getTime())
            ? null
            : Math.floor((Date.now() - opened.getTime()) / 86400000)
          ttlAlert = {
            type: 'expired',
            message: daysOpen != null
              ? `Aberto há ${daysOpen} dia${daysOpen !== 1 ? 's' : ''} — vencido (validade após aberto)`
              : 'Validade pós-abertura vencida',
          }
        } else if (daysLeft != null && daysLeft <= 3) {
          const dias = Math.ceil(daysLeft)
          ttlAlert = {
            type: 'expiring',
            message: dias <= 0
              ? 'Vence hoje (validade após aberto)'
              : `Vence em ${dias} dia${dias !== 1 ? 's' : ''} (validade após aberto)`,
          }
        }
      }
    }

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
      ttlAlert,
    }
  })
}
