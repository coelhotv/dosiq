// MedicinesListScreen.jsx — listagem de medicamentos (Sprint M1.1 Fase 1)

import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Search, X, Plus, ChevronLeft } from 'lucide-react-native'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import StaleBanner from '@shared/components/feedback/StaleBanner'
import MedicineCard from '@medications/components/MedicineCard'
import { MedicineEmptyState } from '@medications/components/MedicineEmptyState'
import { useMedicines } from '@medications/hooks/useMedicines'
import { ROUTES } from '@navigation/routes'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'

function normalize(str) {
  return (str ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function MedicinesListScreen() {
  const navigation = useNavigation()
  const { data, loading, error, stale, refresh } = useMedicines()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Memos (R-010 — States → Memos → Effects → Handlers)
  const filtered = useMemo(() => {
    if (!data) return []
    const q = normalize(query.trim())
    if (!q) return data
    return data.filter(
      m => normalize(m.name).includes(q) || normalize(m.active_ingredient).includes(q)
    )
  }, [data, query])

  // Effects — Refresh ao voltar (Detail edit / Create) — cache invalidado
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  const toggleSearch = useCallback(() => {
    setSearchOpen(prev => {
      if (prev) setQuery('')
      return !prev
    })
  }, [])

  const closeSearch = useCallback(() => {
    setQuery('')
    setSearchOpen(false)
  }, [])

  const handleFabPress = useCallback(() => {
    lightTap()
    navigation.navigate(ROUTES.MEDICINE_CREATE)
  }, [navigation])

  const renderItem = useCallback(
    ({ item }) => (
      <MedicineCard
        medicine={{
          ...item,
          protocols_count: item.protocols?.length ?? 0,
        }}
        onPress={() => navigation.navigate(ROUTES.MEDICINE_DETAIL, { id: item.id })}
      />
    ),
    [navigation]
  )

  if (loading && !data) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando medicamentos..." />
      </ScreenContainer>
    )
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    )
  }

  const isEmpty = data && data.length === 0
  const isFilteredEmpty = !isEmpty && filtered.length === 0 && query.trim().length > 0

  return (
    <ScreenContainer>
      {stale && <StaleBanner />}

      <View style={styles.header}>
        {!searchOpen ? (
          <>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              hitSlop={8}
            >
              <ChevronLeft size={24} color={colors.text.primary} />
            </Pressable>
            <Text style={styles.title}>Medicamentos</Text>
            <Pressable
              onPress={toggleSearch}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Buscar medicamentos"
              hitSlop={8}
            >
              <Search size={22} color={colors.text.primary} />
            </Pressable>
          </>
        ) : (
          <View style={styles.searchBar}>
            <Search size={18} color={colors.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar nos meus medicamentos..."
              placeholderTextColor={colors.text.muted}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            <Pressable onPress={closeSearch} hitSlop={8} accessibilityLabel="Fechar busca">
              <X size={20} color={colors.text.secondary} />
            </Pressable>
          </View>
        )}
      </View>

      {isEmpty ? (
        <MedicineEmptyState />
      ) : (
        <>
          <View style={styles.counterRow}>
            <Text style={styles.counterText}>
              {filtered.length} {filtered.length === 1 ? 'MEDICAMENTO' : 'MEDICAMENTOS'}
            </Text>
            <Text style={styles.sortText}>Mais recentes ↓</Text>
          </View>

          {isFilteredEmpty ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineText}>
                Nenhum medicamento encontrado para &quot;{query}&quot;
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={loading && !!data}
                  onRefresh={refresh}
                  tintColor={colors.brand.primary}
                />
              }
            />
          )}
        </>
      )}

      <Pressable
        onPress={handleFabPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Novo medicamento"
      >
        <Plus size={26} color={colors.text.inverse} />
      </Pressable>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    minHeight: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold,
    flex: 1,
  },
  iconButton: {
    padding: spacing[2],
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text.muted,
  },
  sortText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },
  emptyInline: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    alignItems: 'center',
  },
  emptyInlineText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
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
