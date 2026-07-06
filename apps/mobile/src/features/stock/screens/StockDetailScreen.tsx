// StockDetailScreen.jsx — detalhe de estoque de UM medicamento (S2.1 Fase 3)
// R-010: ordem hooks → States → Memos → Effects → Handlers (TDZ crítico)
// ADR-028: StyleSheet canônico · ADR-023: fontWeight >= 400 · ADR-046: unidade(s)
// PO-2: FAB ubíquo "Registrar compra" · PO-3: med travado (passamos medicineId)
//
// Estrutura (mock mock-estoque-detalhes):
//   Header (voltar + nome + acertar saldo) → Card hero → Card saldo total
//   → Indicadores (KPI grid 2×2) → Histórico (preview última compra) → FAB.

import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useFocusEffect } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, Plus, SlidersHorizontal } = LucideIcons as any
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import { stockService } from '@stock/services/stockService'
import { medicineService } from '@medications/services/medicineService'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import PurchaseCard from '@stock/components/PurchaseCard'
import StockIndicators from '@stock/components/StockIndicators'
import StockLevelBadge from '@stock/components/StockLevelBadge'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { computeAverageUnitPrice, resolveStockStatus, getTodayLocal, isProtocolInPeriod, formatConcentration, isLiquidMedicine, doseToMl, frequencyDailyFactor, stockDoseMetrics } from '@dosiq/core'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

// Suplemento usa paridade visual laranja (igual web). Demais tipos = medicamento.
const SUPPLEMENT_TYPES = new Set(['suplemento', 'supplement'])

/**
 * Detalhe de estoque de um medicamento.
 *
 * route.params:
 *   medicineId: string         (obrigatório)
 *   medicineName: string       (display imediato no header)
 *   dailyConsumption: number   (consumo diário derivado do tratamento ativo)
 */
function DetailHeader({ name, onBack, onAdjust }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
      >
        <ChevronLeft size={26} color={colors.text.primary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {name}
      </Text>
      <Pressable
        onPress={onAdjust}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Acertar saldo"
        hitSlop={8}
      >
        <SlidersHorizontal size={22} color={colors.text.primary} />
      </Pressable>
    </View>
  )
}

function DetailHeroCard({ name, medicine, heroBg, heroColor, dosePill, dailyConsumption, badgeStatus, doseMetrics }) {
  return (
    <View style={styles.heroCard}>
      <View style={[styles.heroIcon, { backgroundColor: heroBg }]}>
        <MedicineIcon medicine={medicine} size={24} color={heroColor} />
      </View>
      <View style={styles.heroInfo}>
        <View style={styles.heroNameRow}>
          <Text style={styles.heroName} numberOfLines={2}>
            {name}
          </Text>
          {dosePill ? (
            <View style={styles.dosePill}>
              <Text style={styles.dosePillText}>{dosePill}</Text>
            </View>
          ) : null}
        </View>
        {medicine?.active_ingredient ? (
          <Text style={styles.heroLab} numberOfLines={1}>
            {medicine.active_ingredient}
          </Text>
        ) : null}
        {dailyConsumption > 0 ? (
          <View style={styles.heroBadge}>
            <StockLevelBadge
              status={badgeStatus}
              daysRemaining={doseMetrics.runwayDias}
              dosesRemaining={doseMetrics.dosesRemaining}
              isDailyStock={doseMetrics.isDaily}
            />
          </View>
        ) : null}
      </View>
    </View>
  )
}

function LatestPurchaseSection({ purchases, latestPurchase, medicine, stockEntryMap, onHistory, onEditPurchase }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Histórico de compras</Text>
        {purchases.length > 0 ? (
          <Pressable
            onPress={onHistory}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel="Ver todas as compras"
            hitSlop={8}
          >
            <Text style={styles.linkText}>VER TODAS</Text>
          </Pressable>
        ) : null}
      </View>
      {latestPurchase ? (
        <PurchaseCard
          purchase={latestPurchase}
          remaining={latestPurchase.remaining ?? 0}
          isLatest
          medicine={medicine}
          stockEntry={stockEntryMap[latestPurchase.id] ?? null}
          onPress={() => onEditPurchase(latestPurchase)}
        />
      ) : (
        <Text style={styles.emptyText}>
          Nenhuma compra registrada ainda.
        </Text>
      )}
    </View>
  )
}

function calculateDailyConsumption(medicine, paramConsumption, today) {
  if (!medicine?.protocols) return paramConsumption ?? 0
  const activeProtocols = medicine.protocols.filter(
    (p) => p.active && isProtocolInPeriod(p, today)
  )
  const liquid = isLiquidMedicine(medicine)
  return activeProtocols.reduce((acc, p) => {
    const intakesPerDay = p.time_schedule?.length ?? 0
    const perDose = liquid
      ? doseToMl(Number(p.dosage_per_intake ?? 0), p.intake_unit, medicine.units_per_ml, medicine.dosage_per_pill)
      : Number(p.dosage_per_intake ?? 0)
    return acc + perDose * intakesPerDay * frequencyDailyFactor(p)
  }, 0)
}

function calculateConsumoPorDiaDose(medicine, paramConsumption, today) {
  if (!medicine?.protocols) return paramConsumption ?? 0
  const liquid = isLiquidMedicine(medicine)
  return medicine.protocols
    .filter((p) => p.active && isProtocolInPeriod(p, today))
    .reduce((acc, p) => {
      const intakesPerDay = p.time_schedule?.length ?? 0
      const perDose = liquid
        ? Number(doseToMl(Number(p.dosage_per_intake ?? 0), p.intake_unit, medicine.units_per_ml, medicine.dosage_per_pill).toFixed(2))
        : Number(p.dosage_per_intake ?? 0)
      return acc + perDose * intakesPerDay
    }, 0)
}

function calculateIntakesPerDay(medicine, today) {
  if (!medicine?.protocols) return 0
  return medicine.protocols
    .filter((p) => p.active && isProtocolInPeriod(p, today))
    .reduce((acc, p) => acc + (p.time_schedule?.length ?? 0), 0)
}

function calculateBadgeStatus(saldo, dailyConsumption) {
  const status = resolveStockStatus(saldo, dailyConsumption)
  const statusMap = {
    critico: 'CRITICAL',
    baixo: 'LOW',
    normal: 'NORMAL',
    alto: 'HIGH',
    vencido: 'CRITICAL',
  }
  return statusMap[status] || 'NORMAL'
}

function useStockDetailState(route, navigation) {
  const { medicineId, medicineName } = route.params ?? {}
  const { user } = useAuth()

  // — States (R-010) —
  const [saldo, setSaldo] = useState(0)
  const [purchases, setPurchases] = useState([])
  const [medicine, setMedicine] = useState(null)
  const [loading, setLoading] = useState(true)
  // Mapa purchase_id → stock entry (com opened_at) para eixo TTL (012 Fase A)
  const [stockEntryMap, setStockEntryMap] = useState({})

  // — Memos (R-010) —
  const today = useMemo(() => getTodayLocal(), [])
  const dailyConsumption = useMemo(() => calculateDailyConsumption(medicine, route.params?.dailyConsumption, today), [medicine, route.params?.dailyConsumption, today])
  const consumoPorDiaDose = useMemo(() => calculateConsumoPorDiaDose(medicine, route.params?.dailyConsumption, today), [medicine, route.params?.dailyConsumption, today])

  const avgUnitPrice = useMemo(
    () => computeAverageUnitPrice(purchases),
    [purchases],
  )

  const intakesPerDay = useMemo(() => calculateIntakesPerDay(medicine, today), [medicine, today])

  const costPerDose = useMemo(() => {
    if (consumoPorDiaDose > 0 && intakesPerDay > 0 && avgUnitPrice > 0) {
      return (avgUnitPrice * consumoPorDiaDose) / intakesPerDay
    }
    return null
  }, [avgUnitPrice, consumoPorDiaDose, intakesPerDay])

  const daysRemaining = useMemo(
    () => (dailyConsumption > 0 ? Math.floor(saldo / dailyConsumption) : null),
    [saldo, dailyConsumption],
  )

  const doseMetrics = useMemo(() => {
    const active = (medicine?.protocols || []).filter((p) => p.active && isProtocolInPeriod(p, today))
    return stockDoseMetrics(saldo, active, medicine)
  }, [medicine, saldo, today])

  const badgeStatus = useMemo(() => calculateBadgeStatus(saldo, dailyConsumption), [saldo, dailyConsumption])

  const isSupplement = useMemo(
    () => SUPPLEMENT_TYPES.has(medicine?.type),
    [medicine],
  )

  const latestPurchase = useMemo(() => purchases[0] ?? null, [purchases])

  // — Effects (R-010) —
  useFocusEffect(
    useCallback(() => {
      const userId = user?.id
      if (!medicineId || !userId) return
      let cancelled = false
      setLoading(true)

      const run = async () => {
        try {
          const [qty, purchaseList, med, stockRows] = await Promise.all([
            stockService.getTotalQuantity(medicineId),
            stockService.getPurchasesByMedicine(medicineId),
            medicineService.getById(medicineId),
            supabase
              .from('stock')
              .select('id, purchase_id, quantity, opened_at')
              .eq('medicine_id', medicineId)
              .gt('quantity', 0)
              .then(({ data }) => data ?? []),
          ])
          if (cancelled) return
          setSaldo(qty ?? 0)
          setPurchases(Array.isArray(purchaseList) ? purchaseList : [])
          setMedicine(med ?? null)
          const entryMap = {}
          for (const row of stockRows) {
            if (row.purchase_id && !entryMap[row.purchase_id]) {
              entryMap[row.purchase_id] = row
            }
          }
          setStockEntryMap(entryMap)
        } catch {
          if (!cancelled) {
            setSaldo(0)
            setPurchases([])
            setMedicine(null)
            setStockEntryMap({})
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      run()
      return () => {
        cancelled = true
      }
    }, [medicineId, user]),
  )

  // — Handlers (R-010) —
  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleAdjust = useCallback(() => {
    navigation.navigate(ROUTES.STOCK_ADJUSTMENT, {
      medicineId,
      medicineName,
      currentBalance: saldo,
    })
  }, [navigation, medicineId, medicineName, saldo])

  const handleHistory = useCallback(() => {
    navigation.navigate(ROUTES.PURCHASE_HISTORY, { medicineId, medicineName })
  }, [navigation, medicineId, medicineName])

  const handleEditPurchase = useCallback(
    (purchase) => {
      navigation.navigate(ROUTES.PURCHASE_FORM, {
        mode: 'edit',
        purchaseId: purchase.id,
        purchase,
        medicineId,
        medicineName,
      })
    },
    [navigation, medicineId, medicineName],
  )

  const handleRegisterPurchase = useCallback(() => {
    navigation.navigate(ROUTES.PURCHASE_FORM, {
      mode: 'create',
      medicineId,
      medicineName,
    })
  }, [navigation, medicineId, medicineName])

  const name = medicine?.name ?? medicineName ?? 'Medicamento'
  const dosePill =
    medicine?.dosage_per_pill != null
      ? formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit, medicine.concentration_volume_ml)
      : null
  const heroColor = isSupplement ? colors.supplement[500] : colors.primary[500]
  const heroBg = isSupplement ? colors.supplement[50] : colors.primary[50]

  return {
    saldo,
    purchases,
    medicine,
    loading,
    stockEntryMap,
    dailyConsumption,
    consumoPorDiaDose,
    avgUnitPrice,
    costPerDose,
    daysRemaining,
    doseMetrics,
    badgeStatus,
    isSupplement,
    latestPurchase,
    handleBack,
    handleAdjust,
    handleHistory,
    handleEditPurchase,
    handleRegisterPurchase,
    name,
    dosePill,
    heroColor,
    heroBg,
  }
}

export default function StockDetailScreen({ navigation }) {
  const route = useRoute()
  const state = useStockDetailState(route, navigation)

  if (state.loading) {
    return (
      <ScreenContainer>
        <DetailHeader
          name={state.name}
          onBack={state.handleBack}
          onAdjust={state.handleAdjust}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <DetailHeader
          name={state.name}
          onBack={state.handleBack}
          onAdjust={state.handleAdjust}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Card hero */}
          <DetailHeroCard
            name={state.name}
            medicine={state.medicine}
            heroBg={state.heroBg}
            heroColor={state.heroColor}
            dosePill={state.dosePill}
            dailyConsumption={state.dailyConsumption}
            badgeStatus={state.badgeStatus}
            doseMetrics={state.doseMetrics}
          />

          {/* Indicadores */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Indicadores</Text>
            <StockIndicators
              saldo={state.saldo}
              dailyConsumption={state.consumoPorDiaDose}
              daysRemaining={state.daysRemaining}
              dosesRemaining={state.doseMetrics.dosesRemaining}
              isDailyStock={state.doseMetrics.isDaily}
              avgUnitPrice={state.avgUnitPrice}
              costPerDose={state.costPerDose}
              medicine={state.medicine}
            />
          </View>

          {/* Histórico de compras */}
          <LatestPurchaseSection
            purchases={state.purchases}
            latestPurchase={state.latestPurchase}
            medicine={state.medicine}
            stockEntryMap={state.stockEntryMap}
            onHistory={state.handleHistory}
            onEditPurchase={state.handleEditPurchase}
          />
        </ScrollView>

        {/* FAB ubíquo (PO-2) — Registrar compra */}
        <Pressable
          onPress={state.handleRegisterPurchase}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Registrar compra"
        >
          <Plus size={28} color={colors.text.inverse} />
        </Pressable>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  // Card hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: spacing[1],
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  dosePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  heroLab: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  heroBadge: {
    marginTop: spacing[1],
  },
  // Seções
  section: {
    gap: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[5],
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabPressed: {
    opacity: 0.9,
  },
})
