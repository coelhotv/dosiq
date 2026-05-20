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
  StyleSheet,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import EmptyState from '@shared/components/states/EmptyState'
import PurchaseCard from '@stock/components/PurchaseCard'
import { stockService } from '@stock/services/stockService'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { computeAverageUnitPrice, formatBRL } from '@dosiq/core'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

/**
 * Histórico de compras de um medicamento.
 *
 * route.params:
 *   medicineId: string       (obrigatório)
 *   medicineName: string     (display no header)
 */
export default function PurchaseHistoryScreen({ route, navigation }) {
  const { medicineId, medicineName } = route.params ?? {}
  const { user } = useAuth()

  // — States (R-010) —
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

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

  // — Effects (R-010) —
  // useFocusEffect obrigatório (R-235): atualiza após retorno do PurchaseForm (edit)
  const fetchPurchases = useCallback(async () => {
    const userId = user?.id
    if (!medicineId || !userId) return
    setLoading(true)
    try {
      const data = await stockService.getPurchasesByMedicine(medicineId, userId)
      setPurchases(data ?? [])
    } catch {
      setPurchases([])
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
          onPress={() => handlePressCard(item)}
        />
      </View>
    ),
    [handlePressCard],
  )

  const keyExtractor = useCallback((item) => item.id, [])

  // — Loading —
  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <FlatList
        data={purchases}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          purchases.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={
          <>
            {/* Título da tela */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle} numberOfLines={2}>
                {medicineName ?? 'Medicamento'}
              </Text>
              <Text style={styles.pageSubtitle}>Histórico de compras</Text>
            </View>

            {/* Cards de resumo — visíveis apenas quando há dados */}
            {purchases.length > 0 && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{totalCount}</Text>
                  <Text style={styles.summaryLabel}>Compra{totalCount !== 1 ? 's' : ''}</Text>
                </View>

                <View style={styles.summaryCard}>
                  {/* ADR-046 — unidade(s) */}
                  <Text style={styles.summaryValue}>{totalBought}</Text>
                  <Text style={styles.summaryLabel}>
                    Unidade{totalBought !== 1 ? 's' : ''} comprada{totalBought !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{formatBRL(avgUnitPrice)}</Text>
                  <Text style={styles.summaryLabel}>Custo médio/un.</Text>
                </View>
              </View>
            )}

            {purchases.length > 0 && (
              <Text style={styles.sectionTitle}>Todas as compras</Text>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            message="Nenhuma compra registrada"
            description="Adicione sua primeira compra pelo estoque do medicamento."
          />
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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

  // Cabeçalho da página
  pageHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },

  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    fontFamily: typography.fontFamily?.bold ?? 'System',
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
