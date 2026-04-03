/**
 * useStockData — Hook compartilhado de dados para views de Estoque
 * Reutilizado por Stock.jsx (legado) e StockRedesign.jsx (redesign).
 *
 * Fonte: extração de Stock.jsx linhas 30-228.
 * Implementa: getStockStatus(), getBarPercentage(), lastPurchase computado.
 */

import { useState, useEffect, useMemo } from 'react'
import { medicineService, stockService, protocolService } from '@shared/services'
import { purchaseService } from '@stock/services/purchaseService'
import { parseLocalDate } from '@utils/dateUtils'

// ─── Status Helpers (Exportados para testes) ─────────────────────────────────

/**
 * Calcula o status de urgência de estoque.
 * Baseado em: quantidade total == 0 OU dias restantes.
 *
 * @param {number} totalQuantity — quantidade total em estoque
 * @param {number} daysRemaining — dias de estoque (Infinity se sem protocolo ativo)
 * @returns {'urgente' | 'atencao' | 'seguro' | 'alto'}
 */
export function getStockStatus(totalQuantity, daysRemaining) {
  if (totalQuantity === 0) return 'urgente'
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return 'alto'
  if (daysRemaining <= 7) return 'urgente'
  if (daysRemaining <= 14) return 'atencao'
  return 'seguro'
}

/**
 * Calcula percentual da barra de progresso (0–100).
 * Baseado em dias: 30 dias = 100%, 0 dias = 0%.
 *
 * @param {number} totalQuantity
 * @param {number} daysRemaining
 * @returns {number} Percentual 0–100
 */
export function getBarPercentage(totalQuantity, daysRemaining) {
  if (totalQuantity === 0) return 0
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return 100
  return Math.round((daysRemaining / 30) * 100)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de dados para a view de Estoque.
 * Compartilhado por Stock.jsx (legado) e StockRedesign.jsx (redesign).
 *
 * @returns {Object} Dados processados de estoque + estado + handlers
 */
export function useStockData() {
  // 1. States
  const [medicines, setMedicines] = useState([])
  const [protocols, setProtocols] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [purchaseHistoryMap, setPurchaseHistoryMap] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // 2. Memos — Computar items, sub-listas por urgência
  const items = useMemo(() => {
    if (medicines.length === 0) return []

    const activeMedicineIds = new Set(protocols.map((p) => p.medicine_id))

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

    // Calcular consumo diário por medicamento
    const dailyIntakeMap = {}
    protocols
      .filter((p) => p.active !== false)
      .forEach((p) => {
        const daily = (p.dosage_per_intake || 0) * (p.time_schedule?.length || 0)
        dailyIntakeMap[p.medicine_id] = (dailyIntakeMap[p.medicine_id] || 0) + daily
      })

    return medicines.map((medicine) => {
      const stock = stockMap[medicine.id] || {
        entries: [],
        total: 0,
      }
      const purchases = purchaseHistoryMap[medicine.id] || []
      const dailyIntake = dailyIntakeMap[medicine.id] || 0
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
  }, [medicines, protocols, purchaseHistoryMap, stockMap])

  // Sub-listas por urgência — ordenadas por criticidade (menor dias primeiro)

  // Medicamentos órfãos: sem protocolo ativo, mas com estoque > 0
  const orphanItems = useMemo(
    () => items.filter((i) => !i.hasActiveProtocol && i.totalQuantity > 0),
    [items]
  )

  // Critical items: urgente MAS excluir (estoque 0 E sem protocolo ativo)
  // Racional: não fazem sentido como "críticos" se não há protocolo para reabastecimento
  const criticalItems = useMemo(
    () =>
      items
        .filter((i) => i.stockStatus === 'urgente')
        .filter((i) => !(i.totalQuantity === 0 && !i.hasActiveProtocol))
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const warningItems = useMemo(
    () =>
      items
        .filter((i) => i.stockStatus === 'atencao')
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const okItems = useMemo(
    () =>
      items
        .filter((i) => i.stockStatus === 'seguro')
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [items]
  )
  const highItems = useMemo(() => items.filter((i) => i.stockStatus === 'alto'), [items])

  // 3. Effects
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [medicinesData, protocolsData] = await Promise.all([
        medicineService.getAll(),
        protocolService.getActive(),
      ])

      setMedicines(medicinesData)
      setProtocols(protocolsData)

      // Fetch estoque em paralelo para todos os medicamentos
      const stockResults = await Promise.all(
        medicinesData.map(async (medicine) => {
          const entries = await stockService.getByMedicine(medicine.id)
          const total = entries.reduce((sum, e) => sum + e.quantity, 0)
          return { medicineId: medicine.id, entries, total }
        })
      )

      const map = {}
      stockResults.forEach(({ medicineId, entries, total }) => {
        map[medicineId] = { entries, total }
      })
      setStockMap(map)

      const purchaseHistory = await purchaseService.getHistoryByMedicineIds(
        medicinesData.map((medicine) => medicine.id)
      )
      setPurchaseHistoryMap(purchaseHistory)
    } catch (err) {
      setError('Erro ao carregar estoque: ' + err.message)
      console.error('[useStockData] Erro:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return {
    items,
    criticalItems,
    warningItems,
    okItems,
    highItems,
    orphanItems,
    medicines,
    protocols,
    isLoading,
    error,
    reload: loadData,
  }
}
