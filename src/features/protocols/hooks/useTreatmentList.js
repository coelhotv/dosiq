import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { adherenceService } from '@services/api/adherenceService'
import { stockService } from '@shared/services'
import { predictRefill } from '@stock/services/refillPredictionService'
import { getTitrationSummary, isTitrationActive, formatDose } from '@protocols/services/titrationService'
import { formatLocalDate } from '@utils/dateUtils'

const FREQUENCY_LABELS = {
  diario: 'Diário',
  diário: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
  'quando_necessário': 'Quando necessário',
}

const STOCK_STATUS_COLORS = {
  critical: '#ef4444',
  low: '#f59e0b',
  normal: '#22c55e',
  high: '#3b82f6',
}

/**
 * Derivar status de estoque (critical/low/normal/high) baseado em daysRemaining
 * CRÍTICO: usar Infinity para estoque ilimitado/sem consumo
 */
function getStockStatus(daysRemaining) {
  if (!isFinite(daysRemaining)) return 'high'
  if (daysRemaining < 7) return 'critical'
  if (daysRemaining < 14) return 'low'
  if (daysRemaining < 30) return 'normal'
  return 'high'
}

/**
 * Derivar tabStatus de um protocolo
 * CRÍTICO: usar parseLocalDate() para comparações de data, NUNCA new Date('YYYY-MM-DD')
 */
function resolveTabStatus(protocol) {
  const today = formatLocalDate(new Date())
  if (protocol.end_date && protocol.end_date < today) return 'finalizado'
  if (protocol.active === false) return 'pausado'
  return 'ativo'
}

/**
 * Resolver grupo (groupKey, label, emoji, cor) de um protocolo
 * Prioridade: treatment_plan > therapeutic_class > avulsos
 */
function resolveGroup(protocol) {
  if (protocol.treatment_plan) {
    return {
      groupKey: `plan:${protocol.treatment_plan.id}`,
      groupLabel: protocol.treatment_plan.name,
      groupEmoji: protocol.treatment_plan.emoji || '💊',
      groupColor: protocol.treatment_plan.color || '#6366f1',
    }
  }
  if (protocol.medicine?.therapeutic_class) {
    const slug = protocol.medicine.therapeutic_class.toLowerCase().replace(/\s+/g, '-')
    return {
      groupKey: `class:${slug}`,
      groupLabel: protocol.medicine.therapeutic_class,
      groupEmoji: '💊',
      groupColor: '#6366f1',
    }
  }
  return {
    groupKey: 'avulsos',
    groupLabel: 'Medicamentos Avulsos',
    groupEmoji: '💊',
    groupColor: '#94a3b8',
  }
}

export function useTreatmentList() {
  // Estados
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch todos os dados em paralelo
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = await getUserId()

      // Query 1: Todos os protocolos (ativos + pausados + finalizados)
      const { data: protocols, error: pErr } = await supabase
        .from('protocols')
        .select('*, medicine:medicines(*), treatment_plan:treatment_plans(id, name, emoji, color)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (pErr) throw pErr

      // Query 2: Adesão 7d por protocolo
      // calculateAllProtocolsAdherence retorna Array<{protocolId, name, score}>
      const adherenceList = await adherenceService.calculateAllProtocolsAdherence('7d', userId)
      const adherenceMap = Object.fromEntries(
        (adherenceList || []).map(a => [a.protocolId, a.score ?? 0])
      )

      // Query 3: Estoque por medicine_id único
      const uniqueMedicineIds = [...new Set(protocols.map(p => p.medicine_id))]
      const stockSummaries = await Promise.all(
        uniqueMedicineIds.map(id => stockService.getStockSummary(id))
      )
      const stockMap = Object.fromEntries(
        stockSummaries.map(s => [s.medicine_id, s.total_quantity || 0])
      )

      // Montar TreatmentItem[]
      const allItems = protocols.map(p => {
        const groupInfo = resolveGroup(p)
        const tabStatus = resolveTabStatus(p)
        const totalStock = stockMap[p.medicine_id] ?? 0
        const titSummary = getTitrationSummary(p)
        const hasTitration = isTitrationActive(p)

        // Calcular daysRemaining via predictRefill (sem logs neste hook — usa cálculo teórico)
        const { daysRemaining } = predictRefill({
          medicineId: p.medicine_id,
          currentStock: totalStock,
          logs: [],
          protocols: [p],
        })

        const dosageLabel = formatDose(
          p.dosage_per_intake,
          p.medicine?.dosage_unit || 'mg',
          p.medicine?.dosage_per_pill
        )

        // Próxima dose não-registrada (simplificado — comparar timeSchedule com hora atual)
        const now = new Date()
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`
        const times = Array.isArray(p.time_schedule) ? p.time_schedule : []
        const nextDoseTime = times.find(t => t > currentHHMM) || null

        return {
          id: p.id,
          medicineId: p.medicine_id,
          medicineName: p.medicine?.name || p.name,
          medicineType: p.medicine?.type || 'medicamento',
          dosageLabel,
          frequency: p.frequency,
          frequencyLabel: FREQUENCY_LABELS[p.frequency] || p.frequency,
          timeSchedule: times,
          nextDoseTime,
          isRegisteredToday: false,
          stockStatus: getStockStatus(daysRemaining),
          daysRemaining,
          adherenceScore7d: adherenceMap[p.id] ?? 0,
          hasTitration,
          titrationSummary: titSummary,
          notes: p.notes || null,
          treatmentPlanId: p.treatment_plan?.id || null,
          treatmentPlanName: p.treatment_plan?.name || null,
          treatmentPlanEmoji: p.treatment_plan?.emoji || '💊',
          treatmentPlanColor: p.treatment_plan?.color || '#6366f1',
          therapeuticClass: p.medicine?.therapeutic_class || null,
          ...groupInfo,
          active: p.active,
          endDate: p.end_date || null,
          tabStatus,
        }
      })

      setItems(allItems)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Derived states por tab
  const activeItems = useMemo(() => items.filter(i => i.tabStatus === 'ativo'), [items])
  const pausedItems = useMemo(() => items.filter(i => i.tabStatus === 'pausado'), [items])
  const finishedItems = useMemo(() => items.filter(i => i.tabStatus === 'finalizado'), [items])

  // Helper para computar grupos de qualquer lista de itens
  const computeGroups = (itemList) => {
    const map = new Map()
    for (const item of itemList) {
      if (!map.has(item.groupKey)) {
        map.set(item.groupKey, {
          groupKey: item.groupKey,
          groupLabel: item.groupLabel,
          groupEmoji: item.groupEmoji,
          groupColor: item.groupColor,
          items: [],
          hasAlert: false,
          isPlan: item.groupKey.startsWith('plan:'), // S7.5.5: detectar se é plano real
        })
      }
      const g = map.get(item.groupKey)
      g.items.push(item)
      if (item.stockStatus === 'critical' || item.stockStatus === 'low') g.hasAlert = true
    }
    return Array.from(map.values())
  }

  // Grupos para modo complexo (por tab)
  const activeGroups = useMemo(() => computeGroups(activeItems), [activeItems])
  const pausedGroups = useMemo(() => computeGroups(pausedItems), [pausedItems])
  const finishedGroups = useMemo(() => computeGroups(finishedItems), [finishedItems])

  return {
    items,
    activeItems,
    pausedItems,
    finishedItems,
    activeGroups,
    pausedGroups,
    finishedGroups,
    loading,
    error,
    refetch: fetchAll,
  }
}
