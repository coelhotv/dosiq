// StockScreen.jsx — hub principal de Gerenciamento de Estoque (S1.8 Wave 4)
// R-010: ordem hooks → States → Memos → Effects → Handlers
// PO-2: FAB ubíquo "Registrar compra" via PurchaseMedicineSheet

import React, { useState, useMemo, useCallback } from 'react'
import { SectionList, RefreshControl, StyleSheet, Text, View, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Plus } from 'lucide-react-native'
import { useStock } from '@stock/hooks/useStock'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import EmptyState from '@shared/components/states/EmptyState'
import ErrorState from '@shared/components/states/ErrorState'
import StockItem from '@stock/components/StockItem'
import StockFilterChips from '@stock/components/StockFilterChips'
import PurchaseMedicineSheet from '@stock/components/PurchaseMedicineSheet'
import StaleBanner from '@shared/components/feedback/StaleBanner'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

/**
 * Tela principal de Gerenciamento de Estoque (H5.5).
 */
export default function StockScreen() {
  const navigation = useNavigation()
  const { data, loading, error, stale, refreshing, refresh } = useStock()

  // — States (R-010) —
  const [filter, setFilter] = useState('todos')
  const [sheetVisible, setSheetVisible] = useState(false)

  // — Memos (R-010) —
  const active = useMemo(() => data?.active ?? [], [data])
  const inactive = useMemo(() => data?.inactive ?? [], [data])

  const counts = useMemo(
    () => ({
      todos: active.length + inactive.length,
      critico: active.filter((m) => m.status === 'CRITICAL').length,
      baixo: active.filter((m) => m.status === 'LOW').length,
      sem_tratamento: inactive.length,
    }),
    [active, inactive],
  )

  // Aplica o filtro às seções do SectionList.
  const sections = useMemo(() => {
    if (!data) return []
    const list = []

    if (filter === 'sem_tratamento') {
      if (inactive.length > 0) {
        list.push({ title: 'Sem tratamento ativo', data: inactive })
      }
      return list
    }

    if (filter === 'critico' || filter === 'baixo') {
      const status = filter === 'critico' ? 'CRITICAL' : 'LOW'
      const filtered = active.filter((m) => m.status === status)
      if (filtered.length > 0) {
        list.push({ title: 'Estoque em Uso', data: filtered })
      }
      return list
    }

    // 'todos' — ambas as seções
    if (active.length > 0) {
      list.push({ title: 'Estoque em Uso', data: active })
    }
    if (inactive.length > 0) {
      list.push({ title: 'Sem tratamento ativo', data: inactive })
    }
    return list
  }, [data, filter, active, inactive])

  // — Handlers (R-010) —
  const handleOpenItem = useCallback(
    (item) => {
      navigation.navigate(ROUTES.STOCK_DETAIL, {
        medicineId: item.id,
        medicineName: item.name,
      })
    },
    [navigation],
  )

  const handleSelectMedicine = useCallback(
    (medicineId, medicineName) => {
      setSheetVisible(false)
      navigation.navigate(ROUTES.PURCHASE_FORM, {
        mode: 'create',
        medicineId,
        medicineName,
      })
    },
    [navigation],
  )

  const renderItem = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => handleOpenItem(item)}
        style={({ pressed }) => pressed && styles.itemPressed}
        accessibilityRole="button"
        accessibilityLabel={`Detalhes do estoque de ${item.name}`}
      >
        <StockItem medicine={item} />
      </Pressable>
    ),
    [handleOpenItem],
  )

  if (loading && !refreshing) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    )
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <ErrorState
          message="Não foi possível carregar seu estoque."
          onRetry={refresh}
        />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {stale && <StaleBanner />}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary[500]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Meu Estoque</Text>
              <Text style={styles.subtitle}>
                Acompanhe o estoque de seus remédios
              </Text>
            </View>
            <StockFilterChips value={filter} onChange={setFilter} counts={counts} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            message="Você não possui medicamentos cadastrados ou estoque registrado."
          />
        }
      />

      {/* FAB ubíquo (PO-2) — abre seletor de medicamento p/ registrar compra */}
      <Pressable
        onPress={() => setSheetVisible(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Registrar compra"
      >
        <Plus size={28} color={colors.text.inverse} />
      </Pressable>

      <PurchaseMedicineSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleSelectMedicine}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[12],
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing[1],
    fontFamily: typography.fontFamily.medium || 'System',
  },
  itemPressed: {
    opacity: 0.7,
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[50],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
