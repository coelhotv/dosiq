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
import {
  ChevronLeft,
  Plus,
  Pill,
  PillBottle,
  SlidersHorizontal,
} from 'lucide-react-native'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import { stockService } from '@stock/services/stockService'
import { medicineService } from '@medications/services/medicineService'
import PurchaseCard from '@stock/components/PurchaseCard'
import StockIndicators from '@stock/components/StockIndicators'
import StockLevelBadge from '@stock/components/StockLevelBadge'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { computeAverageUnitPrice } from '@dosiq/core'
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
export default function StockDetailScreen({ navigation }) {
  const route = useRoute()
  const { medicineId, medicineName, dailyConsumption = 0 } = route.params ?? {}
  const { user } = useAuth()

  // — States (R-010) —
  const [saldo, setSaldo] = useState(0)
  const [purchases, setPurchases] = useState([])
  const [medicine, setMedicine] = useState(null)
  const [loading, setLoading] = useState(true)

  // — Memos (R-010) —
  const avgUnitPrice = useMemo(
    () => computeAverageUnitPrice(purchases),
    [purchases],
  )

  const daysRemaining = useMemo(
    () => (dailyConsumption > 0 ? Math.ceil(saldo / dailyConsumption) : null),
    [saldo, dailyConsumption],
  )

  // Badge "saldo em dias" (mesmo da listagem — StockLevelBadge usa enum UPPERCASE
  // + daysRemaining numérico; Infinity = sem consumo → "-- dias").
  const badgeDays = useMemo(
    () => (dailyConsumption > 0 ? saldo / dailyConsumption : Infinity),
    [saldo, dailyConsumption],
  )
  const badgeStatus = useMemo(() => {
    if (badgeDays < 7) return 'CRITICAL'
    if (badgeDays < 14) return 'LOW'
    if (badgeDays < 30) return 'NORMAL'
    return 'HIGH'
  }, [badgeDays])

  const isSupplement = useMemo(
    () => SUPPLEMENT_TYPES.has(medicine?.type),
    [medicine],
  )

  const latestPurchase = useMemo(() => purchases[0] ?? null, [purchases])

  // — Effects (R-010) —
  // SYNC callback obrigatório no useFocusEffect (NUNCA async direto — crash
  // "An effect function must not return anything besides a function").
  const fetchDetail = useCallback(async () => {
    const userId = user?.id
    if (!medicineId || !userId) return
    setLoading(true)
    try {
      const [qty, purchaseList, med] = await Promise.all([
        stockService.getTotalQuantity(medicineId),
        stockService.getPurchasesByMedicine(medicineId),
        medicineService.getById(medicineId),
      ])
      setSaldo(qty ?? 0)
      setPurchases(Array.isArray(purchaseList) ? purchaseList : [])
      setMedicine(med ?? null)
    } catch {
      setSaldo(0)
      setPurchases([])
      setMedicine(null)
    } finally {
      setLoading(false)
    }
  }, [medicineId, user])

  useFocusEffect(
    useCallback(() => {
      fetchDetail()
    }, [fetchDetail]),
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
    (purchaseId) => {
      navigation.navigate(ROUTES.PURCHASE_FORM, {
        mode: 'edit',
        purchaseId,
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
      ? `${medicine.dosage_per_pill}${medicine.dosage_unit ?? ''}`
      : null
  const heroColor = isSupplement ? colors.supplement[500] : colors.primary[500]
  const heroBg = isSupplement ? colors.supplement[50] : colors.primary[50]
  const HeroIcon = isSupplement ? PillBottle : Pill

  return (
    <ScreenContainer>
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
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
            onPress={handleAdjust}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Acertar saldo"
            hitSlop={8}
          >
            <SlidersHorizontal size={22} color={colors.text.primary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Card hero */}
            <View style={styles.heroCard}>
              <View style={[styles.heroIcon, { backgroundColor: heroBg }]}>
                <HeroIcon size={24} color={heroColor} />
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
                    <StockLevelBadge status={badgeStatus} daysRemaining={badgeDays} />
                  </View>
                ) : null}
              </View>
            </View>

            {/* Indicadores */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Indicadores</Text>
              <StockIndicators
                saldo={saldo}
                dailyConsumption={dailyConsumption}
                daysRemaining={daysRemaining}
                avgUnitPrice={avgUnitPrice}
              />
            </View>

            {/* Histórico de compras */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Histórico de compras</Text>
                {purchases.length > 0 ? (
                  <Pressable
                    onPress={handleHistory}
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
                  onPress={() => handleEditPurchase(latestPurchase.id)}
                />
              ) : (
                <Text style={styles.emptyText}>
                  Nenhuma compra registrada ainda.
                </Text>
              )}
            </View>
          </ScrollView>
        )}

        {/* FAB ubíquo (PO-2) — Registrar compra */}
        <Pressable
          onPress={handleRegisterPurchase}
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
