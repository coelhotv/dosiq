// MedicineSelectorSheet.jsx — bottom sheet busca medicamento na biblioteca do user.
// Fase 2 T2.4. Spec §3.5. Análogo estrutural ao MedicineAnvisaSheet mas o dataset
// vem de useMedicines() (biblioteca do user no Supabase, não ANVISA).
//
// Tap-and-close: tap no item → callback onSelect(medicine) + close.
// Footer "+ Cadastrar novo medicamento" → callback onCreateNew (parent navega).

import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search, X, Pill, PillBottle, Plus } from 'lucide-react-native'
import { useMedicines } from '../../medications/hooks/useMedicines'
import { selectionTap, lightTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

// NFD normalize para busca case-/diacritics-insensitive (AP-157 — pré-computado).
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export default function MedicineSelectorSheet({
  open,
  onClose,
  onSelect,
  onCreateNew,
  selectedId,
}) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const [query, setQuery] = useState('')
  const { data, loading, error, refresh } = useMedicines()

  // Memos
  const list = useMemo(() => Array.isArray(data) ? data : [], [data])

  // Pré-compute haystack normalizado para evitar normalize por keystroke (AP-157)
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

  const subtitle = useMemo(() => {
    if (loading) return 'Carregando biblioteca…'
    if (error) return error
    const total = list.length
    if (!total) return 'Biblioteca vazia'
    if (trimmed) return `${filtered.length} de ${total} medicamentos`
    return `Biblioteca · ${total} ${total === 1 ? 'medicamento' : 'medicamentos'}`
  }, [loading, error, list.length, filtered.length, trimmed])

  // Effects — refresh biblioteca toda vez que sheet abre (captura med recém-criado)
  useEffect(() => {
    if (open) refresh?.()
  }, [open, refresh])

  // Handlers
  function handleClose() {
    setQuery('')
    onClose?.()
  }

  function handleSelect(item) {
    selectionTap()
    setQuery('')
    onSelect?.(item)
    onClose?.()
  }

  function handleCreateNew() {
    lightTap()
    setQuery('')
    onClose?.()
    onCreateNew?.()
  }

  function renderItem({ item }) {
    const isSelected = item.id === selectedId
    const isSupplement = item.type === 'suplemento'
    const Icon = isSupplement ? PillBottle : Pill
    const iconColor = isSupplement ? colors.supplement[500] : colors.primary[500]
    const iconBg = isSupplement ? colors.supplement[50] : colors.primary[50]

    return (
      <Pressable
        style={({ pressed }) => [
          styles.item,
          isSelected && styles.itemSelected,
          pressed && styles.itemPressed,
        ]}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar ${item.name}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
        <View style={styles.itemText}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.dosage_per_pill ? (
              <View style={styles.dosagePill}>
                <Text style={styles.dosagePillText}>
                  {item.dosage_per_pill}{item.dosage_unit || ''}
                </Text>
              </View>
            ) : null}
          </View>
          {item.active_ingredient ? (
            <Text style={styles.itemSub} numberOfLines={1}>
              {item.active_ingredient}
            </Text>
          ) : null}
        </View>
        <View style={[styles.radio, isSelected && styles.radioSelected]} />
      </Pressable>
    )
  }

  return (
    <Modal
      visible={!!open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      // Android: statusBarTranslucent faz o Modal cobrir o stack do parent
      // navigator inteiro (sem isso o sheet só ocupa a área do screen atual
      // e inputs do form atrás vazam por cima do overlay no Android 7/API 24).
      statusBarTranslucent
    >
      <View style={styles.root}>
        {Platform.OS === 'android' ? (
          <View style={{ height: StatusBar.currentHeight ?? 0 }} />
        ) : null}
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Escolher medicamento</Text>

          <View style={styles.searchBox}>
            <Search size={18} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar em medicamentos…"
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Buscar medicamento na biblioteca"
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

          <Text style={styles.subtitle}>{subtitle}</Text>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={styles.empty}>
                  {trimmed ? 'Nenhum medicamento encontrado.' : 'Nenhum medicamento cadastrado ainda.'}
                </Text>
              ) : null
            }
          />

          <Pressable
            onPress={handleCreateNew}
            style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar novo medicamento"
          >
            <Plus size={18} color={colors.primary[700]} />
            <Text style={styles.footerBtnText}>Cadastrar novo medicamento</Text>
          </Pressable>
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
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
    fontFamily: typography.fontFamily.bold,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 44,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  empty: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.card,
  },
  itemSelected: {
    backgroundColor: colors.primary[50],
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
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
  },
  itemSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  dosagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  radioSelected: {
    backgroundColor: colors.primary[500],
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  footerBtnPressed: {
    opacity: 0.7,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
})
