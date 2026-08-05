// PurchaseHistoryScreen.jsx — histórico de compras de um medicamento (S1.6 Wave 3)
// R-010: ordem obrigatória hooks → States → Memos → Effects → Handlers
// R-235: sem hook dedicado para histórico ainda; chama stockService direto (documentado)
// ADR-028: StyleSheet canônico · ADR-023: fontWeight >= 400 · ADR-046: unidade(s)

import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft } = LucideIcons as any
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import EmptyState from '@shared/components/states/EmptyState'
import PurchaseCard from '@stock/components/PurchaseCard'
import { stockService } from '@stock/services/stockService'
import { medicineService } from '@medications/services/medicineService'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { computeAverageUnitPrice, formatBRL, formatConcentration, isLiquidMedicine, stockUnitLabel, formatNumberPtBR } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

/**
 * Histórico de compras de um medicamento.
 *
 * route.params:
 *   medicineId: string       (obrigatório)
 *   medicineName: string     (display no header)
 */
function HistoryHeaderComponent({ medicine, medicineName, isLiquid, totalBought, totalCount, avgUnitPrice, unitLabel }) {
  return (
    <>
      {/* Card de contexto do medicamento */}
      <View style={styles.medicineCard}>
        <View style={styles.medicineIcon}>
          <MedicineIcon
            medicine={medicine}
            size={22}
            color={medicine?.type === 'suplemento' ? colors.supplement[500] : colors.primary[500]}
            strokeWidth={2}
          />
        </View>
        <View style={styles.medicineInfo}>
          <View style={styles.medicineNameRow}>
            <Text style={styles.medicineName} numberOfLines={2}>
              {medicine?.name ?? medicineName ?? 'Medicamento'}
            </Text>
            {medicine?.dosage_per_pill ? (
              <View style={styles.dosePill}>
                <Text style={styles.dosePillText}>
                  {formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit, medicine.concentration_volume_ml)}
                </Text>
              </View>
            ) : null}
          </View>
          {medicine?.active_ingredient ? (
            <Text style={styles.medicineSub} numberOfLines={1}>
              {medicine.active_ingredient}
            </Text>
          ) : null}
          <Text style={styles.pageSubtitle}>Histórico de compras</Text>
        </View>
      </View>

      {/* Cards de resumo — visíveis apenas quando há dados */}
      {totalCount > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalCount}</Text>
            <Text style={styles.summaryLabel}>Compra{totalCount !== 1 ? 's' : ''}</Text>
          </View>

          <View style={styles.summaryCard}>
            {/* ADR-046 — unidade(s) · líquido em ml (022) */}
            <Text style={styles.summaryValue}>
              {isLiquid ? formatNumberPtBR(totalBought) : totalBought}
            </Text>
            <Text style={styles.summaryLabel}>
              {isLiquid
                ? 'ml comprados'
                : `Unidade${totalBought !== 1 ? 's' : ''} comprada${totalBought !== 1 ? 's' : ''}`}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatBRL(avgUnitPrice)}</Text>
            <Text style={styles.summaryLabel}>Custo médio/{unitLabel}</Text>
          </View>
        </View>
      )}

      {totalCount > 0 && (
        <Text style={styles.sectionTitle}>Todas as compras</Text>
      )}
    </>
  )
}

export default function PurchaseHistoryScreen({ route, navigation }) {
  const { medicineId, medicineName } = route.params ?? {}
  const { user } = useAuth()

  // — States (R-010) —
  const [purchases, setPurchases] = useState([])
  const [medicine, setMedicine] = useState(null)
  const [loading, setLoading] = useState(true)
  // Mapa purchase_id → stock entry (com opened_at) para eixo TTL (012 Fase A)
  const [stockEntryMap, setStockEntryMap] = useState({})

  // — Memos (R-010) —
  const totalCount = useMemo(() => purchases.length, [purchases])

  const totalBought = useMemo(
    () => purchases.reduce((acc, p) => acc + (p.quantity_bought ?? 0), 0),
    [purchases],
  )

  const avgUnitPrice = useMemo(
    () => computeAverageUnitPrice(purchases),
    [purchases],
  )

  // Líquidos (022): resumos em ml / custo por ml.
  const isLiquid = useMemo(() => isLiquidMedicine(medicine), [medicine])
  const unitLabel = useMemo(() => stockUnitLabel(medicine), [medicine])

  // — Effects (R-010) —
  // useFocusEffect obrigatório (R-235): atualiza após retorno do PurchaseForm (edit)
  const fetchPurchases = useCallback(async () => {
    const userId = user?.id
    if (!medicineId || !userId) return
    setLoading(true)
    try {
      const [data, med, stockRows] = await Promise.all([
        stockService.getPurchasesByMedicine(medicineId),
        medicineService.getById(medicineId).catch(() => null),
        // Busca opened_at por lote para eixo TTL (012 Fase A)
        supabase
          .from('stock')
          .select('id, purchase_id, quantity, opened_at')
          .eq('medicine_id', medicineId)
          .gt('quantity', 0)
          .then(({ data: rows }) => rows ?? []),
      ])
      setPurchases(data ?? [])
      setMedicine(med ?? null)
      const entryMap = {}
      for (const row of stockRows) {
        if (row.purchase_id && !entryMap[row.purchase_id]) {
          entryMap[row.purchase_id] = row
        }
      }
      setStockEntryMap(entryMap)
    } catch {
      setPurchases([])
      setStockEntryMap({})
    } finally {
      setLoading(false)
    }
  }, [medicineId, user])

  useFocusEffect(
    useCallback(() => {
      fetchPurchases()
    }, [fetchPurchases]),
  )

  // — Handlers (R-010) —
  const handlePressCard = useCallback(
    (purchase) => {
      navigation.navigate(ROUTES.PURCHASE_FORM, {
        mode: 'edit',
        medicineId,
        medicineName,
        purchaseId: purchase.id,
        purchase,
      })
    },
    [navigation, medicineId, medicineName],
  )

  // — Render helpers —
  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={styles.cardWrapper}>
        <PurchaseCard
          purchase={item}
          remaining={item.remaining ?? 0}
          isLatest={index === 0}
          medicine={medicine}
          stockEntry={stockEntryMap[item.id] ?? null}
          onPress={() => handlePressCard(item)}
        />
      </View>
    ),
    [handlePressCard, medicine, stockEntryMap],
  )

  const keyExtractor = useCallback((item) => item.id, [])

  // — Render: barra superior com voltar (sempre visível, inclusive no loading) —
  const topBar = (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
      >
        <ChevronLeft size={26} color={colors.text.primary} />
      </Pressable>
    </View>
  )

  // — Loading —
  if (loading) {
    return (
      <ScreenContainer>
        {topBar}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {topBar}
      <FlatList
        data={purchases}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          purchases.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={
          <HistoryHeaderComponent
            medicine={medicine}
            medicineName={medicineName}
            isLiquid={isLiquid}
            totalBought={totalBought}
            totalCount={totalCount}
            avgUnitPrice={avgUnitPrice}
            unitLabel={unitLabel}
          />
        }
        ListEmptyComponent={
          // A prop `description` nunca existiu em EmptyState (era ignorada em
          // runtime) — `hint` é a prop correta pro texto secundário (review #719)
          <EmptyState
            message="Nenhuma compra registrada"
            hint="Adicione sua primeira compra pelo estoque do medicamento."
          />
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  // Barra superior (voltar)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    opacity: 0.6,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },

  loadingText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
  },

  // Lista
  listContent: {
    paddingBottom: spacing[10],
  },

  listContentEmpty: {
    flexGrow: 1,
  },

  // Card de contexto do medicamento
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    marginBottom: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  medicineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicineInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  medicineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  medicineName: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
    fontFamily: typography.fontFamily?.bold ?? 'System',
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
    fontWeight: '700',
    color: colors.neutral[700],
  },
  medicineSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  pageSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
    marginTop: spacing[1],
  },

  // Resumo
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },

  summaryCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    gap: spacing[1],
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Seção de lista
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Wrapper de cada card
  cardWrapper: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
})
