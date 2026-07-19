// StockScreen.jsx — hub principal de Gerenciamento de Estoque (S1.8 Wave 4)
// R-010: ordem hooks → States → Memos → Effects → Handlers
// PO-2: FAB ubíquo "Registrar compra" via PurchaseMedicineSheet

import React, { useState, useMemo, useCallback } from 'react'
import { SectionList, RefreshControl, StyleSheet, Text, View, Pressable } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
const { Plus, PackageOpen } = LucideIcons as any
import { useStock } from '@stock/hooks/useStock'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import EmptyState from '@shared/components/states/EmptyState'
import ErrorState from '@shared/components/states/ErrorState'
import StockItem from '@stock/components/StockItem'
import StockFilterChips from '@stock/components/StockFilterChips'
import PurchaseMedicineSheet from '@stock/components/PurchaseMedicineSheet'
import StaleBanner from '@shared/components/feedback/StaleBanner'
import ChatEntryButton from '@features/chatbot/components/ChatEntryButton'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { navigateCrossTab } from '@navigation/navigateCrossTab'
import { ROUTES } from '@navigation/routes'

// Mensagem contextual do empty state por filtro (evita "nenhum cadastrado"
// quando na verdade há meds, mas nenhum bate o filtro aplicado).
const FILTER_EMPTY_LABEL = {
  critico: 'em estado crítico',
  baixo: 'com estoque baixo',
  sem_tratamento: 'sem tratamento ativo',
}

/**
 * Tela principal de Gerenciamento de Estoque (H5.5).
 */
function StockHeader({ filter, setFilter, counts }) {
  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>
            Gerencie o estoque de medicamentos
          </Text>
        </View>
        <ChatEntryButton />
      </View>
      <StockFilterChips value={filter} onChange={setFilter} counts={counts} />
    </View>
  )
}

function StockEmptyState({ filter, onNavigationPress }) {
  if (filter === 'todos') {
    return (
      <EmptyState
        icon={<PackageOpen size={48} color={colors.primary[500]} strokeWidth={1.5} />}
        title="Ainda sem estoque"
        message="Cadastre primeiro um tratamento para iniciar o controle de estoque."
        action={{
          label: '+ Criar primeiro tratamento',
          onPress: onNavigationPress,
        }}
      />
    )
  }
  return (
    <EmptyState
      icon="🔍"
      title="Nenhum resultado"
      message={`Nenhum medicamento ${FILTER_EMPTY_LABEL[filter]}.`}
    />
  )
}

function calculateCounts(active, inactive) {
  return {
    todos: active.length + inactive.length,
    critico: active.filter((m) => m.status === 'CRITICAL').length,
    baixo: active.filter((m) => m.status === 'LOW').length,
    sem_tratamento: inactive.length,
  }
}

function getFilteredSections(data, filter, active, inactive) {
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

  if (active.length > 0) {
    list.push({ title: 'Estoque em Uso', data: active })
  }
  if (inactive.length > 0) {
    list.push({ title: 'Sem tratamento ativo', data: inactive })
  }
  return list
}

export default function StockScreen() {
  const navigation = useNavigation<any>()
  const { data, loading, error, stale, refreshing, refresh } = useStock()

  // — States (R-010) —
  const [filter, setFilter] = useState('todos')
  const [sheetVisible, setSheetVisible] = useState(false)

  // — Memos (R-010) —
  const active = useMemo(() => data?.active ?? [], [data])
  const inactive = useMemo(() => data?.inactive ?? [], [data])
  const counts = useMemo(() => calculateCounts(active, inactive), [active, inactive])
  const sections = useMemo(() => getFilteredSections(data, filter, active, inactive), [data, filter, active, inactive])

  // — Effects (R-010) —
  // Refresh ao re-focar (volta de PurchaseForm/Detail) pra refletir nova compra
  // sem exigir pull-to-refresh. Pula o 1º foco — useStock já carrega no mount.
  useFocusEffect(
    useCallback(() => {
      refresh(false)
    }, [refresh]),
  )

  // — Handlers (R-010) —
  const handleOpenItem = useCallback(
    (item) => {
      navigation.navigate(ROUTES.STOCK_DETAIL, {
        medicineId: item.id,
        medicineName: item.name,
        dailyConsumption: item.dailyConsumption,
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
    ({ item }) => {
      const isInitialStock = !item.hasPurchases && item.totalQuantity === 0
      return (
        <Pressable
          onPress={() =>
            isInitialStock
              ? handleSelectMedicine(item.id, item.name)
              : handleOpenItem(item)
          }
          style={({ pressed }) => pressed && styles.itemPressed}
          accessibilityRole="button"
          accessibilityLabel={
            isInitialStock
              ? `Registrar estoque inicial de ${item.name}`
              : `Detalhes do estoque de ${item.name}`
          }
        >
          <StockItem medicine={item} />
        </Pressable>
      )
    },
    [handleOpenItem, handleSelectMedicine],
  )

  if (!data && (loading || refreshing)) {
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
          <StockHeader filter={filter} setFilter={setFilter} counts={counts} />
        }
        ListEmptyComponent={
          <StockEmptyState
            filter={filter}
            onNavigationPress={() =>
              navigateCrossTab(ROUTES.TREATMENTS, ROUTES.PROTOCOL_FORM)
            }
          />
        }
        ListFooterComponent={
          active.length > 0 ? (
            <Text style={styles.footnote}>
              * As estimativas desta tela consideram os tratamentos ativos.
            </Text>
          ) : null
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    marginBottom: spacing[2],
  },
  headerTextCol: {
    flex: 1,
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
  footnote: {
    fontSize: 12,
    color: colors.text.muted,
    fontStyle: 'italic',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
  },
})
