// PurchaseMedicineSheet.jsx — bottom sheet para selecionar medicamento ao registrar compra.
// Sprint P.1 S1.7. Especificação R-230.
//
// Contrato: visible + onClose + onSelect(medicineId, medicineName).
// Tap em row → onSelect(id, name) + fecha sheet. Parent navega para o form de compra.
// R-233: statusBarTranslucent + spacer Android + SafeAreaView edges=['bottom'].

import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pill, Search, X } from 'lucide-react-native'
import { useMedicines } from '../../medications/hooks/useMedicines'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { stockService } from '@stock/services/stockService'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

// Cor literal extraída para evitar react-native/no-color-literals em StyleSheet
const SHADOW_COLOR = '#000'

// NFD normalize para busca case-/diacríticos-insensível (AP-157 — pré-computado).
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// MedicineRow extraído como componente próprio para manter PurchaseMedicineSheet
// dentro do limite max-lines-per-function.
function MedicineRow({ item, onPress }) {
  const dosageLabel = item.dosage_per_pill
    ? `${item.dosage_per_pill}${item.dosage_unit || ''}`
    : null

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Selecionar ${item.name} para registrar compra`}
    >
      <View style={styles.itemIcon}>
        <Pill size={20} color={colors.primary[500]} strokeWidth={2} />
      </View>
      <View style={styles.itemText}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {dosageLabel ? (
            <View style={styles.dosagePill}>
              <Text style={styles.dosagePillText}>{dosageLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.itemSub} numberOfLines={1}>
          Saldo: {item.current_stock ?? 0} un.
        </Text>
      </View>
    </Pressable>
  )
}

export default function PurchaseMedicineSheet({ visible, onClose, onSelect }) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [query, setQuery] = useState('')
  const [stockMap, setStockMap] = useState({})
  const { data, loading, error, refresh } = useMedicines()
  const { user } = useAuth()

  // Memos — mescla saldo (medicine_stock_summary) em cada medicamento.
  // useMedicines não traz estoque; sem isso todo saldo aparecia "0 un.".
  const list = useMemo(() => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((m) => ({ ...m, current_stock: stockMap[m.id] ?? 0 }))
  }, [data, stockMap])

  // Pré-computa haystack normalizado para evitar normalize por keystroke (AP-157)
  const indexed = useMemo(
    () =>
      list.map((m) => ({
        item: m,
        haystack: normalize(`${m.name || ''} ${m.active_ingredient || ''}`),
      })),
    [list]
  )

  const trimmed = query.trim()
  const filtered = useMemo(() => {
    if (!trimmed) return indexed.map((x) => x.item)
    const q = normalize(trimmed)
    return indexed.filter((x) => x.haystack.includes(q)).map((x) => x.item)
  }, [indexed, trimmed])

  // Ordena: estoque baixo primeiro (menor current_stock no topo) — alinha com mock do designer
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => (a.current_stock ?? Infinity) - (b.current_stock ?? Infinity)
      ),
    [filtered]
  )

  // Effects — refresh lista + saldo toda vez que sheet abre (captura med/compra recém-criados)
  useEffect(() => {
    if (!visible) return
    refresh?.()
    const userId = user?.id
    if (!userId) return
    let cancelled = false
    stockService
      .getStockSummaryMap(userId)
      .then((map) => { if (!cancelled) setStockMap(map) })
      .catch(() => { if (!cancelled) setStockMap({}) })
    return () => { cancelled = true }
  }, [visible, refresh, user])

  // Handlers
  function handleClose() {
    setQuery('')
    onClose?.()
  }

  function handleSelect(item) {
    selectionTap()
    setQuery('')
    onSelect?.(item.id, item.name)
    onClose?.()
  }

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      // Android: statusBarTranslucent faz o Modal cobrir o status bar e ignorar
      // o bottom tabs do parent navigator (sem isso o sheet só ocupa a área do
      // screen atual, truncando em Android 7+ / API 24 — AP-165 / R-233).
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Spacer Android: empurra o sheet abaixo da status bar translúcida (R-233) */}
        {Platform.OS === 'android' ? (
          <View style={{ height: StatusBar.currentHeight ?? 0 }} />
        ) : null}

        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Fechar"
        />

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          {/* Handle visual */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Para qual medicamento?</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <X size={22} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Campo de busca */}
          <View style={styles.searchBox}>
            <Search size={18} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar medicamento…"
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Buscar medicamento"
              maxLength={100}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Limpar busca"
              >
                <X size={18} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          {/* Rótulo da lista */}
          {!loading && !error && list.length > 0 ? (
            <Text style={styles.listLabel}>
              {trimmed
                ? `${sorted.length} de ${list.length} medicamentos`
                : 'Sugestões · estoque baixo primeiro'}
            </Text>
          ) : null}

          {/* Loading */}
          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={colors.primary[500]} />
              <Text style={styles.centerText}>Carregando medicamentos…</Text>
            </View>
          ) : error ? (
            /* Erro de carregamento */
            <View style={styles.centerWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            /* Lista */
            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MedicineRow item={item} onPress={handleSelect} />
              )}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerWrap}>
                  {list.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Cadastre primeiro um medicamento para registrar uma compra.
                    </Text>
                  ) : (
                    <Text style={styles.emptyText}>
                      Nenhum medicamento encontrado para "{trimmed}".
                    </Text>
                  )}
                </View>
              }
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[5],
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    flex: 1,
  },
  closeBtn: {
    marginLeft: spacing[2],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 44,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    marginBottom: spacing[1],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500',
    padding: 0,
  },
  listLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: spacing[3],
  },
  listContent: {
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  centerWrap: {
    paddingVertical: spacing[8],
    alignItems: 'center',
    gap: spacing[2],
  },
  centerText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  errorText: {
    fontSize: 13,
    color: colors.status.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[4],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    // Sombra leve conforme mock do designer
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  dosagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  itemSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
})
