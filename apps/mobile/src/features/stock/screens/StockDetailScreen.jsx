// StockDetailScreen.jsx — detalhe de estoque de UM medicamento (S1.8 Wave 4)
// R-010: ordem hooks → States → Memos → Effects → Handlers (TDZ crítico)
// ADR-028: StyleSheet canônico · ADR-023: fontWeight >= 400 · ADR-046: unidade(s)
// PO-2: FAB ubíquo "Registrar compra" · PO-3: med travado (passamos medicineId)
//
// ESCOPO MÍNIMO Wave 4: header + card de saldo + histórico + FAB.
// KPI grid fica para S2.1 (próximo sprint).

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useFocusEffect } from '@react-navigation/native'
import { ChevronLeft, Plus, History } from 'lucide-react-native'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import { stockService } from '@stock/services/stockService'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { formatDoseUnit } from '@dosiq/core'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

/**
 * Detalhe de estoque de um medicamento.
 *
 * route.params:
 *   medicineId: string    (obrigatório)
 *   medicineName: string  (display no header)
 */
export default function StockDetailScreen({ navigation }) {
  const route = useRoute()
  const { medicineId, medicineName } = route.params ?? {}
  const { user } = useAuth()

  // — States (R-010) —
  const [totalQuantity, setTotalQuantity] = useState(null)
  const [loading, setLoading] = useState(true)

  // — Effects (R-010) —
  // SYNC callback obrigatório no useFocusEffect (NUNCA async direto — crash
  // "An effect function must not return anything besides a function").
  const fetchSummary = useCallback(async () => {
    const userId = user?.id
    if (!medicineId || !userId) return
    setLoading(true)
    try {
      // getTotalQuantity já resolve view medicine_stock_summary + fallback soma stock.
      const qty = await stockService.getTotalQuantity(medicineId, userId)
      setTotalQuantity(qty ?? 0)
    } catch {
      setTotalQuantity(0)
    } finally {
      setLoading(false)
    }
  }, [medicineId, user])

  useFocusEffect(
    useCallback(() => {
      fetchSummary()
    }, [fetchSummary]),
  )

  // — Handlers (R-010) —
  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleHistory = useCallback(() => {
    navigation.navigate(ROUTES.PURCHASE_HISTORY, { medicineId, medicineName })
  }, [navigation, medicineId, medicineName])

  const handleRegisterPurchase = useCallback(() => {
    navigation.navigate(ROUTES.PURCHASE_FORM, {
      mode: 'create',
      medicineId,
      medicineName,
    })
  }, [navigation, medicineId, medicineName])

  return (
    <ScreenContainer>
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
          >
            <ChevronLeft size={26} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {medicineName ?? 'Medicamento'}
          </Text>
        </View>

        <View style={styles.content}>
          {/* Card de saldo */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo atual</Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Text style={styles.balanceValue}>
                {formatDoseUnit(totalQuantity ?? 0)}
              </Text>
            )}
          </View>

          {/* Histórico de compras */}
          <Pressable
            onPress={handleHistory}
            style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Histórico de compras"
          >
            <History size={20} color={colors.primary[700]} />
            <Text style={styles.historyText}>Histórico de compras</Text>
          </Pressable>
        </View>

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
  backBtn: {
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
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[4],
  },
  balanceCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    gap: spacing[2],
    ...shadows.sm,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  historyText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold || 'System',
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
